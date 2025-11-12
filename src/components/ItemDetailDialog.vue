<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="item?.name || 'Item Details'"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :dismissable-mask="true"
  >
    <div v-if="item" class="detail-content">
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

      <!-- Type badge -->
      <div class="detail-section">
        <Tag
          :value="item.type.toUpperCase()"
          :severity="item.type === 'task' ? 'info' : 'success'"
        />
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
      <Button label="Close" @click="isVisible = false" />
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
const excludedFields = ['_raw', 'id']

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

.detail-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-wrapper label {
  font-size: 0.875rem;
  color: #555;
  cursor: pointer;
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 1rem;
  padding: 0.75rem;
  background: #f9f9f9;
  border-radius: 6px;
}

.field-label {
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

.field-value {
  color: #555;
  font-size: 0.875rem;
  word-break: break-word;
}

.empty-value {
  color: #999;
  font-style: italic;
}

.array-item {
  padding: 0.25rem 0;
}

.array-item:not(:last-child) {
  border-bottom: 1px solid #e0e0e0;
}

.raw-data-accordion {
  margin-top: 2rem;
}

.raw-data {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.75rem;
  overflow-x: auto;
  max-height: 400px;
}
</style>

