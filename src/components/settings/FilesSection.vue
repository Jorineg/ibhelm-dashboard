<template>
  <SectionCard
    title="Files"
    description="Manage automatic metadata extraction and display settings for files."
  >
    <template #header-info>
      <InfoBox title="How auto-extraction works:">
        When a file is added or updated, the system automatically extracts metadata from the file path:
        <ul class="extraction-list">
          <li><strong>Email Attachment:</strong> Links to email if filename matches a downloaded attachment</li>
          <li><strong>Project:</strong> Assigns to projects whose names appear in the file path</li>
          <li><strong>Cost Group:</strong> Extracts cost group codes (e.g., KGR 430) from path segments</li>
          <li><strong>Document Type:</strong> Assigns document type if name appears in the path</li>
        </ul>
      </InfoBox>
    </template>

    <!-- File Linking Controls -->
    <div class="run-controls">
      <div class="run-info">
        <div class="run-status" v-if="fileLinkingRun">
          <span class="run-status-label">Last linking run:</span>
          <StatusBadge :status="fileLinkingRun.status" />
          <span v-if="fileLinkingRun.status === 'running'" class="run-progress-info">
            {{ fileLinkingRun.processed_count }} / {{ fileLinkingRun.total_count }}
            ({{ fileLinkingRun.progress_percent }}%)
          </span>
          <span v-else-if="fileLinkingRun.completed_at" class="run-time-info">
            {{ formatDate(fileLinkingRun.completed_at) }}
          </span>
        </div>
        <div v-else class="run-status">
          <span class="run-status-label">No linking runs yet</span>
        </div>
      </div>
      
      <Button
        label="Re-extract Metadata for All Files"
        icon="pi pi-refresh"
        :loading="isLinking"
        @click="$emit('rerun-linking')"
        severity="secondary"
      />
    </div>

    <!-- Last Run Statistics -->
    <StatsGrid
      v-if="fileLinkingRun && fileLinkingRun.status === 'completed'"
      title="Last Run Results"
      :stats="linkingStats"
      class="run-statistics"
    />

    <!-- Note about when to use -->
    <InfoBox variant="warning" title="When to use this:">
      Use this button if you have imported files before the auto-extraction feature was enabled,
      if project names have changed, if you've added new document types, or if cost group prefixes
      were updated in settings.
    </InfoBox>

    <!-- Ignored Files Section -->
    <div class="ignore-patterns-section">
      <h4>Ignored Files</h4>
      <p class="section-hint">
        Files matching these patterns are hidden from the Items view. 
        Patterns use SQL LIKE syntax: <code>%</code> matches any characters.
      </p>

      <div class="patterns-list">
        <div 
          v-for="pattern in localPatterns" 
          :key="pattern.pattern" 
          class="pattern-item"
          :class="{ disabled: !pattern.enabled }"
        >
          <label class="pattern-checkbox">
            <input
              type="checkbox"
              :checked="pattern.enabled"
              @change="togglePattern(pattern.pattern)"
            />
          </label>
          <div class="pattern-info">
            <span class="pattern-label">{{ pattern.label }}</span>
            <code class="pattern-code">{{ pattern.pattern }}</code>
          </div>
          <Tooltip v-if="!pattern.builtin" text="Delete pattern" position="top">
            <button
              type="button"
              class="pattern-delete"
              @click="removePattern(pattern.pattern)"
            >
              <i class="pi pi-trash"></i>
            </button>
          </Tooltip>
          <span v-else class="pattern-builtin-badge">built-in</span>
        </div>
      </div>

      <!-- Add new pattern -->
      <div class="add-pattern-form">
        <input
          v-model="newPatternInput"
          type="text"
          class="text-input pattern-input"
          placeholder="Pattern (e.g., %.tmp)"
          @keyup.enter="addPattern"
        />
        <input
          v-model="newLabelInput"
          type="text"
          class="text-input label-input"
          placeholder="Description"
          @keyup.enter="addPattern"
        />
        <button
          type="button"
          class="add-pattern-btn"
          @click="addPattern"
          :disabled="!newPatternInput.trim()"
        >
          <i class="pi pi-plus"></i>
          Add
        </button>
      </div>

      <span v-if="saving" class="saving-indicator">
        <i class="pi pi-spin pi-spinner"></i> Saving...
      </span>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Button from 'primevue/button'
import { SectionCard, InfoBox, StatusBadge, StatsGrid, Tooltip } from '@/components/common'
import { formatDate } from '@/lib/formatDate'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import type { FileLinkingRun } from '@/composables/useFiles'
import type { FileIgnorePattern } from '@/types'

interface Props {
  fileLinkingRun: FileLinkingRun | null
  isLinking: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'rerun-linking'): void
}>()

const { 
  fileIgnorePatterns, 
  saving, 
  initialize,
  updateFileIgnorePatterns 
} = useAppearanceSettings()

const localPatterns = ref<FileIgnorePattern[]>([])
const newPatternInput = ref('')
const newLabelInput = ref('')

const linkingStats = computed(() => {
  if (!props.fileLinkingRun) return []
  return [
    { label: 'Files Processed', value: props.fileLinkingRun.total_count || 0 },
    { label: 'Attachment Links', value: props.fileLinkingRun.linked_count || 0, variant: 'linked' as const },
    { label: 'New Associations', value: props.fileLinkingRun.created_count || 0, variant: 'created' as const }
  ]
})

const togglePattern = async (pattern: string) => {
  const idx = localPatterns.value.findIndex(p => p.pattern === pattern)
  if (idx === -1) return
  
  localPatterns.value[idx] = { 
    ...localPatterns.value[idx], 
    enabled: !localPatterns.value[idx].enabled 
  }
  await updateFileIgnorePatterns([...localPatterns.value])
}

const removePattern = async (pattern: string) => {
  localPatterns.value = localPatterns.value.filter(p => p.pattern !== pattern)
  await updateFileIgnorePatterns([...localPatterns.value])
}

const addPattern = async () => {
  const pattern = newPatternInput.value.trim()
  const label = newLabelInput.value.trim() || pattern
  
  if (!pattern) return
  if (localPatterns.value.some(p => p.pattern === pattern)) return
  
  localPatterns.value = [...localPatterns.value, {
    pattern,
    label,
    enabled: true,
    builtin: false
  }]
  
  newPatternInput.value = ''
  newLabelInput.value = ''
  
  await updateFileIgnorePatterns([...localPatterns.value])
}

watch(fileIgnorePatterns, (newValue) => {
  localPatterns.value = [...newValue]
}, { immediate: true })

onMounted(async () => {
  await initialize()
  localPatterns.value = [...fileIgnorePatterns.value]
})
</script>

<style scoped>
.extraction-list {
  margin: 0.5rem 0 0 1.5rem;
  padding: 0;
}

.extraction-list li {
  margin: 0.25rem 0;
}

/* Ignore Patterns Section */
.ignore-patterns-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-primary);
}

.ignore-patterns-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.section-hint {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin: 0 0 1.25rem 0;
}

.section-hint code {
  background: var(--bg-tertiary);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
}

/* Patterns List */
.patterns-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.pattern-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
  transition: all 0.15s ease;
}

.pattern-item.disabled {
  opacity: 0.5;
}

.pattern-checkbox input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--accent-primary);
  cursor: pointer;
}

.pattern-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.pattern-label {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.pattern-code {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-secondary);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  display: inline-block;
  max-width: fit-content;
}

.pattern-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.pattern-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.pattern-builtin-badge {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Add Pattern Form */
.add-pattern-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.text-input {
  padding: 0.6rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.85rem;
  transition: border-color 0.15s ease;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.text-input::placeholder {
  color: var(--text-tertiary);
}

.pattern-input {
  width: 200px;
  font-family: 'JetBrains Mono', monospace;
}

.label-input {
  width: 200px;
}

.add-pattern-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-pattern-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-secondary);
}

.add-pattern-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.saving-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent-primary);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
</style>
