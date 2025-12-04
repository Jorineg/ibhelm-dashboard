<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="item?.name || 'Item Details'"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :dismissable-mask="true"
    :pt="{
      content: { style: 'padding: 2rem' },
      header: { style: 'padding: 1.5rem 2rem' },
      footer: { style: 'padding: 1.5rem 2rem' }
    }"
  >
    <div v-if="item" class="detail-content scrollable-list">
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

      <!-- Type badge and source links -->
      <div class="detail-section detail-header-row">
        <Tag
          :value="item.type.toUpperCase()"
          :severity="item.type === 'task' ? 'info' : 'success'"
          class="tag-style"
        />
        <div class="source-links">
          <a
            v-if="item.teamwork_url"
            :href="item.teamwork_url"
            target="_blank"
            rel="noopener noreferrer"
            class="source-link-btn teamwork"
            title="Open in Teamwork"
          >
            <i class="pi pi-check-square"></i>
            <span>Teamwork</span>
          </a>
          <a
            v-if="item.missive_url"
            :href="item.missive_url"
            target="_blank"
            rel="noopener noreferrer"
            class="source-link-btn missive"
            title="Open in Missive"
          >
            <i class="pi pi-envelope"></i>
            <span>Missive</span>
          </a>
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
                <div v-for="(item, idx) in value" :key="idx" class="array-item">
                  {{ formatValue(item) }}
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

    <template #footer>
      <div class="dialog-footer">
        <Button label="Close" @click="isVisible = false" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import type { DataItem } from '@/types'

interface Props {
  visible: boolean
  item: DataItem | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showEmptyFields = ref(false)
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Fields to exclude from display
const excludedFields = ['_raw', 'id', 'teamwork_url', 'missive_url']

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

// Reset showEmptyFields when dialog opens
watch(isVisible, (visible) => {
  if (visible) {
    showEmptyFields.value = false
  }
})
</script>

<style scoped>
.detail-content {
  max-height: 70vh;
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
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

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.source-links {
  display: flex;
  gap: 0.75rem;
}

.source-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.source-link-btn.teamwork {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.source-link-btn.teamwork:hover {
  background: rgba(76, 175, 80, 0.3);
  transform: translateY(-1px);
}

.source-link-btn.missive {
  background: rgba(33, 150, 243, 0.15);
  color: #2196f3;
  border: 1px solid rgba(33, 150, 243, 0.3);
}

.source-link-btn.missive:hover {
  background: rgba(33, 150, 243, 0.3);
  transform: translateY(-1px);
}

.source-link-btn i {
  font-size: 1rem;
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

