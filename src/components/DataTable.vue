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
          <InfoTooltip position="bottom">
            <strong>Searches in:</strong>
            <ul>
              <li>Name, subject, filename, title</li>
              <li>Description &amp; preview</li>
              <li>Email body &amp; craft markdown</li>
              <li>File extracted text (PDF, etc.)</li>
              <li>Conversation comments</li>
            </ul>
          </InfoTooltip>
        </div>
        
        <!-- Project Filter (people view only) -->
        <div v-if="props.viewType === 'people'" class="project-filter-wrapper">
          <AutocompleteInput
            :model-value="props.projectFilter || ''"
            :suggestions="projectSuggestions"
            :loading="projectLoading"
            placeholder="Filter by project..."
            primary-field="name"
            secondary-field="company_name"
            @update:model-value="(value: string) => emit('update:projectFilter', value)"
            @search="handleProjectSearch"
            @select="handleProjectSelect"
            @clear="handleProjectClear"
          >
            <template #option="{ suggestion }">
              <div class="project-option">
                <span class="project-name">{{ suggestion.name }}</span>
                <span v-if="suggestion.company_name" class="project-company">{{ suggestion.company_name }}</span>
                <span v-if="suggestion.status" class="project-status" :class="suggestion.status">{{ suggestion.status }}</span>
              </div>
            </template>
          </AutocompleteInput>
        </div>
        
        <div class="item-type-toggles" :class="{ 'no-bg': props.viewType === 'items' || !props.viewType }">
          <template v-if="props.viewType === 'items' || !props.viewType">
            
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
            
            <div class="checkbox-group file-checkbox">
              <div class="file-checkbox-inner">
                <Checkbox
                  v-model="localShowFiles"
                  input-id="show-files"
                  :binary="true"
                />
                <label for="show-files" class="toggle-item-label">Files</label>
              </div>
              <span 
                class="file-color-bar"
                :style="{ backgroundColor: fileColor }"
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
          :max-selected-labels="0"
          class="column-selector"
        >
          <template #value>
            <span>{{ localVisibleColumns.length }} columns selected</span>
            <span v-if="hiddenEmptyColumnsCount > 0" class="hidden-columns-hint">
              ({{ hiddenEmptyColumnsCount }} empty columns hidden)
            </span>
          </template>
        </MultiSelect>
      </div>

      <div class="toolbar-right">
        <Button
          icon="pi pi-download"
          text
          rounded
          class="export-btn"
          :loading="props.exporting"
          @click="emit('export')"
          title="Export to Excel"
        />
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

    <!-- Loading overlay - positioned outside scroll container -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner loading-icon"></i>
        <p>Loading data...</p>
      </div>
    </div>

    <!-- List View -->
    <div v-show="localViewMode === 'list'" class="table-scroll-container" ref="scrollContainerRef">
      <DataTablePrime
        ref="dataTableRef"
        :value="displayedItems"
        striped-rows
        :paginator="false"
        :rows="displayedItems.length"
        :reorderable-columns="true"
        removable-sort
        :row-class="getRowClass"
        @row-click="handleRowClick"
        @column-reorder="handleColumnReorder"
        @sort="handleSort"
        @column-resize-start="handleResizeStart"
        @column-resize-end="handleResizeEnd"
        class="data-table"
        :class="{ 'is-resizing': isResizing }"
        :resizable-columns="true"
        column-resize-mode="expand"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-inbox empty-icon"></i>
            <p>No items found</p>
          </div>
        </template>


        <!-- Type Column (frozen on left, all views) -->
        <Column
          field="type"
          header="Type"
          frozen
          :sortable="false"
          :reorderable-column="false"
          :style="{ width: '90px', minWidth: '90px', maxWidth: '90px' }"
          class="type-column"
        >
          <template #body="{ data }">
            <a
              :href="getRowPrimaryUrl(data)"
              :target="getRowLinkTarget(data)"
              rel="noopener noreferrer"
              class="type-badge-link"
              :style="getTypeBadgeStyle(data)"
              :title="getTypeBadgeTooltip(data)"
              @click="handleTypeBadgeClick($event, data)"
            >
              {{ getTypeBadgeText(data) }}
            </a>
          </template>
        </Column>

        <Column
          v-for="col in orderedVisibleColumnsWithoutType"
          :key="col.field"
          :field="col.field"
          :sortable="false"
          :style="getColumnStyle(col)"
        >
          <template #header>
            <div 
              class="custom-sort-header" 
              :class="{ sortable: col.sortable !== false }"
              @click="col.sortable !== false && handleHeaderClick(col.field)"
            >
              <span class="column-header-text">{{ col.header }}</span>
              <i v-if="col.sortable !== false" :class="['sort-icon', getSortIcon(col.field)]" />
            </div>
          </template>
          <template #body="{ data }">
            <component
              :is="getCellComponent(col.field, data)"
              :data="data"
              :field="col.field"
            />
          </template>
        </Column>
      </DataTablePrime>
      <!-- Infinite scroll trigger for list view -->
      <div ref="scrollTrigger" class="scroll-trigger"></div>
    </div>

    <!-- Gallery View -->
    <div v-show="localViewMode === 'gallery'" class="gallery-view" ref="galleryViewRef">
      <div class="gallery-grid" ref="galleryGridRef">
        <div
          v-for="(item, index) in displayedItems"
          :key="item.id"
          class="gallery-item"
          :class="{ 'keyboard-selected': index === props.selectedRow }"
          @click="handleRowClick({ data: item })"
        >
          <div class="gallery-item-header">
            <a
              :href="getRowPrimaryUrl(item)"
              :target="getRowLinkTarget(item)"
              rel="noopener noreferrer"
              class="gallery-type-badge-link"
              :style="getTypeBadgeStyle(item)"
              :title="getTypeBadgeTooltip(item)"
              @click="handleTypeBadgeClick($event, item)"
            >
              {{ getTypeBadgeText(item) }}
            </a>
          </div>
          <div class="gallery-item-thumbnail">
            <img
              v-if="shouldShowThumbnail(item)"
              :src="getThumbnailUrl(item.thumbnail_path!)"
              :alt="item.name"
              loading="lazy"
              class="gallery-thumbnail-img"
              @error="() => handleThumbnailError(item.thumbnail_path!)"
            />
            <i
              v-else
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
      <!-- Infinite scroll trigger for gallery view -->
      <div ref="galleryScrollTrigger" class="scroll-trigger"></div>
    </div>
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
import { InfoTooltip, AutocompleteInput } from '@/components/common'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { useProjectAutocomplete, type ProjectSuggestion } from '@/composables/useAutocomplete'
import { supabase } from '@/lib/supabase'
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
  showFiles: boolean
  viewMode: 'list' | 'gallery'
  searchQuery: string
  totalCount?: number | null
  sortConfig?: SortConfig
  viewType?: ViewType
  // Task type filters
  selectedTaskTypes?: string[]
  // Keyboard navigation
  selectedRow?: number
  selectedCol?: number
  // Export state
  exporting?: boolean
  // Filter config ID to track config changes
  filterConfigId?: string
  // Project filter for people view
  projectFilter?: string
}

interface Emits {
  (e: 'update:visibleColumns', value: string[]): void
  (e: 'update:columnOrder', value: string[]): void
  (e: 'update:columnWidths', value: Record<string, string>): void
  (e: 'update:showTasks', value: boolean): void
  (e: 'update:showEmails', value: boolean): void
  (e: 'update:showCraft', value: boolean): void
  (e: 'update:showFiles', value: boolean): void
  (e: 'update:viewMode', value: 'list' | 'gallery'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:selectedTaskTypes', value: string[]): void
  (e: 'update:selectedRow', value: number): void
  (e: 'update:selectedCol', value: number): void
  (e: 'update:projectFilter', value: string): void
  (e: 'clearSearch'): void
  (e: 'rowClick', item: DataItem): void
  (e: 'loadMore'): void
  (e: 'sort', sortConfig: SortConfig): void
  (e: 'export'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Task types from composable
const { taskTypes, initialize: initTaskTypes } = useTaskTypes()

// Appearance settings from composable
const { emailColor, craftColor, fileColor, craftSpaceId, personColor, projectColor, teamworkBaseUrl, filesBucket, initialize: initAppearance } = useAppearanceSettings()

// Project autocomplete for people view
const { suggestions: projectSuggestions, loading: projectLoading, search: searchProjects, clear: clearProjectSuggestions } = useProjectAutocomplete()

const handleProjectSearch = (searchText: string) => searchProjects(searchText)
const handleProjectSelect = (suggestion: ProjectSuggestion) => emit('update:projectFilter', suggestion.name)
const handleProjectClear = () => { emit('update:projectFilter', ''); clearProjectSuggestions() }

// Transform craft URL to include space ID
const transformCraftUrl = (url: string): string => {
  if (!url || !craftSpaceId.value) return url
  // URL format: craftdocs://open?blockId=xxx → craftdocs://open?spaceId=yyy&blockId=xxx
  const blockIdMatch = url.match(/blockId=([^&]+)/)
  if (!blockIdMatch) return url
  return `craftdocs://open?spaceId=${craftSpaceId.value}&blockId=${blockIdMatch[1]}`
}

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
const galleryScrollTrigger = ref<HTMLElement | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)
const dataTableRef = ref<InstanceType<typeof DataTablePrime> | null>(null)
const searchInputRef = ref<HTMLElement | null>(null)
const galleryGridRef = ref<HTMLElement | null>(null)
const galleryViewRef = ref<HTMLElement | null>(null)
const isResizing = ref(false)
let resizeTimeout: number | null = null

// Cache columns that have data to preserve visibility during loading
const cachedColumnsWithData = ref<Set<string>>(new Set())
const lastFilterConfigId = ref<string | undefined>(undefined)

// Expose methods for parent component
const focusSearch = () => {
  // PrimeVue InputText wraps the input, so we need to find it within the wrapper
  const wrapper = document.querySelector('.search-wrapper')
  const input = wrapper?.querySelector('input') as HTMLInputElement
  input?.focus()
}

const scrollToSelectedCell = () => {
  if (props.selectedRow === undefined || props.selectedRow < 0) return
  const rows = scrollContainerRef.value?.querySelectorAll('.p-datatable-tbody > tr')
  if (rows && rows[props.selectedRow]) {
    rows[props.selectedRow].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

const scrollHorizontal = (direction: 'left' | 'right') => {
  if (!scrollContainerRef.value) return
  const scrollAmount = 200
  scrollContainerRef.value.scrollBy({
    left: direction === 'right' ? scrollAmount : -scrollAmount,
    behavior: 'smooth'
  })
}

// Get number of columns in gallery grid
const getGalleryColumns = (): number => {
  if (!galleryGridRef.value || displayedItems.value.length === 0) return 1
  const gridStyle = window.getComputedStyle(galleryGridRef.value)
  const columns = gridStyle.gridTemplateColumns.split(' ').length
  return columns || 1
}

// Scroll to selected gallery item
const scrollToSelectedGalleryItem = () => {
  if (props.selectedRow === undefined || props.selectedRow < 0) return
  if (!galleryGridRef.value) return
  const items = galleryGridRef.value.querySelectorAll('.gallery-item')
  if (items && items[props.selectedRow]) {
    items[props.selectedRow].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

defineExpose({ focusSearch, scrollToSelectedCell, scrollHorizontal, getGalleryColumns, scrollToSelectedGalleryItem })

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

const localShowFiles = computed({
  get: () => props.showFiles,
  set: (value) => emit('update:showFiles', value)
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
  // During loading with same config, use cached visibility
  if (props.loading && props.items.length === 0 && props.filterConfigId === lastFilterConfigId.value) {
    return props.visibleColumns.filter(field => !cachedColumnsWithData.value.has(field)).length
  }
  if (props.items.length === 0) return 0
  return props.visibleColumns.filter(field => !shouldShowColumn(field)).length
})

// Get column style with width - use maxWidth to prevent columns from expanding with few columns
const getColumnStyle = (col: ColumnType) => {
  const width = props.columnWidths[col.field] || col.width || '150px'
  return { width, maxWidth: width }
}

// Check if column should be shown based on data
const shouldShowColumn = (field: string): boolean => {
  // If loading and same filter config, use cached visibility
  if (props.loading && props.items.length === 0 && props.filterConfigId === lastFilterConfigId.value) {
    return cachedColumnsWithData.value.has(field)
  }
  
  // If no items (new config or initial load), show all columns
  if (props.items.length === 0) return true

  // Check if any item has a non-empty value for this field
  return props.items.some(item => {
    const value = item[field]
    return value !== null && value !== undefined && value !== ''
  })
}

// Update cache when items change with actual data
watch(() => props.items, (items) => {
  if (items.length > 0) {
    // Update cached columns that have data
    const columnsWithData = new Set<string>()
    props.columns.forEach(col => {
      const hasData = items.some(item => {
        const value = item[col.field]
        return value !== null && value !== undefined && value !== ''
      })
      if (hasData) columnsWithData.add(col.field)
    })
    cachedColumnsWithData.value = columnsWithData
    lastFilterConfigId.value = props.filterConfigId
  }
}, { immediate: true })

// Reset cache when filter config changes
watch(() => props.filterConfigId, (newId, oldId) => {
  if (newId !== oldId && oldId !== undefined) {
    // Config changed, clear cache so all columns show until new data loads
    cachedColumnsWithData.value = new Set()
  }
})

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

// Row class for keyboard selection
const getRowClass = (data: ViewDataItem) => {
  if (props.selectedRow === undefined || props.selectedRow < 0) return ''
  const index = displayedItems.value.indexOf(data)
  return index === props.selectedRow ? 'keyboard-selected' : ''
}

const handleColumnReorder = (event: any) => {
  const { dragIndex, dropIndex } = event
  if (dragIndex === undefined || dropIndex === undefined) return
  
  // Account for frozen type column (index 0) if in items view
  const hasTypeColumn = props.viewType === 'items' || !props.viewType
  const offset = hasTypeColumn ? 1 : 0
  const adjustedDragIndex = dragIndex - offset
  const adjustedDropIndex = dropIndex - offset
  
  // Get current visible column order and apply the drag/drop
  const currentOrder = [...orderedVisibleColumnsWithoutType.value.map(c => c.field)]
  
  if (adjustedDragIndex < 0 || adjustedDropIndex < 0 || adjustedDragIndex >= currentOrder.length) return
  
  const [moved] = currentOrder.splice(adjustedDragIndex, 1)
  currentOrder.splice(adjustedDropIndex, 0, moved)
  
  // Merge with hidden columns (preserve their positions at the end)
  const visibleSet = new Set(currentOrder)
  const hiddenColumns = props.columnOrder.filter(f => !visibleSet.has(f))
  
  emit('update:columnOrder', [...currentOrder, ...hiddenColumns])
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

// Custom header click handler for sorting (bypasses PrimeVue's internal sorting)
const handleHeaderClick = (field: string) => {
  if (isResizing.value) return
  
  // Toggle sort order: if same field, flip direction; if different field, start with asc
  const currentField = props.sortConfig?.field
  const currentOrder = props.sortConfig?.order
  
  if (currentField === field) {
    // Same field - toggle or remove
    if (currentOrder === 'asc') {
      emit('sort', { field, order: 'desc' })
    } else {
      // Was desc, remove sort (default to sort_date desc)
      emit('sort', { field: 'sort_date', order: 'desc' })
    }
  } else {
    // New field - start with asc
    emit('sort', { field, order: 'asc' })
  }
}

// Track column resize to prevent sort trigger
const handleResizeStart = () => {
  isResizing.value = true
  if (resizeTimeout) clearTimeout(resizeTimeout)
}

const handleResizeEnd = () => {
  // Delay resetting to prevent sort from firing on mouseup
  // 200ms gives enough buffer for the click event to be blocked
  resizeTimeout = window.setTimeout(() => {
    isResizing.value = false
  }, 200)
}

// Sort icon helper for custom header templates
const getSortIcon = (field: string) => {
  if (props.sortConfig?.field !== field) return 'pi pi-sort-alt'
  return props.sortConfig.order === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'
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

  // Recipients column - render as email tags
  if (field === 'recipients' && Array.isArray(value) && value.length > 0) {
    const emails = value
      .map(r => r.contact?.email)
      .filter((email): email is string => !!email)
    if (emails.length === 0) return h('span', '—')
    return h('div', { class: 'recipients-tags' }, 
      emails.map((email, idx) => h('span', { key: idx, class: 'recipient-tag' }, email))
    )
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
  if (props.viewType === 'people') return 'PERSON'
  if (props.viewType === 'projects') return 'PROJECT'
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'EMAIL'
  if (itemType === 'craft') return 'CRAFT'
  if (itemType === 'file') return 'FILE'
  return item.task_type_name?.toUpperCase() || 'TASK'
}

const getTypeBadgeStyle = (item: ViewDataItem) => {
  if (props.viewType === 'people') {
    const color = personColor.value
    return { background: `${color}20`, color, borderColor: `${color}40` }
  }
  if (props.viewType === 'projects') {
    const color = projectColor.value
    return { background: `${color}20`, color, borderColor: `${color}40` }
  }
  const itemType = item.type?.toLowerCase()
  const isEmail = itemType === 'email'
  const isCraft = itemType === 'craft'
  const isFile = itemType === 'file'
  const color = isEmail ? emailColor.value : isCraft ? craftColor.value : isFile ? fileColor.value : (item.task_type_color || '#4ade80')
  return { background: `${color}20`, color, borderColor: `${color}40` }
}

const getRowPrimaryUrl = (item: ViewDataItem): string => {
  if (props.viewType === 'people') {
    const email = item.primary_email
    return email ? `mailto:${email}` : '#'
  }
  if (props.viewType === 'projects') {
    const baseUrl = teamworkBaseUrl.value
    const projectId = item.id
    return baseUrl && projectId ? `${baseUrl.replace(/\/$/, '')}/app/projects/${projectId}` : '#'
  }
  // Items view
  if (item.teamwork_url) return item.teamwork_url
  if (item.missive_url) return item.missive_url
  if (item.craft_url) return transformCraftUrl(item.craft_url)
  // Files are handled by click handler, use javascript:void(0) to prevent navigation
  if (item.type?.toLowerCase() === 'file') return 'javascript:void(0)'
  return '#'
}

const getRowLinkTarget = (item: ViewDataItem): string => {
  if (props.viewType === 'people') return '_self' // mailto opens in same context
  return '_blank'
}

const getTypeBadgeTooltip = (item: ViewDataItem): string => {
  if (props.viewType === 'people') {
    const email = item.primary_email
    return email ? `Send email to ${email}` : 'No email available'
  }
  if (props.viewType === 'projects') {
    return teamworkBaseUrl.value ? 'Open in Teamwork' : 'Set Teamwork Base URL in Settings'
  }
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'Open in Missive'
  if (itemType === 'craft') return 'Open in Craft'
  if (itemType === 'file') return 'Open file'
  return 'Open in Teamwork'
}

// Handle type badge click - special handling for files
const handleTypeBadgeClick = async (event: MouseEvent, item: ViewDataItem) => {
  event.stopPropagation()
  
  const itemType = item.type?.toLowerCase()
  
  // For files, generate signed URL and open
  if (itemType === 'file') {
    event.preventDefault()
    
    if (!item.storage_path) {
      console.error('File has no storage_path:', item)
      return
    }
    
    const { data, error } = await supabase.storage
      .from(filesBucket.value)
      .createSignedUrl(item.storage_path, 300) // 5 minute expiry
    
    if (error) {
      console.error('Error generating signed URL:', error)
      return
    }
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
    return
  }
  
  // For non-files, let the default link behavior happen (href is set)
}

// Thumbnail URL helper - public bucket
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const getThumbnailUrl = (thumbnailPath: string): string => {
  return `${supabaseUrl}/storage/v1/object/public/thumbnails/${thumbnailPath}`
}

// Track failed thumbnails to show fallback icon
const failedThumbnails = ref(new Set<string>())
const handleThumbnailError = (thumbnailPath: string) => {
  failedThumbnails.value.add(thumbnailPath)
}
const shouldShowThumbnail = (item: ViewDataItem): boolean => {
  return !!item.thumbnail_path && !failedThumbnails.value.has(item.thumbnail_path)
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
  if (itemType === 'file') return 'pi pi-file'
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

const setupIntersectionObserver = () => {
  if (observer) {
    observer.disconnect()
  }
  
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some(e => e.isIntersecting) && !props.loading) {
        emit('loadMore')
      }
    },
    { threshold: 0.1 }
  )
  
  // Observe whichever trigger is currently rendered
  if (scrollTrigger.value) {
    observer.observe(scrollTrigger.value)
  }
  if (galleryScrollTrigger.value) {
    observer.observe(galleryScrollTrigger.value)
  }
}

onMounted(() => {
  setupIntersectionObserver()
})

// Re-setup observer when view mode changes
watch(() => localViewMode.value, () => {
  // Wait for DOM to update
  setTimeout(setupIntersectionObserver, 100)
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
  /* Fill available space */
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

/* Loading overlay - stays fixed in visible area */
.loading-overlay {
  position: absolute;
  inset: 0;
  top: 80px; /* Below toolbar */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(42, 42, 42, 0.85);
  z-index: 50;
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
  position: relative;
  z-index: 150;
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
  gap: 0.5rem;
}

.export-btn {
  color: var(--text-secondary) !important;
}

.export-btn:hover {
  color: var(--text-primary) !important;
}

/* Match toolbar inputs to filter bar inputs (34px / 2.125rem) */
:deep(.toolbar-input.p-inputtext),
:deep(.toolbar-input.p-multiselect) {
  height: 2.125rem !important;
  min-height: 2.125rem !important;
  padding: 0.5rem 0.75rem !important;
  font-size: 0.9rem !important;
}


.column-selector {
  min-width: 200px;
}

.hidden-columns-hint {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  margin-left: 0.5rem;
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
.craft-checkbox,
.file-checkbox {
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.task-type-checkbox-inner,
.email-checkbox-inner,
.craft-checkbox-inner,
.file-checkbox-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-type-color-bar,
.email-color-bar,
.craft-color-bar,
.file-color-bar {
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
  width: 210px;
}

.search-wrapper > :deep(.info-tooltip-wrapper) {
  position: absolute;
  right: 0.5rem;
  z-index: 1;
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
  padding-right: 3.25rem !important;
}

.clear-search {
  position: absolute;
  right: 1.5rem;
}

/* Project filter for people view */
.project-filter-wrapper {
  width: 220px;
}

.project-filter-wrapper :deep(.autocomplete-input) {
  font-size: 0.95rem !important;
}

.project-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.project-name {
  color: var(--text-primary);
  font-weight: 500;
}

.project-company {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.project-status {
  margin-left: auto;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.project-status.active {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.project-status.completed {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-tertiary);
}

/* Table scroll container - handles both horizontal and vertical scroll */
.table-scroll-container {
  overflow: auto;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
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

/* Ensure columns respect their set widths */
.data-table :deep(.p-datatable-thead > tr > th),
.data-table :deep(.p-datatable-tbody > tr > td) {
  overflow: hidden;
  text-overflow: ellipsis;
  word-wrap: break-word;
  box-sizing: border-box;
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

/* Prevent sort clicks during column resize */
.data-table.is-resizing :deep(.p-datatable-thead > tr > th) {
  pointer-events: none !important;
}

/* But allow the resize handle itself to work */
.data-table.is-resizing :deep(.p-column-resizer) {
  pointer-events: auto !important;
}

/* Type column - frozen, not resizable */
.data-table :deep(.type-column) {
  position: sticky !important;
  left: 0 !important;
  z-index: 2 !important;
}

/* Type column in header - must be above both thead (z-index 100) and body type cells */
.data-table :deep(.p-datatable-thead .type-column) {
  z-index: 110 !important;
}

/* Type column body - inherit row background for striping/hover */
.data-table :deep(.p-datatable-tbody > tr > .type-column) {
  background: inherit !important;
}

/* Disable resize handle on type column */
.data-table :deep(.type-column .p-column-resizer) {
  display: none !important;
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

/* Recipients tags */
.recipients-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.recipient-tag {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
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
  flex: 1 1 0;
  min-height: 0;
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

.gallery-item.keyboard-selected {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  background: var(--accent-primary-dark);
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
  overflow: hidden;
}

.gallery-thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

/* Keyboard navigation selection */
.data-table :deep(.p-datatable-tbody > tr.keyboard-selected) {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
  background: var(--accent-primary-dark) !important;
}

.data-table :deep(.p-datatable-tbody > tr.keyboard-selected > td) {
  background: inherit !important;
}

/* Custom sort header */
.custom-sort-header {
  display: flex;
  align-items: center;
  width: 100%;
}

.custom-sort-header.sortable {
  cursor: pointer;
}

.custom-sort-header.sortable:hover .sort-icon {
  color: var(--text-secondary);
}

.column-header-text {
  margin-right: 0.5rem;
}

.sort-icon {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.sort-icon.pi-sort-amount-up-alt,
.sort-icon.pi-sort-amount-down {
  color: var(--accent-primary);
}

</style>

<!-- Unscoped styles for elements appended to body (like resize helper) -->
<style>
.p-column-resizer-helper {
  width: 2px !important;
  background: var(--accent-primary) !important;
  z-index: 9999 !important;
}
</style>

