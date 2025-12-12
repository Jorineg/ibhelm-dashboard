<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :dismissable-mask="true"
    :pt="{
      content: { style: 'padding: 2rem' },
      header: { style: 'padding: 1.5rem 2rem' }
    }"
  >
    <template #header>
      <div class="dialog-header-content">
        <TypeLinkButton v-if="item" :item="item" :item-type="detectedItemType" />
        <span class="dialog-title">{{ dialogTitle }}</span>
      </div>
    </template>

    <div v-if="item" class="detail-content scrollable-list">
      <!-- Thumbnail preview for files -->
      <div v-if="hasThumbnail" class="thumbnail-preview">
        <img
          :src="thumbnailUrl"
          :alt="(item as DataItem).name"
          class="thumbnail-preview-img"
          @error="thumbnailFailed = true"
        />
      </div>

      <!-- Toggle for empty fields -->
      <div class="detail-header">
        <div class="checkbox-wrapper">
          <Checkbox
            v-model="showEmptyFields"
            input-id="show-empty"
            :binary="true"
          />
          <label for="show-empty">Show empty fields</label>
        </div>
      </div>

      <!-- Display all fields -->
      <div class="detail-fields">
        <div
          v-for="[key, value] in displayFields"
          :key="key"
          class="field-row"
        >
          <div class="field-label">{{ formatFieldName(key) }}</div>
          <div class="field-value">
            <template v-if="Array.isArray(value)">
              <div v-if="value.length > 0">
                <div v-for="(arrayItem, idx) in value" :key="idx" class="array-item">
                  {{ formatValue(arrayItem) }}
                </div>
              </div>
              <span v-else class="empty-value">—</span>
            </template>
            <template v-else-if="typeof value === 'object' && value !== null">
              <pre>{{ JSON.stringify(value, null, 2) }}</pre>
            </template>
            <template v-else>
              {{ formatValue(value) }}
            </template>
          </div>
        </div>
      </div>

      <!-- Raw data (collapsible) -->
      <Accordion v-if="item._raw" class="raw-data-accordion">
        <AccordionTab header="Raw Data">
          <pre class="raw-data">{{ JSON.stringify(item._raw, null, 2) }}</pre>
        </AccordionTab>
      </Accordion>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import { TypeLinkButton } from '@/components/common'
import type { ViewDataItem, DataItem, ProjectItem, PersonItem } from '@/types'

interface Props {
  visible: boolean
  item: ViewDataItem | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showEmptyFields = ref(false)
const thumbnailFailed = ref(false)
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Thumbnail support for files
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const hasThumbnail = computed(() => {
  if (!props.item || thumbnailFailed.value) return false
  return !!(props.item as DataItem).thumbnail_path
})
const thumbnailUrl = computed(() => {
  if (!props.item) return ''
  const path = (props.item as DataItem).thumbnail_path
  return path ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${path}` : ''
})

// Detect item type based on properties
const detectedItemType = computed<'item' | 'project' | 'person'>(() => {
  if (!props.item) return 'item'
  
  // Check for PersonItem: has display_name and primary_email
  if ('display_name' in props.item && 'primary_email' in props.item) {
    return 'person'
  }
  
  // Check for ProjectItem: has company_name or task_count (project-specific fields)
  if ('company_name' in props.item || 'task_count' in props.item || 'contractor_count' in props.item) {
    return 'project'
  }
  
  // Default to item (DataItem with type field)
  return 'item'
})

// Dialog title based on item type
const dialogTitle = computed(() => {
  if (!props.item) return 'Details'
  
  switch (detectedItemType.value) {
    case 'person':
      return (props.item as PersonItem).display_name || 'Person Details'
    case 'project':
      return (props.item as ProjectItem).name || 'Project Details'
    default:
      return (props.item as DataItem).name || 'Item Details'
  }
})


// Fields to exclude from display
const excludedFields = ['_raw', 'id', 'teamwork_url', 'missive_url', 'craft_url', 'thumbnail_path', 'storage_path']

const displayFields = computed(() => {
  if (!props.item) return []

  const fields = Object.entries(props.item)
    .filter(([key]) => !excludedFields.includes(key))
    .filter(([_, value]) => {
      if (showEmptyFields.value) return true
      
      // Hide empty values
      if (value === null || value === undefined || value === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      
      return true
    })
    .sort(([keyA], [keyB]) => {
      // Sort by field importance
      const order = ['type', 'name', 'description', 'status', 'project', 'customer']
      const indexA = order.indexOf(keyA)
      const indexB = order.indexOf(keyB)
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      
      return keyA.localeCompare(keyB)
    })

  return fields
})

const formatFieldName = (key: string): string => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '—'
  if (value === '') return '—'
  
  // Format dates
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
  
  // Format objects
  if (typeof value === 'object') {
    if (value.name) return value.name
    if (value.first_name && value.last_name) return `${value.first_name} ${value.last_name}`
    if (value.email) return value.email
    return JSON.stringify(value)
  }
  
  return String(value)
}

// Reset state when dialog opens
watch(isVisible, (visible) => {
  if (visible) {
    showEmptyFields.value = false
    thumbnailFailed.value = false
  }
})
</script>

<style scoped>
.detail-content {
  max-height: 70vh;
  overflow-y: auto;
}

.thumbnail-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.thumbnail-preview-img {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.detail-header {
  margin-bottom: 1.5rem;
}

.checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.checkbox-wrapper label {
  font-size: 0.9rem;
  color: var(--text-primary);
  cursor: pointer;
}

.dialog-header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 1.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border-primary);
}

.field-row:last-child {
  border-bottom: none;
}

.field-label {
  font-weight: 500;
  color: var(--text-tertiary);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.field-value {
  color: var(--text-primary);
  font-size: 0.95rem;
  word-break: break-word;
}

.field-value pre {
  background: var(--bg-tertiary);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  overflow-x: auto;
}

.empty-value {
  color: var(--text-muted);
  font-style: italic;
}

.array-item {
  padding: 0.5rem 0;
}

.array-item:not(:last-child) {
  border-bottom: 1px solid var(--border-primary);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.raw-data-accordion {
  margin-top: 2rem;
  border-top: 1px solid var(--border-primary);
  padding-top: 2rem;
}

.raw-data-accordion :deep(.p-accordion-header-link) {
  padding: 1rem !important;
  border-radius: var(--radius-md) !important;
}

.raw-data-accordion :deep(.p-accordion-header-link) .p-accordion-toggle-icon {
  margin-right: 0.5rem !important;
}

.raw-data-accordion :deep(.p-accordion-content) {
  padding: 1rem !important;
  background: transparent !important;
}

.raw-data {
  background: var(--bg-tertiary);
  padding: 1rem;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  overflow-x: auto;
  max-height: 400px;
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
}
</style>

