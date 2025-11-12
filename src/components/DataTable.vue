<template>
  <div class="data-table-wrapper">
    <!-- Column visibility selector -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <!-- Search Bar -->
        <div class="search-wrapper">
          <i class="pi pi-search search-icon" />
          <InputText
            :model-value="props.searchQuery"
            @update:model-value="(value) => emit('update:searchQuery', value as string)"
            placeholder="Search..."
            class="search-input"
          />
          <Button
            v-if="props.searchQuery"
            icon="pi pi-times"
            text
            rounded
            class="clear-search"
            @click="emit('clearSearch')"
          />
        </div>
        
        <div class="item-type-toggles">
          <span class="toggle-label">Show:</span>
          <div class="checkbox-group">
            <Checkbox
              v-model="localShowTasks"
              input-id="show-tasks"
              :binary="true"
            />
            <label for="show-tasks" class="toggle-item-label">Tasks</label>
          </div>
          
          <div class="checkbox-group">
            <Checkbox
              v-model="localShowEmails"
              input-id="show-emails"
              :binary="true"
            />
            <label for="show-emails" class="toggle-item-label">Emails</label>
          </div>
          
          <span class="results-count">
            {{ itemCountDisplay }}
          </span>
        </div>
        
        <MultiSelect
          v-model="localVisibleColumns"
          :options="allColumns"
          option-label="header"
          option-value="field"
          placeholder="Select Columns"
          :max-selected-labels="3"
          selected-items-label="{0} columns selected"
          class="column-selector"
        />
      </div>

      <div class="toolbar-right">
        <SelectButton
          v-model="localViewMode"
          :options="viewModeOptions"
          option-label="label"
          option-value="value"
          class="view-mode-toggle"
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
      @column-resize-end="handleColumnResize"
      class="data-table"
      :resizable-columns="true"
      column-resize-mode="fit"
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
        :style="{ width: props.columnWidths[col.field] || col.width || 'auto' }"
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
              class="tag-style"
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
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import DataTablePrime from 'primevue/datatable'
import Column from 'primevue/column'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { DataItem, Column as ColumnType } from '@/types'

interface Props {
  items: DataItem[]
  columns: ColumnType[]
  loading: boolean
  visibleColumns: string[]
  columnOrder: string[]
  columnWidths: Record<string, string>
  showTasks: boolean
  showEmails: boolean
  viewMode: 'list' | 'gallery'
  searchQuery: string
  totalCount?: number | null
}

interface Emits {
  (e: 'update:visibleColumns', value: string[]): void
  (e: 'update:columnOrder', value: string[]): void
  (e: 'update:columnWidths', value: Record<string, string>): void
  (e: 'update:showTasks', value: boolean): void
  (e: 'update:showEmails', value: boolean): void
  (e: 'update:viewMode', value: 'list' | 'gallery'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'clearSearch'): void
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

const itemCountDisplay = computed(() => {
  const loaded = displayedItems.value.length
  if (props.totalCount !== null && props.totalCount !== undefined) {
    return `${loaded.toLocaleString()} of ${props.totalCount.toLocaleString()} items`
  }
  return `${loaded.toLocaleString()} items`
})

const handleRowClick = (event: { data: DataItem }) => {
  emit('rowClick', event.data)
}

const handleColumnReorder = (event: any) => {
  const newOrder = event.columns.map((col: any) => col.props.field)
  emit('update:columnOrder', newOrder)
}

const handleColumnResize = (event: any) => {
  const field = event.element.getAttribute('data-p-field') || event.element.querySelector('[data-p-field]')?.getAttribute('data-p-field')
  
  if (field) {
    const newWidths = { ...props.columnWidths }
    newWidths[field] = event.element.style.width
    emit('update:columnWidths', newWidths)
  }
}

const getCellComponent = (field: string, data: DataItem) => {
  const value = data[field]

  // Special rendering for certain fields
  if (field === 'type') {
    return h(Tag, {
      value: value?.toUpperCase(),
      severity: value === 'task' ? 'info' : 'success',
      class: 'tag-style'
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
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.table-toolbar {
  position: sticky;
  top: 0;
  z-index: 101;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
  gap: 1.5rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  flex: 1;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.column-selector {
  min-width: 280px;
}

.item-type-toggles {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.5rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.toggle-label {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-item-label {
  font-size: 0.9rem;
  color: var(--text-primary);
  cursor: pointer;
}

.results-count {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 1px solid var(--text-disabled);
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 350px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  color: var(--text-tertiary);
  font-size: 1rem;
  z-index: 1;
}

.search-input {
  width: 100%;
  font-size: 0.95rem !important;
  padding-left: 2.5rem !important;
  padding-right: 2.75rem !important;
}

.clear-search {
  position: absolute;
  right: 0.25rem;
}

.data-table {
  width: 100%;
  flex: 1;
  min-width: 0;
}

.data-table :deep(.p-datatable-wrapper) {
  max-width: 100%;
  width: 100%;
  overflow: visible !important;
}

.data-table :deep(.p-datatable) {
  overflow: visible !important;
}

.data-table :deep(.p-datatable-table) {
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
}

.data-table :deep(.p-datatable-thead > tr),
.data-table :deep(.p-datatable-tbody > tr) {
  width: 100%;
}

.data-table :deep(.p-datatable-thead > tr > th),
.data-table :deep(.p-datatable-tbody > tr > td) {
  overflow: hidden;
  text-overflow: ellipsis;
  word-wrap: break-word;
}

.data-table :deep(.p-datatable-thead) {
  position: sticky !important;
  top: 98px !important;
  z-index: 100 !important;
}

.data-table :deep(.p-datatable-thead > tr > th) {
  position: sticky !important;
  top: 98px !important;
  z-index: 100 !important;
  padding: 1.25rem 1rem !important;
  background: var(--bg-tertiary) !important;
  border-color: var(--border-primary) !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}

.data-table :deep(.p-datatable-tbody > tr > td) {
  padding: 1rem !important;
  border-color: var(--border-primary) !important;
  max-height: 4.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-table :deep(.p-datatable-tbody > tr > td > *) {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.data-table :deep(tbody tr) {
  cursor: pointer;
}

.data-table :deep(tbody tr:hover) {
  background: var(--bg-hover) !important;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.empty-icon,
.loading-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  color: var(--text-disabled);
}

.loading-icon {
  color: var(--accent-primary);
}

.array-item:not(:last-child) {
  margin-bottom: 0.25rem;
}

/* Gallery View */
.gallery-view {
  padding: 2rem;
  flex: 1;
  overflow: auto;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.gallery-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.gallery-item:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
  border-color: var(--text-disabled);
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
  height: 160px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.gallery-icon {
  font-size: 4rem;
  color: var(--text-disabled);
}

.gallery-item-content h4 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.gallery-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 0.4rem 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.meta-item i {
  font-size: 0.9rem;
}

.scroll-trigger {
  height: 20px;
  margin: 1rem 0;
}
</style>

