<template>
  <SectionCard
    title="Configuration"
    description="Manage service environment variables."
  >
    <template #header-info>
      <button class="add-config-btn" @click="showAddDialog = true">
        <i class="pi pi-plus" />
        Add Config
      </button>
    </template>

    <div v-if="loading" class="loading">
      <i class="pi pi-spin pi-spinner" />
      Loading configurations...
    </div>

    <div v-else-if="Object.keys(configsByCategory).length === 0" class="empty-state">
      <i class="pi pi-cog" />
      <span>No configurations found</span>
    </div>

    <div v-else class="config-categories">
      <div v-for="(configs, category) in configsByCategory" :key="category" class="config-category">
        <h4>{{ formatCategory(category) }}</h4>
        <div class="config-list">
          <div v-for="config in configs" :key="config.key" class="config-item">
            <div class="config-key">
              <span class="key-name">{{ config.key }}</span>
              <span v-if="config.is_secret" class="secret-badge">
                <i class="pi pi-lock" />
                Secret
              </span>
            </div>
            <div class="config-value">
              <code>{{ config.value }}</code>
            </div>
            <div class="config-meta">
              <span class="scope-tags">
                <span v-for="s in config.scope" :key="s" class="scope-tag">{{ s }}</span>
              </span>
            </div>
            <div class="config-actions">
              <button class="action-btn" @click="editConfig(config)" title="Edit">
                <i class="pi pi-pencil" />
              </button>
              <button class="action-btn delete" @click="confirmDelete(config)" title="Delete">
                <i class="pi pi-trash" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <div v-if="showAddDialog || editingConfig" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingConfig ? 'Edit Configuration' : 'Add Configuration' }}</h3>
          <button class="close-btn" @click="closeDialog">
            <i class="pi pi-times" />
          </button>
        </div>
        <form @submit.prevent="saveConfig" class="dialog-form">
          <div class="form-group">
            <label>Key</label>
            <input 
              v-model="formData.key" 
              type="text" 
              :disabled="!!editingConfig"
              placeholder="e.g. TEAMWORK_API_KEY"
              required
            />
          </div>
          <div class="form-group">
            <label>Value</label>
            <input 
              v-model="formData.value" 
              :type="formData.is_secret && editingConfig ? 'password' : 'text'"
              :placeholder="editingConfig && formData.is_secret ? 'Enter new value to change' : 'Value'"
              :required="!editingConfig"
            />
            <span v-if="editingConfig && formData.is_secret" class="hint">
              Leave empty to keep current value
            </span>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select v-model="formData.category">
              <option value="">Select category...</option>
              <option value="shared">Shared</option>
              <option value="teamwork_api">Teamwork API</option>
              <option value="missive_api">Missive API</option>
              <option value="craft_api">Craft API</option>
              <option value="teamworkmissiveconnector">TeamworkMissiveConnector</option>
              <option value="thumbnailtextextractor">ThumbnailTextExtractor</option>
              <option value="mcp">MCP Server</option>
              <option value="supabase">Supabase</option>
            </select>
          </div>
          <div class="form-group">
            <label>Scope (services that use this)</label>
            <div class="scope-checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" v-model="scopeAll" @change="toggleAllScope" />
                All services (*)
              </label>
              <label v-for="svc in serviceOptions" :key="svc" class="checkbox-label">
                <input 
                  type="checkbox" 
                  :value="svc" 
                  v-model="formData.scope" 
                  :disabled="scopeAll"
                />
                {{ svc }}
              </label>
            </div>
          </div>
          <div class="form-group checkbox">
            <label class="checkbox-label">
              <input type="checkbox" v-model="formData.is_secret" />
              This is a secret (mask value in UI)
            </label>
          </div>
          <div class="form-group">
            <label>Description (optional)</label>
            <input v-model="formData.description" type="text" placeholder="What is this for?" />
          </div>
          <div class="dialog-actions">
            <button type="button" class="cancel-btn" @click="closeDialog">Cancel</button>
            <button type="submit" class="save-btn" :disabled="saving">
              <i v-if="saving" class="pi pi-spin pi-spinner" />
              {{ editingConfig ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="deletingConfig" class="dialog-overlay" @click.self="deletingConfig = null">
      <div class="dialog confirm-dialog">
        <div class="dialog-header">
          <h3>Delete Configuration</h3>
        </div>
        <p>Are you sure you want to delete <strong>{{ deletingConfig.key }}</strong>?</p>
        <div class="dialog-actions">
          <button class="cancel-btn" @click="deletingConfig = null">Cancel</button>
          <button class="delete-btn" @click="doDelete" :disabled="saving">
            <i v-if="saving" class="pi pi-spin pi-spinner" />
            Delete
          </button>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SectionCard } from '@/components/common'
import type { ServiceConfig } from '@/composables/useServices'

interface Props {
  configsByCategory: Record<string, ServiceConfig[]>
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'create', config: Partial<ServiceConfig>): void
  (e: 'update', key: string, updates: Partial<ServiceConfig>): void
  (e: 'delete', key: string): void
}>()

const showAddDialog = ref(false)
const editingConfig = ref<ServiceConfig | null>(null)
const deletingConfig = ref<ServiceConfig | null>(null)
const saving = ref(false)
const scopeAll = ref(false)

const serviceOptions = ['teamworkmissiveconnector', 'thumbnailtextextractor', 'mcp', 'supabase']

const formData = ref({
  key: '',
  value: '',
  category: '',
  scope: [] as string[],
  is_secret: false,
  description: ''
})

const formatCategory = (category: string) => {
  const names: Record<string, string> = {
    'shared': 'Shared',
    'teamwork_api': 'Teamwork API',
    'missive_api': 'Missive API',
    'craft_api': 'Craft API',
    'teamworkmissiveconnector': 'TeamworkMissiveConnector',
    'thumbnailtextextractor': 'ThumbnailTextExtractor',
    'mcp': 'MCP Server',
    'supabase': 'Supabase',
    'uncategorized': 'Uncategorized'
  }
  return names[category] || category
}

const toggleAllScope = () => {
  if (scopeAll.value) {
    formData.value.scope = ['*']
  } else {
    formData.value.scope = []
  }
}

const editConfig = (config: ServiceConfig) => {
  editingConfig.value = config
  formData.value = {
    key: config.key,
    value: '', // Don't show actual value for secrets
    category: config.category || '',
    scope: [...config.scope],
    is_secret: config.is_secret,
    description: config.description || ''
  }
  scopeAll.value = config.scope.includes('*')
}

const confirmDelete = (config: ServiceConfig) => {
  deletingConfig.value = config
}

const closeDialog = () => {
  showAddDialog.value = false
  editingConfig.value = null
  formData.value = {
    key: '',
    value: '',
    category: '',
    scope: [],
    is_secret: false,
    description: ''
  }
  scopeAll.value = false
}

const saveConfig = async () => {
  saving.value = true
  try {
    const data: Partial<ServiceConfig> = {
      key: formData.value.key,
      scope: scopeAll.value ? ['*'] : formData.value.scope,
      is_secret: formData.value.is_secret,
      category: formData.value.category || undefined,
      description: formData.value.description || undefined
    }
    
    if (formData.value.value) {
      data.value = formData.value.value
    }
    
    if (editingConfig.value) {
      emit('update', editingConfig.value.key, data)
    } else {
      data.value = formData.value.value // Required for create
      emit('create', data)
    }
    
    closeDialog()
  } finally {
    saving.value = false
  }
}

const doDelete = async () => {
  if (!deletingConfig.value) return
  saving.value = true
  try {
    emit('delete', deletingConfig.value.key)
    deletingConfig.value = null
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.add-config-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.add-config-btn:hover {
  opacity: 0.9;
}

.loading,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-tertiary);
}

.loading i,
.empty-state i {
  font-size: 1.5rem;
}

/* Categories */
.config-categories {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.config-category h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.config-key {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.key-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.secret-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: rgba(234, 179, 8, 0.15);
  border-radius: var(--radius-sm);
  color: var(--warning);
  font-size: 0.7rem;
  font-weight: 600;
}

.secret-badge i {
  font-size: 0.65rem;
}

.config-value code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

.config-meta {
  display: flex;
  gap: 0.5rem;
}

.scope-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.scope-tag {
  padding: 0.15rem 0.4rem;
  background: var(--accent-primary-dark);
  border-radius: var(--radius-sm);
  color: var(--accent-primary);
  font-size: 0.7rem;
  font-weight: 500;
}

.config-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error);
  color: var(--error);
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.confirm-dialog {
  max-width: 400px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--text-primary);
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input,
.form-group select {
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.form-group .hint {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.scope-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.cancel-btn,
.save-btn,
.delete-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.cancel-btn {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.save-btn {
  background: var(--accent-primary);
  color: white;
}

.delete-btn {
  background: var(--error);
  color: white;
}

.cancel-btn:hover,
.save-btn:hover,
.delete-btn:hover {
  opacity: 0.9;
}

.cancel-btn:disabled,
.save-btn:disabled,
.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .config-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .config-actions {
    justify-content: flex-end;
  }
}
</style>

