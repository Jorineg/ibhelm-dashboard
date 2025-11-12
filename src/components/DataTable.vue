<template>
  <div class="data-table-wrapper">
    <!-- Column visibility selector -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <MultiSelect
          v-model="localVisibleColumns"
          :options="allColumns"
          option-label="header"
          option-value="field"
          placeholder="Select Columns"
          :max-selected-labels="3"
          class="column-selector"
        />
        
        <div class="item-type-toggles">
          <span class="toggle-label">Show:</span>
          <Checkbox
            v-model="localShowTasks"
            input-id="show-tasks"
            :binary="true"
          />
          <label for="show-tasks" class="toggle-item-label">Tasks</label>
          
          <Checkbox
            v-model="localShowEmails"
            input-id="show-emails"
            :binary="true"
          />
          <label for="show-emails" class="toggle-item-label">Emails</label>
        </div>
      </div>

      <div class="toolbar-right">
        <SelectButton
          v-model="localViewMode"
          :options="viewModeOptions"
          option-label="label"
          option-value="value"
        >
          <template #option="slotProps">
            <i :class="slotProps.option.icon"></i>
          </template>
        </SelectButton>
      </div>
    </div>

    <!-- List View -->
    <DataTablePrime
      v-if="localViewMode === 'list'"
      :value="displayedItems"
      :loading="loading"
      striped-rows
      :paginator="false"
      :rows="displayedItems.length"
      :reorderable-columns="true"
      @row-click="handleRowClick"
      @column-reorder="handleColumnReorder"
      class="data-table"
      scrollable
      scroll-height="calc(100vh - 320px)"
    >
      <template #empty>
        <div class="empty-state">
          <i class="pi pi-inbox empty-icon"></i>
          <p>No items found</p>
        </div>
      </template>

      <template #loading>
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner loading-icon"></i>
          <p>Loading data...</p>
        </div>
      </template>

      <Column
        v-for="col in orderedVisibleColumns"
        :key="col.field"
        :field="col.field"
        :header="col.header"
        :sortable="col.sortable !== false"
        :style="{ width: col.width || 'auto' }"
      >
        <template #body="{ data }">
          <component
            :is="getCellComponent(col.field, data)"
            :data="data"
            :field="col.field"
          />
        </template>
      </Column>
    </DataTablePrime>

    <!-- Gallery View -->
    <div v-else class="gallery-view">
      <div class="gallery-grid">
        <div
          v-for="item in displayedItems"
          :key="item.id"
          class="gallery-item"
          @click="handleRowClick({ data: item })"
        >
          <div class="gallery-item-header">
            <Tag
              :value="item.type"
              :severity="item.type === 'task' ? 'info' : 'success'"
            />
          </div>
          <div class="gallery-item-thumbnail">
            <i
              :class="item.type === 'task' ? 'pi pi-check-square' : 'pi pi-envelope'"
              class="gallery-icon"
            ></i>
          </div>
          <div class="gallery-item-content">
            <h4>{{ item.name }}</h4>
            <p v-if="item.description" class="gallery-description">
              {{ truncateText(item.description, 100) }}
            </p>
            <div class="gallery-meta">
              <span v-if="item.project" class="meta-item">
                <i class="pi pi-folder"></i> {{ item.project }}
              </span>
              <span v-if="item.status" class="meta-item">
                <i class="pi pi-tag"></i> {{ item.status }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="displayedItems.length === 0" class="empty-state">
        <i class="pi pi-inbox empty-icon"></i>
        <p>No items found</p>
      </div>
    </div>

    <!-- Infinite scroll trigger -->
    <div ref="scrollTrigger" class="scroll-trigger"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, h } from 'vue'
import DataTablePrime from 'primevue/datatable'
import Column from 'primevue/column'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import type { DataItem, Column as ColumnType } from '@/types'

interface Props {
  items: DataItem[]
  columns: ColumnType[]
  loading: boolean
  visibleColumns: string[]
  columnOrder: string[]
  showTasks: boolean
  showEmails: boolean
  viewMode: 'list' | 'gallery'
}

interface Emits {
  (e: 'update:visibleColumns', value: string[]): void
  (e: 'update:columnOrder', value: string[]): void
  (e: 'update:showTasks', value: boolean): void
  (e: 'update:showEmails', value: boolean): void
  (e: 'update:viewMode', value: 'list' | 'gallery'): void
  (e: 'rowClick', item: DataItem): void
  (e: 'loadMore'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const scrollTrigger = ref<HTMLElement | null>(null)

const localVisibleColumns = computed({
  get: () => props.visibleColumns,
  set: (value) => emit('update:visibleColumns', value)
})

const localShowTasks = computed({
  get: () => props.showTasks,
  set: (value) => emit('update:showTasks', value)
})

const localShowEmails = computed({
  get: () => props.showEmails,
  set: (value) => emit('update:showEmails', value)
})

const localViewMode = computed({
  get: () => props.viewMode,
  set: (value) => emit('update:viewMode', value)
})

const viewModeOptions = [
  { label: 'List', value: 'list', icon: 'pi pi-list' },
  { label: 'Gallery', value: 'gallery', icon: 'pi pi-th-large' }
]

const allColumns = computed(() => props.columns)

const orderedVisibleColumns = computed(() => {
  // Filter columns based on visibility and data
  const visibleCols = props.columns.filter(col => 
    props.visibleColumns.includes(col.field) &&
    shouldShowColumn(col.field)
  )

  // Sort by columnOrder
  return visibleCols.sort((a, b) => {
    const indexA = props.columnOrder.indexOf(a.field)
    const indexB = props.columnOrder.indexOf(b.field)
    
    if (indexA === -1 && indexB === -1) return 0
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    
    return indexA - indexB
  })
})

// Check if column should be shown based on data
const shouldShowColumn = (field: string): boolean => {
  // If no items, show all columns
  if (props.items.length === 0) return true

  // Check if any item has a non-empty value for this field
  return props.items.some(item => {
    const value = item[field]
    return value !== null && value !== undefined && value !== ''
  })
}

const displayedItems = computed(() => props.items)

const handleRowClick = (event: { data: DataItem }) => {
  emit('rowClick', event.data)
}

const handleColumnReorder = (event: any) => {
  const newOrder = event.columns.map((col: any) => col.props.field)
  emit('update:columnOrder', newOrder)
}

const getCellComponent = (field: string, data: DataItem) => {
  const value = data[field]

  // Special rendering for certain fields
  if (field === 'type') {
    return h(Tag, {
      value: value?.toUpperCase(),
      severity: value === 'task' ? 'info' : 'success'
    })
  }

  if (Array.isArray(value)) {
    return h('div', value.map((item, idx) => 
      h('div', { key: idx, class: 'array-item' }, 
        typeof item === 'object' ? item.name || item.email || JSON.stringify(item) : String(item)
      )
    ))
  }

  if (typeof value === 'object' && value !== null) {
    return h('span', value.name || value.email || JSON.stringify(value))
  }

  // Format dates
  if (field.includes('date') || field.includes('at')) {
    if (value && typeof value === 'string') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return h('span', date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }))
      }
    }
  }

  return h('span', value || '—')
}

const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Infinite scroll
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (scrollTrigger.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !props.loading) {
          emit('loadMore')
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(scrollTrigger.value)
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>

<style scoped>
.data-table-wrapper {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  gap: 1rem;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.column-selector {
  min-width: 250px;
}

.item-type-toggles {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border-radius: 6px;
}

.toggle-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #555;
}

.toggle-item-label {
  font-size: 0.875rem;
  color: #555;
  cursor: pointer;
  margin-right: 0.75rem;
}

.data-table {
  width: 100%;
}

.data-table :deep(tbody tr) {
  cursor: pointer;
}

.data-table :deep(tbody tr:hover) {
  background: #f5f5f5 !important;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #999;
}

.empty-icon,
.loading-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  color: #ccc;
}

.loading-icon {
  color: #2196f3;
}

.array-item:not(:last-child) {
  margin-bottom: 0.25rem;
}

/* Gallery View */
.gallery-view {
  padding: 1.5rem;
  min-height: calc(100vh - 320px);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.gallery-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.gallery-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.gallery-item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.gallery-item-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 150px;
  background: #f5f5f5;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.gallery-icon {
  font-size: 4rem;
  color: #ccc;
}

.gallery-item-content h4 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-description {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.gallery-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #888;
  padding: 0.25rem 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.meta-item i {
  font-size: 0.875rem;
}

.scroll-trigger {
  height: 20px;
  margin: 1rem 0;
}
</style>

