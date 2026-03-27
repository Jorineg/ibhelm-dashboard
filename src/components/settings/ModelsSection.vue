<template>
  <div class="models-section-wrapper">
    <!-- Model Roles -->
    <SectionCard
      title="Model Roles"
      description="Select which models to use for each purpose."
    >
      <div class="role-group">
        <ModelRoleRow label="Default Chat Model" hint="Model used when no specific model is selected in chat."
          v-model="localDefaultModel" :models="localModels" @update:modelValue="saveRole('default_chat_model_id', $event)" />
        <ModelRoleRow label="Agent Model" hint="Model used by the background project activity agent." fallback-label="Default"
          v-model="localAgentModel" :models="localModels" @update:modelValue="saveRole('agent_model_id', $event)" />
        <ModelRoleRow label="Vision Fallback Model" hint="Model used to describe images when the active chat model lacks vision support."
          v-model="localVisionModel" :models="localModels" @update:modelValue="saveRole('vision_fallback_model_id', $event)"
          :warn="!!localVisionModel && modelExists(localVisionModel) && !modelSupportsVision(localVisionModel)" warn-text="Model does not support vision" />
        <ModelRoleRow label="Chat Naming Model" hint="Model used to auto-generate chat session titles." fallback-label="Default"
          v-model="localTitleModel" :models="localModels" @update:modelValue="saveRole('title_model_id', $event)" />
      </div>
    </SectionCard>

    <!-- Model Endpoints -->
    <SectionCard title="Model Endpoints" description="Configure available AI model endpoints.">
      <table class="models-table" v-if="localModels.length">
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th class="num">Input</th>
            <th class="num">Output</th>
            <th class="center">Vision</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(model, index) in localModels" :key="index" :class="{ dimmed: model.hidden }">
            <td class="name-cell">
              {{ model.name || '(unnamed)' }}
              <span v-if="model.hidden" class="hidden-badge">hidden</span>
            </td>
            <td class="provider-cell">{{ providerLabel(model.provider) }}</td>
            <td class="num">${{ model.input_price ?? '–' }}</td>
            <td class="num">${{ model.output_price ?? '–' }}</td>
            <td class="center"><i :class="model.supports_vision ? 'pi pi-check' : 'pi pi-minus'" :style="{ color: model.supports_vision ? '#4ade80' : 'var(--text-tertiary)' }"></i></td>
            <td class="actions">
              <button type="button" class="icon-btn" title="Edit" @click="openEditor(index)"><i class="pi pi-pencil"></i></button>
              <button type="button" class="icon-btn danger" title="Delete" @click="removeModel(index)"><i class="pi pi-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty-state">No models configured.</p>

      <button type="button" class="add-model-btn" @click="openEditor(-1)">
        <i class="pi pi-plus"></i> Add Model
      </button>
    </SectionCard>

    <!-- Edit Dialog -->
    <Teleport to="body">
      <div v-if="editorOpen" class="dialog-backdrop" @mousedown.self="closeEditor">
        <div class="dialog">
          <div class="dialog-header">
            <h3>{{ editIndex === -1 ? 'Add Model' : 'Edit Model' }}</h3>
            <button type="button" class="icon-btn" @click="closeEditor"><i class="pi pi-times"></i></button>
          </div>

          <div class="dialog-body">
            <div class="field-pair">
              <div class="field">
                <label>Provider</label>
                <select v-model="editModel.provider" class="select-input">
                  <option value="anthropic">Anthropic</option>
                  <option value="openai_compat">OpenAI API Style</option>
                </select>
              </div>
              <div class="field">
                <label>Model ID</label>
                <input v-model="editModel.id" type="text" class="text-input" placeholder="e.g. claude-sonnet-4-20250514" />
              </div>
            </div>

            <div class="field-pair">
              <div class="field">
                <label>Display Name</label>
                <input v-model="editModel.name" type="text" class="text-input" placeholder="e.g. Claude Sonnet 4" />
              </div>
              <div class="field">
                <label>Base URL</label>
                <input v-model="editModel.base_url" type="text" class="text-input" placeholder="Override base URL (optional)" />
              </div>
            </div>

            <div class="field-pair">
              <div class="field">
                <label>Context Window</label>
                <input v-model.number="editModel.context_window" type="number" class="text-input narrow" placeholder="e.g. 200000" />
              </div>
              <div class="field">
                <label>Input Price <span class="unit">$/1M tokens</span></label>
                <input v-model.number="editModel.input_price" type="number" step="0.01" class="text-input narrow" placeholder="0.00" />
              </div>
            </div>

            <div class="field-pair">
              <div class="field">
                <label>Output Price <span class="unit">$/1M tokens</span></label>
                <input v-model.number="editModel.output_price" type="number" step="0.01" class="text-input narrow" placeholder="0.00" />
              </div>
              <div class="field">
                <label class="check-field">
                  <input type="checkbox" v-model="editModel.supports_vision" />
                  <span>Supports Vision</span>
                </label>
              </div>
            </div>

            <!-- Advanced -->
            <button type="button" class="advanced-toggle" @click="advancedOpen = !advancedOpen">
              <i :class="advancedOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i> Advanced
            </button>
            <template v-if="advancedOpen">
              <div class="field-pair">
                <div class="field">
                  <label>Cache Read Price <span class="unit">$/1M tokens</span></label>
                  <input v-model.number="editModel.cache_read_price" type="number" step="0.01" class="text-input narrow" placeholder="0.00" />
                </div>
                <div class="field">
                  <label>Cache Write Price <span class="unit">$/1M tokens</span></label>
                  <input v-model.number="editModel.cache_write_price" type="number" step="0.01" class="text-input narrow" placeholder="0.00" />
                </div>
              </div>
              <div class="field-pair">
                <div class="field">
                  <label class="check-field">
                    <input type="checkbox" v-model="editModel.hidden" />
                    <span>Hidden from chat model picker</span>
                  </label>
                </div>
                <div class="field">
                  <label class="check-field">
                    <input type="checkbox" v-model="editModel.auto_execute_code_blocks" />
                    <span>Auto-execute code blocks</span>
                  </label>
                </div>
              </div>
              <div class="field">
                <label>System Prompt Addition</label>
                <textarea v-model="editModel.system_prompt_addition" class="text-input textarea" placeholder="Extra text appended to system prompt" rows="3"></textarea>
              </div>
            </template>
          </div>

          <div class="dialog-footer">
            <button type="button" class="btn secondary" @click="closeEditor">Cancel</button>
            <button type="button" class="btn primary" @click="saveEditor" :disabled="!editModel.id || !editModel.name">
              {{ editIndex === -1 ? 'Add' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, reactive } from 'vue'
import { SectionCard } from '@/components/common'
import { useAppearanceSettings, type ChatModelConfig } from '@/composables/useAppearanceSettings'
import ModelRoleRow from './ModelRoleRow.vue'

const { settings, initialize, updateSetting } = useAppearanceSettings()

const localModels = ref<ChatModelConfig[]>([])
const localDefaultModel = ref('')
const localAgentModel = ref('')
const localVisionModel = ref('')
const localTitleModel = ref('')

const editorOpen = ref(false)
const editIndex = ref(-1)
const advancedOpen = ref(false)
const editModel = reactive<ChatModelConfig>({ id: '', provider: 'anthropic', name: '' })

const PROVIDER_LABELS: Record<string, string> = { anthropic: 'Anthropic', openai_compat: 'OpenAI Style' }
const providerLabel = (p: string) => PROVIDER_LABELS[p] || p

const modelExists = (id: string) => localModels.value.some(m => m.id === id)
const modelSupportsVision = (id: string) => localModels.value.find(m => m.id === id)?.supports_vision ?? false

const saveModels = () => updateSetting('chat_models', cleanModels(localModels.value))
const saveRole = (key: 'default_chat_model_id' | 'agent_model_id' | 'vision_fallback_model_id' | 'title_model_id', value: string) => updateSetting(key, value)

function emptyModel(): ChatModelConfig {
  return { id: '', provider: 'anthropic', name: '' }
}

function cleanModels(models: ChatModelConfig[]): ChatModelConfig[] {
  return models.map(m => {
    const clean: ChatModelConfig = { id: m.id, provider: m.provider, name: m.name }
    if (m.base_url) clean.base_url = m.base_url
    if (m.context_window) clean.context_window = m.context_window
    if (m.supports_vision) clean.supports_vision = true
    if (m.input_price) clean.input_price = m.input_price
    if (m.output_price) clean.output_price = m.output_price
    if (m.cache_read_price) clean.cache_read_price = m.cache_read_price
    if (m.cache_write_price) clean.cache_write_price = m.cache_write_price
    if (m.hidden) clean.hidden = true
    if (m.system_prompt_addition) clean.system_prompt_addition = m.system_prompt_addition
    if (m.auto_execute_code_blocks) clean.auto_execute_code_blocks = true
    return clean
  })
}

function openEditor(index: number) {
  editIndex.value = index
  const src = index >= 0 ? localModels.value[index] : emptyModel()
  Object.assign(editModel, { ...emptyModel(), ...src })
  advancedOpen.value = !!(editModel.cache_read_price || editModel.cache_write_price || editModel.hidden || editModel.auto_execute_code_blocks || editModel.system_prompt_addition)
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

function saveEditor() {
  const snapshot = { ...editModel }
  if (editIndex.value === -1) {
    localModels.value.push(snapshot)
  } else {
    localModels.value[editIndex.value] = snapshot
  }
  saveModels()
  closeEditor()
}

function removeModel(index: number) {
  localModels.value.splice(index, 1)
  saveModels()
}

watch(() => settings.value.chat_models, (val) => { localModels.value = (val || []).map(m => ({ ...m })) }, { immediate: true })
watch(() => settings.value.default_chat_model_id, (val) => { localDefaultModel.value = val || '' }, { immediate: true })
watch(() => settings.value.agent_model_id, (val) => { localAgentModel.value = val || '' }, { immediate: true })
watch(() => settings.value.vision_fallback_model_id, (val) => { localVisionModel.value = val || '' }, { immediate: true })
watch(() => settings.value.title_model_id, (val) => { localTitleModel.value = val || '' }, { immediate: true })

onMounted(() => initialize())
</script>

<style scoped>
.models-section-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ---- Role group ---- */
.role-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ---- Table ---- */
.models-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.models-table th {
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-primary);
}

.models-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-primary);
}

.models-table tr:last-child td {
  border-bottom: none;
}

.models-table tr.dimmed td {
  opacity: 0.5;
}

.models-table .num {
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
}

.models-table .center {
  text-align: center;
}

.models-table .actions {
  text-align: right;
  white-space: nowrap;
}

.name-cell {
  font-weight: 500;
}

.hidden-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  background: rgba(245, 166, 35, 0.15);
  color: #f5a623;
}

.provider-cell {
  color: var(--text-secondary);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.icon-btn.danger:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.empty-state {
  text-align: center;
  color: var(--text-tertiary);
  padding: 2rem 0;
  font-size: 0.9rem;
}

.add-model-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  margin-top: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  justify-content: center;
}

.add-model-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

/* ---- Dialog ---- */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  width: min(560px, 90vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.dialog-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-primary);
}

/* ---- Fields ---- */
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.field .unit {
  font-weight: 400;
  color: var(--text-tertiary);
}

.check-field {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  margin-top: 1.2rem;
}

.check-field input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: var(--accent-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.check-field span {
  font-size: 0.85rem;
  color: var(--text-primary);
}

.select-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.25rem;
  transition: border-color 0.15s ease;
}

.select-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.text-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-family: 'JetBrains Mono', monospace;
  transition: border-color 0.15s ease;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.text-input::placeholder {
  color: var(--text-tertiary);
}

.text-input.narrow {
  max-width: 180px;
}

.text-input.textarea {
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: color 0.15s ease;
  margin-top: 0.25rem;
}

.advanced-toggle:hover {
  color: var(--text-secondary);
}

.advanced-toggle i {
  font-size: 0.7rem;
}

/* ---- Buttons ---- */
.btn {
  padding: 0.6rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.btn.secondary {
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
  color: var(--text-secondary);
}

.btn.secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn.primary {
  background: var(--accent-primary);
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
