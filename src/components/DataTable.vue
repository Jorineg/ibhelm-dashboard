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
      :sort-field="props.sortConfig?.field"
      :sort-order="props.sortConfig?.order === 'asc' ? 1 : -1"
      removable-sort
      @row-click="handleRowClick"
      @column-reorder="handleColumnReorder"
      @column-resize-end="handleColumnResize"
      @sort="handleSort"
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

      <!-- Source Link Buttons Column (frozen on left, only for items view) -->
      <Column
        v-if="props.viewType === 'items' || !props.viewType"
        frozen
        :style="{ width: '70px', minWidth: '70px', maxWidth: '70px' }"
        header=""
        class="source-links-column"
      >
        <template #body="{ data }">
          <div class="source-links-cell" @click.stop>
            <a
              v-if="data.teamwork_url"
              :href="data.teamwork_url"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link-btn"
              :style="getSourceLinkStyle(data)"
              title="Open in Teamwork"
            >
              <i class="pi pi-check-square"></i>
            </a>
            <a
              v-if="data.missive_url"
              :href="data.missive_url"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link-btn"
              :style="getSourceLinkStyle(data)"
              title="Open in Missive"
            >
              <i class="pi pi-envelope"></i>
            </a>
            <a
              v-if="data.craft_url"
              :href="data.craft_url"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link-btn"
              :style="getSourceLinkStyle(data)"
              title="Open in Craft"
            >
              <i class="pi pi-file-edit"></i>
            </a>
          </div>
        </template>
      </Column>

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
            <span
              v-if="props.viewType === 'items' || !props.viewType"
              class="gallery-type-badge"
              :style="getGalleryTypeBadgeStyle(item)"
            >
              {{ getGalleryTypeBadgeText(item) }}
            </span>
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
            <div v-if="props.viewType === 'items' || !props.viewType" class="gallery-item-links" @click.stop>
              <a
                v-if="item.teamwork_url"
                :href="item.teamwork_url"
                target="_blank"
                rel="noopener noreferrer"
                class="source-link-btn"
                :style="getSourceLinkStyle(item)"
                title="Open in Teamwork"
              >
                <i class="pi pi-check-square"></i>
              </a>
              <a
                v-if="item.missive_url"
                :href="item.missive_url"
                target="_blank"
                rel="noopener noreferrer"
                class="source-link-btn"
                :style="getSourceLinkStyle(item)"
                title="Open in Missive"
              >
                <i class="pi pi-envelope"></i>
              </a>
              <a
                v-if="item.craft_url"
                :href="item.craft_url"
                target="_blank"
                rel="noopener noreferrer"
                class="source-link-btn"
                :style="getSourceLinkStyle(item)"
                title="Open in Craft"
              >
                <i class="pi pi-file-edit"></i>
              </a>
            </div>
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

const handleColumnResize = (event: any) => {
  const field = event.element.getAttribute('data-p-field') || event.element.querySelector('[data-p-field]')?.getAttribute('data-p-field')
  
  if (field) {
    const newWidths = { ...props.columnWidths }
    newWidths[field] = event.element.style.width
    emit('update:columnWidths', newWidths)
  }
}

const handleSort = (event: any) => {
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

const getCellComponent = (field: string, data: DataItem) => {
  const value = data[field]

  // Special rendering for type field - shows task_type_name if available
  if (field === 'type') {
    const itemType = value?.toLowerCase()
    const isEmail = itemType === 'email'
    const isCraft = itemType === 'craft'
    const displayValue = isEmail ? 'EMAIL' : isCraft ? 'CRAFT' : (data.task_type_name?.toUpperCase() || 'TASK')
    const color = isEmail ? emailColor.value : isCraft ? craftColor.value : (data.task_type_color || '#4ade80')
    
    return h('span', {
      class: 'type-badge',
      style: { 
        background: `${color}20`,
        color: color,
        borderColor: `${color}40`
      }
    }, displayValue)
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

const getGalleryTypeBadgeStyle = (item: ViewDataItem) => {
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

// Get link button style based on task type color
const getSourceLinkStyle = (item: ViewDataItem) => {
  const itemType = item.type?.toLowerCase()
  const isEmail = itemType === 'email'
  const isCraft = itemType === 'craft'
  const color = isEmail ? emailColor.value : isCraft ? craftColor.value : (item.task_type_color || '#4ade80')
  return {
    background: `${color}15`,
    color: color,
    borderColor: `${color}30`
  }
}

const getGalleryTypeBadgeText = (item: ViewDataItem): string => {
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'EMAIL'
  if (itemType === 'craft') return 'CRAFT'
  return item.task_type_name?.toUpperCase() || 'TASK'
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

.task-type-checkbox {
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.task-type-checkbox-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-type-checkbox .toggle-item-label {
  margin-left: 0;
}

.task-type-color-bar {
  display: block;
  height: 3px;
  width: 100%;
  border-radius: 2px;
}

.email-checkbox {
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.email-checkbox-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.email-color-bar {
  display: block;
  height: 3px;
  width: 100%;
  border-radius: 2px;
}

.craft-checkbox {
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.craft-checkbox-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

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

/* Type Badge */
.type-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
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

.gallery-type-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
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

/* Source Links Column */
.source-links-column {
  background: var(--bg-secondary) !important;
}

.source-links-cell {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  justify-content: center;
}

.source-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
  font-size: 1rem;
  border: 1px solid;
}

.source-link-btn:hover {
  transform: scale(1.12);
  filter: brightness(1.15);
}

/* Gallery View Source Links */
.gallery-item-links {
  display: flex;
  gap: 0.5rem;
}
</style>

