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
        
        <div class="item-type-toggles" :class="{ 'no-bg': props.viewType === 'items' || !props.viewType }">
          <template v-if="props.viewType === 'items' || !props.viewType">
            <span class="toggle-label">Show:</span>
            
            <!-- Task type checkboxes -->
            <div 
              v-for="taskType in taskTypes" 
              :key="taskType.id"
              class="checkbox-group task-type-checkbox"
            >
              <div class="task-type-checkbox-inner">
                <Checkbox
                  :model-value="isTaskTypeSelected(taskType.id)"
                  @update:model-value="toggleTaskType(taskType.id)"
                  :input-id="`task-type-${taskType.id}`"
                  :binary="true"
                />
                <label 
                  :for="`task-type-${taskType.id}`" 
                  class="toggle-item-label"
                >
                  {{ taskType.name }}
                </label>
              </div>
              <span 
                v-if="taskType.color" 
                class="task-type-color-bar"
                :style="{ backgroundColor: taskType.color }"
              ></span>
            </div>
            
            <div class="type-divider"></div>
            
            <div class="checkbox-group email-checkbox">
              <div class="email-checkbox-inner">
                <Checkbox
                  v-model="localShowEmails"
                  input-id="show-emails"
                  :binary="true"
                />
                <label for="show-emails" class="toggle-item-label">Email</label>
              </div>
              <span 
                class="email-color-bar"
                :style="{ backgroundColor: emailColor }"
              ></span>
            </div>
            
            <div class="checkbox-group craft-checkbox">
              <div class="craft-checkbox-inner">
                <Checkbox
                  v-model="localShowCraft"
                  input-id="show-craft"
                  :binary="true"
                />
                <label for="show-craft" class="toggle-item-label">Craft</label>
              </div>
              <span 
                class="craft-color-bar"
                :style="{ backgroundColor: craftColor }"
              ></span>
            </div>
          </template>
          
          <span class="results-count" :class="{ 'no-border': props.viewType && props.viewType !== 'items' }">
            {{ itemCountDisplay }}
          </span>
        </div>
        
        <div class="column-selector-wrapper">
          <MultiSelect
            v-model="localVisibleColumns"
            :options="allColumns"
            option-label="header"
            option-value="field"
            placeholder="Select Columns"
            :max-selected-labels="3"
            selected-items-label="{0} columns selected"
            class="column-selector toolbar-input"
          />
          <span v-if="hiddenEmptyColumnsCount > 0" class="hidden-columns-hint">
            ({{ hiddenEmptyColumnsCount }} empty columns hidden)
          </span>
        </div>
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
    <div v-if="localViewMode === 'list'" class="table-scroll-container">
      <DataTablePrime
        ref="dataTableRef"
        :value="displayedItems"
        :loading="loading"
        striped-rows
        :paginator="false"
        :rows="displayedItems.length"
        :reorderable-columns="true"
        :sort-field="props.sortConfig?.field"
        :sort-order="props.sortConfig?.order === 'asc' ? 1 : -1"
        removable-sort
        @row-click="handleRowClick"
        @column-reorder="handleColumnReorder"
        @sort="handleSort"
        @column-resize-start="handleResizeStart"
        @column-resize-end="handleResizeEnd"
        class="data-table"
        :resizable-columns="true"
        column-resize-mode="expand"
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

        <!-- Type Column (frozen on left, only for items view) -->
        <Column
          v-if="props.viewType === 'items' || !props.viewType"
          field="type"
          header="Type"
          frozen
          :sortable="true"
          :reorderable-column="false"
          :style="{ width: '100px', minWidth: '100px', maxWidth: '100px' }"
          class="type-column"
        >
          <template #body="{ data }">
            <a
              :href="getItemPrimaryUrl(data)"
              target="_blank"
              rel="noopener noreferrer"
              class="type-badge-link"
              :style="getTypeBadgeStyle(data)"
              :title="getTypeBadgeTooltip(data)"
              @click.stop
            >
              {{ getTypeBadgeText(data) }}
            </a>
          </template>
        </Column>

        <Column
          v-for="col in orderedVisibleColumnsWithoutType"
          :key="col.field"
          :field="col.field"
          :header="col.header"
          :sortable="col.sortable !== false"
          :style="getColumnStyle(col)"
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
    </div>

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
            <a
              v-if="props.viewType === 'items' || !props.viewType"
              :href="getItemPrimaryUrl(item)"
              target="_blank"
              rel="noopener noreferrer"
              class="gallery-type-badge-link"
              :style="getTypeBadgeStyle(item)"
              :title="getTypeBadgeTooltip(item)"
              @click.stop
            >
              {{ getTypeBadgeText(item) }}
            </a>
            <Tag
              v-else-if="props.viewType === 'projects'"
              :value="item.status || 'active'"
              severity="success"
              class="tag-style"
            />
            <Tag
              v-else-if="props.viewType === 'people'"
              :value="item.is_company ? 'Company' : 'Person'"
              :severity="item.is_internal ? 'warning' : 'info'"
              class="tag-style"
            />
          </div>
          <div class="gallery-item-thumbnail">
            <i
              :class="getGalleryIcon(item)"
              class="gallery-icon"
            ></i>
          </div>
          <div class="gallery-item-content">
            <h4>{{ getGalleryTitle(item) }}</h4>
            <p v-if="getGalleryDescription(item)" class="gallery-description">
              {{ truncateText(getGalleryDescription(item), 100) }}
            </p>
            <div class="gallery-meta">
              <template v-if="props.viewType === 'items' || !props.viewType">
                <span v-if="item.project" class="meta-item">
                  <i class="pi pi-folder"></i> {{ item.project }}
                </span>
                <span v-if="item.status" class="meta-item">
                  <i class="pi pi-tag"></i> {{ item.status }}
                </span>
              </template>
              <template v-else-if="props.viewType === 'projects'">
                <span v-if="item.company_name" class="meta-item">
                  <i class="pi pi-building"></i> {{ item.company_name }}
                </span>
                <span v-if="item.task_count" class="meta-item">
                  <i class="pi pi-list"></i> {{ item.task_count }} tasks
                </span>
              </template>
              <template v-else-if="props.viewType === 'people'">
                <span v-if="item.primary_email" class="meta-item">
                  <i class="pi pi-envelope"></i> {{ item.primary_email }}
                </span>
                <span v-if="item.is_internal" class="meta-item internal">
                  <i class="pi pi-home"></i> Internal
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div v-if="displayedItems.length === 0" class="empty-state">
        <i class="pi pi-inbox empty-icon"></i>
        <p>No {{ props.viewType || 'items' }} found</p>
      </div>
    </div>

    <!-- Infinite scroll trigger -->
    <div ref="scrollTrigger" class="scroll-trigger"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h, watch } from 'vue'
import DataTablePrime from 'primevue/datatable'
import Column from 'primevue/column'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import type { DataItem, ViewDataItem, Column as ColumnType, SortConfig, ViewType, TaskType } from '@/types'

interface Props {
  items: ViewDataItem[]
  columns: ColumnType[]
  loading: boolean
  visibleColumns: string[]
  columnOrder: string[]
  columnWidths: Record<string, string>
  showTasks: boolean
  showEmails: boolean
  showCraft: boolean
  viewMode: 'list' | 'gallery'
  searchQuery: string
  totalCount?: number | null
  sortConfig?: SortConfig
  viewType?: ViewType
  // Task type filters
  selectedTaskTypes?: string[]
}

interface Emits {
  (e: 'update:visibleColumns', value: string[]): void
  (e: 'update:columnOrder', value: string[]): void
  (e: 'update:columnWidths', value: Record<string, string>): void
  (e: 'update:showTasks', value: boolean): void
  (e: 'update:showEmails', value: boolean): void
  (e: 'update:showCraft', value: boolean): void
  (e: 'update:viewMode', value: 'list' | 'gallery'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:selectedTaskTypes', value: string[]): void
  (e: 'clearSearch'): void
  (e: 'rowClick', item: DataItem): void
  (e: 'loadMore'): void
  (e: 'sort', sortConfig: SortConfig): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Task types from composable
const { taskTypes, initialize: initTaskTypes } = useTaskTypes()

// Appearance settings from composable
const { emailColor, craftColor, initialize: initAppearance } = useAppearanceSettings()

// Initialize task types and appearance settings on mount
onMounted(async () => {
  await Promise.all([initTaskTypes(), initAppearance()])
})

// Toggle a specific task type - directly emit the change
const toggleTaskType = (typeId: string) => {
  const currentSelected = props.selectedTaskTypes || []
  const index = currentSelected.indexOf(typeId)
  let newSelection: string[]
  
  if (index === -1) {
    newSelection = [...currentSelected, typeId]
  } else {
    newSelection = currentSelected.filter(id => id !== typeId)
  }
  emit('update:selectedTaskTypes', newSelection)
}

// Check if a task type is selected - directly read from props
const isTaskTypeSelected = (typeId: string) => {
  const currentSelected = props.selectedTaskTypes || []
  return currentSelected.includes(typeId)
}

const scrollTrigger = ref<HTMLElement | null>(null)
const dataTableRef = ref<InstanceType<typeof DataTablePrime> | null>(null)
const isResizing = ref(false)
let resizeTimeout: number | null = null

const localVisibleColumns = computed({
  get: () => props.visibleColumns,
  set: (value) => emit('update:visibleColumns', value)
})

const localShowEmails = computed({
  get: () => props.showEmails,
  set: (value) => emit('update:showEmails', value)
})

const localShowCraft = computed({
  get: () => props.showCraft,
  set: (value) => emit('update:showCraft', value)
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

// Exclude type column from the regular columns (it's rendered separately as frozen)
const orderedVisibleColumnsWithoutType = computed(() => {
  return orderedVisibleColumns.value.filter(col => col.field !== 'type')
})

// Count columns that are hidden because all their values are empty
const hiddenEmptyColumnsCount = computed(() => {
  if (props.items.length === 0) return 0
  return props.visibleColumns.filter(field => !shouldShowColumn(field)).length
})

// Get column style with width
const getColumnStyle = (col: ColumnType) => {
  return { width: props.columnWidths[col.field] || col.width || 'auto' }
}

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
  const viewLabel = props.viewType === 'projects' ? 'projects' 
    : props.viewType === 'people' ? 'people' 
    : 'items'
  if (props.totalCount !== null && props.totalCount !== undefined) {
    return `${loaded.toLocaleString()} of ${props.totalCount.toLocaleString()} ${viewLabel}`
  }
  return `${loaded.toLocaleString()} ${viewLabel}`
})

const handleRowClick = (event: { data: DataItem }) => {
  emit('rowClick', event.data)
}

const handleColumnReorder = (event: any) => {
  const newOrder = event.columns.map((col: any) => col.props.field)
  emit('update:columnOrder', newOrder)
}

const handleSort = (event: any) => {
  // Prevent sort during/right after column resize
  if (isResizing.value) return
  
  // PrimeVue sort event: { sortField: string, sortOrder: 1 | -1 | 0 }
  const field = event.sortField
  const order = event.sortOrder === 1 ? 'asc' : 'desc'
  
  // If sortOrder is 0 (removed), default to sort_date desc
  if (event.sortOrder === 0 || !field) {
    emit('sort', { field: 'sort_date', order: 'desc' })
  } else {
    emit('sort', { field, order })
  }
}

// Track column resize to prevent sort trigger
const handleResizeStart = () => {
  isResizing.value = true
  if (resizeTimeout) clearTimeout(resizeTimeout)
}

const handleResizeEnd = () => {
  // Delay resetting to prevent sort from firing on mouseup
  resizeTimeout = window.setTimeout(() => {
    isResizing.value = false
  }, 100)
}

const getCellComponent = (field: string, data: DataItem) => {
  const value = data[field]

  // Type field is rendered separately in frozen column
  if (field === 'type') {
    return h('span', '—')
  }

  // Task type column (separate from type)
  if (field === 'task_type_name' && value) {
    const color = data.task_type_color || '#6366f1'
    return h('div', { class: 'task-type-cell' }, [
      h('span', { 
        class: 'task-type-dot',
        style: { background: color }
      }),
      h('span', value)
    ])
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

// Type badge helpers for clickable badges
const getTypeBadgeText = (item: ViewDataItem): string => {
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'EMAIL'
  if (itemType === 'craft') return 'CRAFT'
  return item.task_type_name?.toUpperCase() || 'TASK'
}

const getTypeBadgeStyle = (item: ViewDataItem) => {
  const itemType = item.type?.toLowerCase()
  const isEmail = itemType === 'email'
  const isCraft = itemType === 'craft'
  const color = isEmail ? emailColor.value : isCraft ? craftColor.value : (item.task_type_color || '#4ade80')
  return {
    background: `${color}20`,
    color: color,
    borderColor: `${color}40`
  }
}

const getItemPrimaryUrl = (item: ViewDataItem): string => {
  // Return the most relevant URL for this item type
  if (item.teamwork_url) return item.teamwork_url
  if (item.missive_url) return item.missive_url
  if (item.craft_url) return item.craft_url
  return '#'
}

const getTypeBadgeTooltip = (item: ViewDataItem): string => {
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'Open in Missive'
  if (itemType === 'craft') return 'Open in Craft'
  return 'Open in Teamwork'
}

// Gallery view helpers
const getGalleryIcon = (item: ViewDataItem): string => {
  if (props.viewType === 'projects') {
    return 'pi pi-folder'
  }
  if (props.viewType === 'people') {
    return item.is_company ? 'pi pi-building' : 'pi pi-user'
  }
  // Items view
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'pi pi-envelope'
  if (itemType === 'craft') return 'pi pi-file-edit'
  return 'pi pi-check-square'
}


const getGalleryTitle = (item: ViewDataItem): string => {
  if (props.viewType === 'people') {
    return item.display_name || 'Unknown'
  }
  return item.name || 'Untitled'
}

const getGalleryDescription = (item: ViewDataItem): string => {
  if (props.viewType === 'people') {
    return item.notes || item.primary_email || ''
  }
  return item.description || ''
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
  /* Bounded height: viewport minus page header (~80px), filter bar (~150px), padding */
  max-height: calc(100vh - 280px);
  min-height: 400px;
}

.table-toolbar {
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

/* Match toolbar inputs to filter bar inputs (34px / 2.125rem) */
:deep(.toolbar-input.p-inputtext),
:deep(.toolbar-input.p-multiselect) {
  height: 2.125rem !important;
  min-height: 2.125rem !important;
  padding: 0.5rem 0.75rem !important;
  font-size: 0.9rem !important;
}

.column-selector-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.column-selector {
  min-width: 280px;
}

.hidden-columns-hint {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.item-type-toggles {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.5rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.item-type-toggles.no-bg {
  background: transparent;
  padding: 0;
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

/* Unified item type checkbox styling */
.task-type-checkbox,
.email-checkbox,
.craft-checkbox {
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.task-type-checkbox-inner,
.email-checkbox-inner,
.craft-checkbox-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-type-color-bar,
.email-color-bar,
.craft-color-bar {
  display: block;
  height: 3px;
  width: 100%;
  border-radius: 2px;
}

.type-divider {
  width: 1px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 0.25rem;
}

.results-count {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 1px solid var(--text-disabled);
}

.results-count.no-border {
  margin-left: 0;
  padding-left: 0;
  border-left: none;
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

/* Table scroll container - handles both horizontal and vertical scroll */
.table-scroll-container {
  overflow: auto;
  flex: 1;
  min-width: 0;
  min-height: 0; /* Important for flex overflow */
}

.data-table {
  width: max-content;
  min-width: 100%;
}

.data-table :deep(.p-datatable-wrapper) {
  overflow: visible !important;
}

.data-table :deep(.p-datatable) {
  overflow: visible !important;
}

.data-table :deep(.p-datatable-table) {
  table-layout: auto;
  min-width: 100%;
}

.data-table :deep(.p-datatable-thead > tr > th),
.data-table :deep(.p-datatable-tbody > tr > td) {
  overflow: hidden;
  text-overflow: ellipsis;
  word-wrap: break-word;
}

.data-table :deep(.p-datatable-thead) {
  position: sticky !important;
  top: 0 !important;
  z-index: 100 !important;
}

.data-table :deep(.p-datatable-thead > tr > th) {
  padding: 1.25rem 1rem !important;
  background: var(--bg-tertiary) !important;
  border-color: var(--border-primary) !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}

/* Type column - frozen, not resizable */
.data-table :deep(.type-column) {
  position: sticky !important;
  left: 0 !important;
  z-index: 101 !important;
  background: var(--bg-secondary) !important;
}

.data-table :deep(.p-datatable-thead .type-column) {
  z-index: 102 !important;
}

/* Disable resize handle on type column */
.data-table :deep(.type-column .p-column-resizer) {
  display: none !important;
}

/* Fix column resize indicator position */
.data-table :deep(.p-column-resizer-helper) {
  position: absolute !important;
  width: 2px !important;
  background: var(--accent-primary) !important;
}

/* Ensure resize handle is positioned correctly */
.data-table :deep(.p-column-resizer) {
  position: absolute !important;
  right: 0 !important;
  top: 0 !important;
  width: 8px !important;
  height: 100% !important;
  cursor: col-resize !important;
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

/* Type Badge Link - clickable badge */
.type-badge-link {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.type-badge-link:hover {
  transform: scale(1.08);
  filter: brightness(1.15);
}

/* Task Type Cell */
.task-type-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
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

/* Gallery type badge link - clickable */
.gallery-type-badge-link {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.gallery-type-badge-link:hover {
  transform: scale(1.08);
  filter: brightness(1.15);
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

.meta-item.internal {
  background: rgba(245, 166, 35, 0.2);
  color: #f5a623;
}

.scroll-trigger {
  height: 20px;
  margin: 1rem 0;
}

</style>

