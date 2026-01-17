<template>
  <div class="data-table-wrapper" :style="props.stickyToolbar ? { '--toolbar-height': toolbarHeight + 'px' } : undefined">
    <!-- Column visibility selector -->
    <div class="table-toolbar" :class="{ 'wide-view': props.viewType === 'projects' || props.viewType === 'people', 'table-toolbar--sticky': props.stickyToolbar }" ref="toolbarRef">
      <div class="toolbar-left">
        <!-- Search Bar -->
        <div class="search-wrapper">
          <Tooltip :shortcuts="searchShortcuts" position="bottom">
            <i class="pi pi-search search-icon" />
          </Tooltip>
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
                <div class="project-meta">
                  <span v-if="suggestion.company_name" class="project-company">{{ suggestion.company_name }}</span>
                  <span v-if="suggestion.status" class="project-status" :class="suggestion.status">{{ suggestion.status }}</span>
                </div>
              </div>
            </template>
          </AutocompleteInput>
        </div>
        
        <div v-if="props.viewType === 'items' || !props.viewType" class="item-type-toggles no-bg">
            <!-- Task type checkboxes -->
            <Tooltip
              v-for="(taskType, idx) in taskTypes" 
              :key="taskType.id"
              :text="`Toggle ${taskType.name}`"
              :shortcut="taskTypeShortcuts[idx]"
              position="bottom"
            >
              <div class="checkbox-group task-type-checkbox">
                <div class="task-type-checkbox-inner">
                  <Checkbox
                    :model-value="isTaskTypeSelected(taskType.id)"
                    @update:model-value="toggleTaskType(taskType.id)"
                    :input-id="`task-type-${taskType.id}`"
                    :binary="true"
                  />
                  <label :for="`task-type-${taskType.id}`" class="toggle-item-label">
                    {{ taskType.name }}
                  </label>
                </div>
                <span 
                  v-if="taskType.color" 
                  class="task-type-color-bar"
                  :style="{ backgroundColor: taskType.color }"
                ></span>
              </div>
            </Tooltip>
            
            <div class="type-divider"></div>
            
            <Tooltip text="Toggle Emails" :shortcut="emailShortcut" position="bottom">
              <div class="checkbox-group email-checkbox">
                <div class="email-checkbox-inner">
                  <Checkbox v-model="localShowEmails" input-id="show-emails" :binary="true" />
                  <label for="show-emails" class="toggle-item-label">Email</label>
                </div>
                <span class="email-color-bar" :style="{ backgroundColor: emailColor }"></span>
              </div>
            </Tooltip>
            
            <Tooltip text="Toggle Craft Docs" :shortcut="craftShortcut" position="bottom">
              <div class="checkbox-group craft-checkbox">
                <div class="craft-checkbox-inner">
                  <Checkbox v-model="localShowCraft" input-id="show-craft" :binary="true" />
                  <label for="show-craft" class="toggle-item-label">Craft</label>
                </div>
                <span class="craft-color-bar" :style="{ backgroundColor: craftColor }"></span>
              </div>
            </Tooltip>
            
            <Tooltip text="Toggle Files" :shortcut="fileShortcut" position="bottom">
              <div class="checkbox-group file-checkbox">
                <div class="file-checkbox-inner">
                  <Checkbox v-model="localShowFiles" input-id="show-files" :binary="true" />
                  <label for="show-files" class="toggle-item-label">Files</label>
                </div>
                <span class="file-color-bar" :style="{ backgroundColor: fileColor }"></span>
              </div>
            </Tooltip>
        </div>
        
        <MultiSelect
          v-model="localVisibleColumns"
          :options="allColumns"
          option-label="header"
          option-value="field"
          :option-disabled="isColumnDisabled"
          placeholder="Select Columns"
          :max-selected-labels="0"
          class="column-selector"
          @selectall-change="handleSelectAllChange"
        >
          <template #value>
            <span>{{ enabledSelectedColumnsCount }} columns selected</span>
          </template>
        </MultiSelect>

        <!-- Group By Dropdown (items view only) -->
        <div v-if="props.viewType === 'items' || !props.viewType" class="group-by-wrapper">
          <Dropdown
            :model-value="props.groupConfig?.field || null"
            :options="groupByOptions"
            option-label="label"
            option-value="field"
            placeholder="Group by..."
            :show-clear="!!props.groupConfig"
            class="group-by-dropdown"
            @update:model-value="handleGroupByChange"
          />
          <Button
            v-if="props.groupConfig"
            :icon="props.groupConfig.order === 'asc' ? 'pi pi-sort-alpha-down' : 'pi pi-sort-alpha-up-alt'"
            text
            rounded
            size="small"
            class="group-order-btn"
            @click="toggleGroupOrder"
            :title="props.groupConfig.order === 'asc' ? 'Ascending (A→Z)' : 'Descending (Z→A)'"
          />
        </div>

        <span class="results-count" :class="{ 'no-border': props.viewType && props.viewType !== 'items' }">
          <span class="results-line">displaying {{ itemCountData.loaded.toLocaleString() }}</span>
          <span class="results-line">of <span v-if="itemCountData.isCountLoading" class="count-shimmer">---</span><span v-else>{{ itemCountData.total?.toLocaleString() ?? '...' }}</span> {{ itemCountData.viewLabel }}</span>
        </span>
        <Tooltip v-if="props.revalidating" text="Refreshing data..." position="bottom">
          <i class="pi pi-spin pi-spinner revalidating-spinner"></i>
        </Tooltip>
      </div>

      <div class="toolbar-right">
        <Tooltip text="Export to Excel">
          <Button
            icon="pi pi-download"
            text
            rounded
            class="export-btn"
            :loading="props.exporting"
            @click="emit('export')"
          />
        </Tooltip>
        <Tooltip text="Toggle View" :shortcut="viewToggleShortcut">
          <SelectButton
            v-model="localViewMode"
            :options="viewModeOptions"
            option-label="label"
            option-value="value"
            class="view-mode-toggle"
            @click="blurActiveElement"
          >
            <template #option="slotProps">
              <i :class="slotProps.option.icon"></i>
            </template>
          </SelectButton>
        </Tooltip>
      </div>
    </div>

    <!-- Loading overlay -->
    <div v-if="loading && !props.error" class="loading-overlay">
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner loading-icon"></i>
        <p>Loading data...</p>
      </div>
    </div>

    <!-- Error overlay -->
    <div v-if="props.error" class="error-overlay">
      <div class="error-state">
        <i class="pi pi-exclamation-triangle error-icon"></i>
        <p class="error-title">Failed to load data</p>
        <p class="error-message">{{ props.error }}</p>
        <Button label="Try Again" icon="pi pi-refresh" class="retry-btn" @click="emit('retry')" />
      </div>
    </div>

    <!-- List View (TanStack Table) -->
    <div v-show="localViewMode === 'list'" class="table-scroll-container" ref="scrollContainerRef">
      <div class="tanstack-table" :class="{ 'is-resizing': isResizing, 'sticky-mode': props.stickyToolbar }">
        <!-- Header Row -->
        <div class="table-header-row">
          <!-- Frozen Type Column Header -->
          <div class="table-header-cell type-column-header frozen-col">
            <div class="column-header-content">Type</div>
          </div>
          <!-- Draggable Column Headers with TransitionGroup -->
          <TransitionGroup name="column-reorder" tag="div" class="table-header-cells">
            <div
              v-for="colId in sortedColumnIds"
              :key="colId"
              class="table-header-cell"
              :style="getHeaderStyleById(colId)"
              :class="{ dragging: draggingColumnId === colId }"
              draggable="true"
              @dragstart="handleDragStart($event, colId)"
              @dragover="handleDragOver($event, colId)"
              @drop="handleDrop"
              @dragend="handleDragEnd"
            >
              <div 
                class="column-header-content" 
                :class="{ sortable: isColumnSortable(colId) }"
                @click="handleHeaderClickById(colId)"
              >
                <i class="pi pi-bars column-drag-handle"></i>
                <span class="column-header-text">{{ getColumnHeader(colId) }}</span>
                <i v-if="isColumnSortable(colId)" :class="['sort-icon', getSortIcon(colId)]" />
          </div>
              <!-- Resize Handle -->
              <div
                class="resize-handle"
                @mousedown="startResizeById($event, colId)"
                @touchstart="startResizeById($event, colId)"
              ></div>
            </div>
          </TransitionGroup>
        </div>
        <!-- Body Rows with Group Headers -->
        <div class="table-body">
          <template v-for="(tableRow, idx) in tableRowsWithGroups" :key="tableRow.isGroupHeader ? `group-${tableRow.groupValue}-${idx}` : `row-${tableRow.item.id}`">
            <!-- Group Header Row -->
            <div
              v-if="tableRow.isGroupHeader"
              class="table-row group-header-row"
            >
              <div class="table-cell group-header-cell frozen-col">
                <i class="pi pi-folder-open group-icon"></i>
              </div>
              <div class="table-cell group-header-content" :style="{ width: 'auto', minWidth: 'auto', maxWidth: 'none', flex: 1 }">
                <span class="group-label">{{ getGroupLabel() }}</span>
                <span class="group-value">{{ tableRow.groupValue }}</span>
                <span class="group-count">({{ tableRow.itemCount }} {{ tableRow.itemCount === 1 ? 'item' : 'items' }})</span>
              </div>
            </div>
            <!-- Data Row -->
            <div
              v-else
              class="table-row"
              :class="{ 
                'keyboard-selected': tableRow.itemIndex === props.selectedRow,
                'row-odd': tableRow.itemIndex % 2 === 0
              }"
              @click="handleRowClick(tableRow.item)"
              @mouseenter="emit('update:hoveredRow', tableRow.itemIndex)"
              @mouseleave="emit('update:hoveredRow', -1)"
            >
              <!-- Frozen Type Column Cell -->
              <div class="table-cell type-column-cell frozen-col">
                <a
                  :href="getRowPrimaryUrl(tableRow.item)"
                  :target="getRowLinkTarget(tableRow.item)"
                  rel="noopener noreferrer"
                  class="type-cell-link"
                  :title="getTypeBadgeTooltip(tableRow.item)"
                  @click="handleTypeBadgeClick($event, tableRow.item)"
                >
                  <span class="type-badge" :style="getTypeBadgeStyle(tableRow.item)">
                    {{ getTypeBadgeText(tableRow.item) }}
                  </span>
                </a>
              </div>
              <!-- Data Cells - follow same order as headers -->
              <div
                v-for="colId in sortedColumnIds"
                :key="colId"
                class="table-cell"
                :style="getCellStyleById(colId)"
              >
                <component :is="renderCellById(tableRow.item, colId)" />
              </div>
            </div>
          </template>
        </div>
      </div>
      <!-- Infinite scroll trigger -->
      <div ref="scrollTrigger" class="scroll-trigger"></div>
    </div>

    <!-- Gallery View -->
    <div v-show="localViewMode === 'gallery'" class="gallery-view">
      <template v-for="(group, groupIdx) in galleryGroupedItems" :key="`group-${groupIdx}`">
        <!-- Group Header (only show if grouping is enabled) -->
        <div v-if="props.groupConfig && group.groupValue" class="gallery-group-header">
          <i class="pi pi-folder-open group-icon"></i>
          <span class="group-label">{{ getGroupLabel() }}</span>
          <span class="group-value">{{ group.groupValue }}</span>
          <span class="group-count">({{ group.items.length }} {{ group.items.length === 1 ? 'item' : 'items' }})</span>
        </div>
        
        <!-- Gallery Grid for this group -->
        <div class="gallery-grid" :ref="groupIdx === 0 ? (el) => galleryGridRef = el as HTMLElement : undefined" :style="galleryGridStyle">
          <div
            v-for="{ item, itemIndex } in group.items"
            :key="item.id"
            class="gallery-item"
            :class="{ 'keyboard-selected': itemIndex === props.selectedRow, 'compact': isCompactGrid }"
            @click="handleRowClick(item)"
            @mouseenter="emit('update:hoveredRow', itemIndex)"
            @mouseleave="emit('update:hoveredRow', -1)"
          >
            <div class="gallery-item-header">
              <div class="gallery-header-left">
                <a
                  v-if="!(isCompactGrid && item.type?.toLowerCase() === 'file')"
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
                <ExtensionBadge v-if="item.type?.toLowerCase() === 'file'" :extension="item.file_extension" :storage-path="item.storage_path" />
              </div>
              <span class="gallery-header-date">{{ formatDateShort(item.updated_at) }}</span>
            </div>
            <div 
              class="gallery-item-thumbnail"
              :ref="(el) => isEmail(item) ? setEmailItemRef(el as HTMLElement, String(item.id)) : null"
              :data-item-id="item.id"
            >
              <!-- Email iframe preview -->
              <EmailPreview
                v-if="isEmail(item)"
                :html-body="getEmailBody(String(item.id))"
                :loading="isEmailBodyLoading(String(item.id))"
                :attachments="getEmailAttachments(String(item.id))"
              />
              <!-- Craft markdown preview -->
              <div 
                v-else-if="isCraft(item)"
                class="craft-preview-wrapper"
                :ref="(el) => setCraftItemRef(el as HTMLElement, String(item.id))"
                :data-item-id="item.id"
              >
                <CraftPreview
                  :markdown="getCraftBody(String(item.id))"
                  :loading="isCraftBodyLoading(String(item.id))"
                />
              </div>
              <!-- Task preview (includes name, description, tags, assignee, progress) -->
              <TaskPreview
                v-else-if="isTask(item)"
                :name="item.name || ''"
                :description="item.description"
                :task-type-slug="item.task_type_slug"
                :task-type-color="item.task_type_color"
                :status="item.status"
                :priority="item.priority"
                :progress="item.progress"
                :due-date="item.due_date"
                :created-at="item.created_at"
                :tags="item.tags"
                :assigned-to="item.assigned_to"
              />
              <!-- File thumbnail -->
              <img
                v-else-if="shouldShowThumbnail(item)"
                :src="getThumbnailUrl(item.thumbnail_path!)"
                :alt="item.name"
                loading="lazy"
                class="gallery-thumbnail-img"
                @error="() => handleThumbnailError(item.thumbnail_path!)"
              />
              <!-- File placeholder (no thumbnail) -->
              <FilePlaceholder
                v-else-if="item.type?.toLowerCase() === 'file'"
                :filename="item.name || 'Unknown'"
              />
              <!-- Fallback icon for other types -->
              <i v-else :class="getGalleryIcon(item)" class="gallery-icon"></i>
            </div>
            <!-- Content below thumbnail (hidden for tasks since TaskPreview includes name) -->
            <div v-if="!isTask(item)" class="gallery-item-content">
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
            <!-- Task items: minimal footer with project only -->
            <div v-else class="gallery-item-footer">
              <span v-if="item.project" class="footer-project" :title="item.project">
                <i class="pi pi-folder"></i> {{ truncateText(item.project, 25) }}
              </span>
            </div>
          </div>
        </div>
      </template>

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
import { ref, computed, onMounted, onUnmounted, h, watch, TransitionGroup, type VNode } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnDef
} from '@tanstack/vue-table'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import { InfoTooltip, Tooltip, AutocompleteInput, EmailPreview, CraftPreview, FilePlaceholder, TaskPreview, ExtensionBadge, type AutocompleteSuggestion } from '@/components/common'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { useKeyBindings } from '@/composables/useKeyBindings'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { useProjectAutocomplete } from '@/composables/useAutocomplete'
import { getVisibleColumnsForTypes } from '@/composables/useData'
import { supabase } from '@/lib/supabase'
import { formatDateShort } from '@/lib/formatDate'
import type { DataItem, ViewDataItem, Column as ColumnType, SortConfig, GroupConfig, ViewType } from '@/types'
import { GROUPABLE_COLUMNS } from '@/types'

interface Props {
  items: ViewDataItem[]
  columns: ColumnType[]
  loading: boolean
  countLoading?: boolean
  revalidating?: boolean
  error?: string | null
  hasMore?: boolean
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
  groupConfig?: GroupConfig | null
  viewType?: ViewType
  selectedTaskTypes?: string[]
  selectedRow?: number
  selectedCol?: number
  hoveredRow?: number
  exporting?: boolean
  filterConfigId?: string
  projectFilter?: string
  gridColumns?: number
  stickyToolbar?: boolean
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
  (e: 'update:hoveredRow', value: number): void
  (e: 'update:projectFilter', value: string): void
  (e: 'update:groupConfig', value: GroupConfig | null): void
  (e: 'clearSearch'): void
  (e: 'rowClick', item: DataItem): void
  (e: 'loadMore'): void
  (e: 'sort', sortConfig: SortConfig): void
  (e: 'export'): void
  (e: 'retry'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composables
const { taskTypes, initialize: initTaskTypes } = useTaskTypes()
const { keyBindings, formatKeyForDisplay } = useKeyBindings()

// Shortcut tooltip helpers
const searchShortcuts = computed(() => {
  const key = keyBindings.value.focusSearch.key
  return [
    { label: 'Focus', key },
    { label: 'Clear', key: `Shift+${key}` }
  ]
})

const viewToggleShortcut = computed(() => formatKeyForDisplay(keyBindings.value.toggleView.key))

const emailShortcut = computed(() => formatKeyForDisplay(keyBindings.value.toggleEmails.key))
const craftShortcut = computed(() => formatKeyForDisplay(keyBindings.value.toggleCraft.key))
const fileShortcut = computed(() => formatKeyForDisplay(keyBindings.value.toggleFiles.key))

const taskTypeShortcuts = computed(() => [
  formatKeyForDisplay(keyBindings.value.toggleTaskType1.key),
  formatKeyForDisplay(keyBindings.value.toggleTaskType2.key),
  formatKeyForDisplay(keyBindings.value.toggleTaskType3.key)
])
const { emailColor, craftColor, fileColor, craftSpaceId, personColor, projectColor, teamworkBaseUrl, filesBucket, initialize: initAppearance } = useAppearanceSettings()
const { suggestions: projectSuggestions, loading: projectLoading, search: searchProjects, clear: clearProjectSuggestions } = useProjectAutocomplete()

// Refs
const scrollTrigger = ref<HTMLElement | null>(null)
const galleryScrollTrigger = ref<HTMLElement | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)
const galleryGridRef = ref<HTMLElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)
const toolbarHeight = ref(0)

// State
const isResizing = ref(false)
const resizingColumn = ref<string | null>(null)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

// Drag and drop state for column reordering (matches FilterBar pattern)
const draggingColumnId = ref<string | null>(null)
const previewColumnOrder = ref<string[] | null>(null)
let lastSwapTime = 0

// Cache for column visibility during loading
const cachedColumnsWithData = ref<Set<string>>(new Set())
const lastFilterConfigId = ref<string | undefined>(undefined)

// Failed thumbnails
const failedThumbnails = ref(new Set<string>())

// Email HTML body cache for iframe previews
const emailBodies = ref<Map<string, string>>(new Map())
const loadingEmailBodies = ref<Set<string>>(new Set())
const emailItemRefs = ref<Map<string, HTMLElement>>(new Map())

// Email attachment files cache
interface EmailAttachmentFile {
  file_id: string
  filename: string
  storage_path: string
  thumbnail_path: string | null
}
const emailAttachments = ref<Map<string, EmailAttachmentFile[]>>(new Map())

// Craft markdown body cache for preview
const craftBodies = ref<Map<string, string>>(new Map())
const loadingCraftBodies = ref<Set<string>>(new Set())
const craftItemRefs = ref<Map<string, HTMLElement>>(new Map())

// Project autocomplete handlers
const handleProjectSearch = (searchText: string) => searchProjects(searchText)
const handleProjectSelect = (suggestion: AutocompleteSuggestion) => emit('update:projectFilter', suggestion.name as string)
const handleProjectClear = () => { emit('update:projectFilter', ''); clearProjectSuggestions() }

// Transform craft URL
const transformCraftUrl = (url: string): string => {
  if (!url || !craftSpaceId.value) return url
  const blockIdMatch = url.match(/blockId=([^&]+)/)
  if (!blockIdMatch) return url
  return `craftdocs://open?spaceId=${craftSpaceId.value}&blockId=${blockIdMatch[1]}`
}

// Toolbar height observer for sticky stacking
let toolbarResizeObserver: ResizeObserver | null = null

// Initialize on mount
onMounted(async () => {
  await Promise.all([initTaskTypes(), initAppearance()])
  setupIntersectionObserver()
  setupEmailBodyObserver()
  setupCraftBodyObserver()
  
  // Set up toolbar height tracking for sticky header stacking
  if (toolbarRef.value) {
    toolbarResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        toolbarHeight.value = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height
      }
    })
    toolbarResizeObserver.observe(toolbarRef.value)
  }
})

// Task type toggles
const toggleTaskType = (typeId: string) => {
  const current = props.selectedTaskTypes || []
  const newSelection = current.includes(typeId)
    ? current.filter(id => id !== typeId)
    : [...current, typeId]
  emit('update:selectedTaskTypes', newSelection)
}

const isTaskTypeSelected = (typeId: string) => (props.selectedTaskTypes || []).includes(typeId)

// Local v-model proxies
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

// Re-setup observers when view mode changes to gallery
watch(() => localViewMode.value, (mode) => {
  if (mode === 'gallery') {
    setTimeout(() => {
      setupEmailBodyObserver()
      setupCraftBodyObserver()
    }, 100)
  }
})

// Cleanup observers
onUnmounted(() => {
  if (emailBodyObserver) emailBodyObserver.disconnect()
  if (craftBodyObserver) craftBodyObserver.disconnect()
  toolbarResizeObserver?.disconnect()
})

const viewModeOptions = [
  { label: 'List', value: 'list', icon: 'pi pi-list' },
  { label: 'Gallery', value: 'gallery', icon: 'pi pi-th-large' }
]

const blurActiveElement = () => (document.activeElement as HTMLElement)?.blur()

// Column visibility logic
const staticVisibleColumns = computed(() => {
  if (props.viewType !== 'items' && props.viewType !== undefined) return null
  return getVisibleColumnsForTypes(props.showTasks, props.showEmails, props.showCraft, props.showFiles, props.selectedTaskTypes ?? null)
})

const availableColumns = computed(() => {
  if (staticVisibleColumns.value !== null) return new Set(staticVisibleColumns.value)
  return new Set(props.columns.map(c => c.field))
})

const isColumnDisabled = (option: { field: string }) => {
  if (option.field === 'type') return false
  return !availableColumns.value.has(option.field)
}

const enabledSelectedColumnsCount = computed(() => 
  props.visibleColumns.filter(field => availableColumns.value.has(field)).length
)

const handleSelectAllChange = (event: { checked: boolean }) => {
  const disabledSelected = props.visibleColumns.filter(f => !availableColumns.value.has(f))
  if (event.checked) {
    const enabledFields = props.columns.filter(col => availableColumns.value.has(col.field)).map(col => col.field)
    emit('update:visibleColumns', [...new Set([...enabledFields, ...disabledSelected])])
  } else {
    emit('update:visibleColumns', disabledSelected)
  }
}

const allColumns = computed(() => props.columns)

// Group by options with "None" option
const groupByOptions = computed(() => {
  return [
    { field: null, label: 'None' },
    ...GROUPABLE_COLUMNS
  ]
})

// Handle group by selection change
const handleGroupByChange = (field: string | null) => {
  if (field === null) {
    emit('update:groupConfig', null)
  } else {
    emit('update:groupConfig', { field, order: props.groupConfig?.order || 'asc' })
  }
}

// Toggle group order between asc and desc
const toggleGroupOrder = () => {
  if (props.groupConfig) {
    emit('update:groupConfig', {
      field: props.groupConfig.field,
      order: props.groupConfig.order === 'asc' ? 'desc' : 'asc'
    })
  }
}

// Get label for the current group field
const getGroupLabel = (): string => {
  if (!props.groupConfig) return ''
  const col = GROUPABLE_COLUMNS.find(c => c.field === props.groupConfig!.field)
  return col?.label || props.groupConfig.field
}

// Should show column based on item types
const shouldShowColumn = (field: string): boolean => {
  if (staticVisibleColumns.value !== null) return staticVisibleColumns.value.includes(field)
  if (props.loading && props.items.length === 0 && props.filterConfigId === lastFilterConfigId.value) {
    return cachedColumnsWithData.value.has(field)
  }
  if (props.items.length === 0) return true
  return props.items.some(item => {
    const value = item[field]
    return value !== null && value !== undefined && value !== ''
  })
}

// Update cache when items change
watch(() => props.items, (items) => {
  if (staticVisibleColumns.value !== null) return
  if (items.length > 0) {
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

watch(() => props.filterConfigId, (newId, oldId) => {
  if (newId !== oldId && oldId !== undefined) cachedColumnsWithData.value = new Set()
})

const displayedItems = computed(() => props.items)

// Compute items with group information - returns array with group headers inserted where needed
// Each entry has: { isGroupHeader: boolean, groupValue: string, item?: ViewDataItem, itemIndex?: number }
type TableRow = 
  | { isGroupHeader: true, groupValue: string, itemCount: number }
  | { isGroupHeader: false, item: ViewDataItem, itemIndex: number, groupValue: string | null }

const tableRowsWithGroups = computed<TableRow[]>(() => {
  if (!props.groupConfig) {
    // No grouping - return items with their indices
    return props.items.map((item, index) => ({
      isGroupHeader: false as const,
      item,
      itemIndex: index,
      groupValue: null
    }))
  }

  const result: TableRow[] = []
  let currentGroupValue: string | null = null
  let currentGroupItemCount = 0
  let groupHeaderIndex = -1

  props.items.forEach((item, index) => {
    const itemGroupValue = item.group_value ?? null
    
    // Check if we're starting a new group
    if (itemGroupValue !== currentGroupValue) {
      // Update the count of the previous group header
      if (groupHeaderIndex >= 0 && result[groupHeaderIndex].isGroupHeader) {
        (result[groupHeaderIndex] as { isGroupHeader: true, groupValue: string, itemCount: number }).itemCount = currentGroupItemCount
      }
      
      // Add group header
      currentGroupValue = itemGroupValue
      currentGroupItemCount = 0
      groupHeaderIndex = result.length
      result.push({
        isGroupHeader: true,
        groupValue: itemGroupValue || '(No value)',
        itemCount: 0 // Will be updated
      })
    }
    
    // Add the item
    result.push({
      isGroupHeader: false,
      item,
      itemIndex: index,
      groupValue: itemGroupValue
    })
    currentGroupItemCount++
  })

  // Update the count of the last group header
  if (groupHeaderIndex >= 0 && result[groupHeaderIndex].isGroupHeader) {
    (result[groupHeaderIndex] as { isGroupHeader: true, groupValue: string, itemCount: number }).itemCount = currentGroupItemCount
  }

  return result
})

// Compute gallery items grouped - returns array of groups, each with header info and items
interface GalleryGroup {
  groupValue: string
  items: { item: ViewDataItem, itemIndex: number }[]
}

const galleryGroupedItems = computed<GalleryGroup[]>(() => {
  if (!props.groupConfig) {
    // No grouping - return single group with all items
    return [{
      groupValue: '',
      items: props.items.map((item, index) => ({ item, itemIndex: index }))
    }]
  }

  const groups: GalleryGroup[] = []
  let currentGroup: GalleryGroup | null = null

  props.items.forEach((item, index) => {
    const itemGroupValue = item.group_value ?? '(No value)'
    
    if (!currentGroup || currentGroup.groupValue !== itemGroupValue) {
      currentGroup = { groupValue: itemGroupValue, items: [] }
      groups.push(currentGroup)
    }
    
    currentGroup.items.push({ item, itemIndex: index })
  })

  return groups
})

// Item count display
const itemCountData = computed(() => ({
  loaded: displayedItems.value.length,
    total: props.totalCount,
  viewLabel: props.viewType === 'projects' ? 'projects' : props.viewType === 'people' ? 'people' : 'items',
    isCountLoading: props.countLoading ?? false
}))

// TanStack Table column definitions
const columnHelper = createColumnHelper<ViewDataItem>()

const tableColumns = computed<ColumnDef<ViewDataItem, any>[]>(() => {
  // Filter columns that should be visible
  const visibleCols = props.columns.filter(col => 
    props.visibleColumns.includes(col.field) && shouldShowColumn(col.field) && col.field !== 'type'
  )
  
  return visibleCols.map(col => 
    columnHelper.accessor(row => row[col.field], {
      id: col.field,
      header: col.header,
      enableSorting: col.sortable !== false,
      size: parseInt(props.columnWidths[col.field] || col.width || '150') || 150,
      minSize: 50,
      maxSize: 800,
    })
  )
})

// TanStack Table instance
const table = useVueTable({
  get data() { return displayedItems.value },
  get columns() { return tableColumns.value },
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
  enableColumnResizing: true,
  columnResizeMode: 'onChange',
})

// Sorted column IDs - uses preview order during drag for live reordering
const sortedColumnIds = computed(() => {
  // If dragging, use preview order for smooth live reorder
  if (previewColumnOrder.value) return previewColumnOrder.value
  
  // Get visible column IDs from table
  const visibleColIds = tableColumns.value.map(c => c.id).filter((id): id is string => !!id)
  const order = props.columnOrder.filter(f => f !== 'type')
  
  // Sort by columnOrder
  return [...visibleColIds].sort((a, b) => {
    const indexA = order.indexOf(a)
    const indexB = order.indexOf(b)
    if (indexA === -1 && indexB === -1) return 0
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
})

// Get column header text
const getColumnHeader = (colId: string): string => {
  const col = props.columns.find(c => c.field === colId)
  return col?.header || colId
}

// Get column def by ID
const getColumnDef = (colId: string) => {
  return props.columns.find(c => c.field === colId)
}

// Header style with width by column ID
const getHeaderStyleById = (colId: string) => {
  const col = getColumnDef(colId)
  const defaultWidth = col?.width || '150px'
  const width = props.columnWidths[colId] || defaultWidth
  return { width, minWidth: width, maxWidth: width }
}

// Cell style with width by column ID
const getCellStyleById = (colId: string) => {
  const col = getColumnDef(colId)
  const defaultWidth = col?.width || '150px'
  const width = props.columnWidths[colId] || defaultWidth
  return { width, minWidth: width, maxWidth: width }
}

// Check if column is sortable
const isColumnSortable = (colId: string): boolean => {
  const col = getColumnDef(colId)
  return col?.sortable !== false
}

// Handle header click by column ID
const handleHeaderClickById = (colId: string) => {
  if (isResizing.value) return
  if (!isColumnSortable(colId)) return
  
  const currentField = props.sortConfig?.field
  const currentOrder = props.sortConfig?.order
  
  if (currentField === colId) {
    // Toggle between asc and desc
    emit('sort', { field: colId, order: currentOrder === 'asc' ? 'desc' : 'asc' })
  } else {
    // New column. Choose sensible default.
    // Dates, times, and numbers typically start with descending (newest/highest first)
    let order: 'asc' | 'desc' = 'asc'
    if (colId.includes('date') || colId.includes('at') || 
        ['progress', 'attachment_count', 'accumulated_estimated_minutes', 'cost_group_code'].includes(colId)) {
      order = 'desc'
    }
    emit('sort', { field: colId, order })
  }
}

// Start resize by column ID
const startResizeById = (event: MouseEvent | TouchEvent, colId: string) => {
  event.preventDefault()
  event.stopPropagation()
  
  isResizing.value = true
  resizingColumn.value = colId
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  resizeStartX.value = clientX
  const col = getColumnDef(colId)
  const defaultWidth = col?.width || '150px'
  resizeStartWidth.value = parseInt(props.columnWidths[colId] || defaultWidth) || 150
  
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchmove', onResize)
  document.addEventListener('touchend', stopResize)
}

// Render cell by column ID and row data
const renderCellById = (data: ViewDataItem, colId: string): VNode => {
  const value = data[colId]

  // Task type column
  if (colId === 'task_type_name' && value) {
    const color = data.task_type_color || '#6366f1'
    return h('div', { class: 'task-type-cell' }, [
      h('span', { class: 'task-type-dot', style: { background: color } }),
      h('span', String(value))
    ])
  }

  // Recipients column
  if (colId === 'recipients' && Array.isArray(value) && value.length > 0) {
    const emails = value.map(r => r.contact?.email).filter((email): email is string => !!email)
    if (emails.length === 0) return h('span', '—')
    return h('div', { class: 'recipients-tags' }, 
      emails.map((email, idx) => h('span', { key: idx, class: 'recipient-tag' }, email))
    )
  }

  // Arrays
  if (Array.isArray(value)) {
    return h('div', value.map((item, idx) => 
      h('div', { key: idx, class: 'array-item' }, 
        typeof item === 'object' ? item.name || item.email || JSON.stringify(item) : String(item)
      )
    ))
  }

  // Objects
  if (typeof value === 'object' && value !== null) {
    return h('span', value.name || value.email || JSON.stringify(value))
  }

  // Dates
  if (colId.includes('date') || colId.includes('at')) {
    if (value && typeof value === 'string') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return h('span', date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))
      }
    }
  }

  return h('span', value != null ? String(value) : '—')
}

// Sorting
const getSortIcon = (field: string) => {
  if (props.sortConfig?.field !== field) return 'pi pi-sort-alt'
  return props.sortConfig.order === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'
}

const onResize = (event: MouseEvent | TouchEvent) => {
  if (!resizingColumn.value) return
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const diff = clientX - resizeStartX.value
  const newWidth = Math.max(50, Math.min(800, resizeStartWidth.value + diff))
  
  const newWidths = { ...props.columnWidths, [resizingColumn.value]: `${newWidth}px` }
  emit('update:columnWidths', newWidths)
}

const stopResize = () => {
    isResizing.value = false
  resizingColumn.value = null
  
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', onResize)
  document.removeEventListener('touchend', stopResize)
}

// Column Drag and Drop Reordering - matches FilterBar pattern for smooth animations
const handleDragStart = (event: DragEvent, columnId: string) => {
  if (isResizing.value) {
    event.preventDefault()
    return
  }
  
  draggingColumnId.value = columnId
  // Initialize preview order with current sorted order
  previewColumnOrder.value = [...sortedColumnIds.value]
  lastSwapTime = 0
  
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', columnId)
  }
}

const handleDragOver = (event: DragEvent, targetColumnId: string) => {
  event.preventDefault()
  if (!draggingColumnId.value || draggingColumnId.value === targetColumnId || !previewColumnOrder.value) return
  
  // Throttle swaps to prevent flickering (150ms like FilterBar)
  const now = Date.now()
  if (now - lastSwapTime < 150) return
  
  const currentIdx = previewColumnOrder.value.indexOf(draggingColumnId.value)
  const targetIdx = previewColumnOrder.value.indexOf(targetColumnId)
  if (currentIdx === -1 || targetIdx === -1 || currentIdx === targetIdx) return
  
  // Move item to new position - this triggers TransitionGroup animation
  const newOrder = [...previewColumnOrder.value]
  newOrder.splice(currentIdx, 1)
  newOrder.splice(targetIdx, 0, draggingColumnId.value)
  previewColumnOrder.value = newOrder
  lastSwapTime = now
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  commitColumnOrder()
}

const handleDragEnd = () => {
  commitColumnOrder()
}

const commitColumnOrder = () => {
  if (previewColumnOrder.value) {
    // Merge with hidden columns
    const visibleSet = new Set(previewColumnOrder.value)
    const hiddenColumns = props.columnOrder.filter(f => !visibleSet.has(f) && f !== 'type')
    emit('update:columnOrder', [...previewColumnOrder.value, ...hiddenColumns])
  }
  draggingColumnId.value = null
  previewColumnOrder.value = null
}

// Row click
const handleRowClick = (item: ViewDataItem) => {
  emit('rowClick', item as DataItem)
}

// Type badge helpers
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
  if (item.teamwork_url) return item.teamwork_url
  if (item.missive_url) return item.missive_url
  if (item.craft_url) return transformCraftUrl(item.craft_url)
  if (item.type?.toLowerCase() === 'file') return 'javascript:void(0)'
  return '#'
}

const getRowLinkTarget = (_item: ViewDataItem): string => {
  if (props.viewType === 'people') return '_self'
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

const handleTypeBadgeClick = async (event: MouseEvent, item: ViewDataItem) => {
  event.stopPropagation()
  
  const itemType = item.type?.toLowerCase()
  if (itemType === 'file') {
    event.preventDefault()
    if (!item.storage_path) return
    
    const { data, error } = await supabase.storage
      .from(filesBucket.value)
      .createSignedUrl(item.storage_path, 300)
    
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }
}

// Thumbnail helpers
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const getThumbnailUrl = (thumbnailPath: string): string => 
  `${supabaseUrl}/storage/v1/object/public/thumbnails/${thumbnailPath}`

const handleThumbnailError = (thumbnailPath: string) => {
  failedThumbnails.value.add(thumbnailPath)
}

const shouldShowThumbnail = (item: ViewDataItem): boolean => 
  !!item.thumbnail_path && !failedThumbnails.value.has(item.thumbnail_path)

// Type check helpers
const isEmail = (item: ViewDataItem): boolean => item.type?.toLowerCase() === 'email'
const isCraft = (item: ViewDataItem): boolean => item.type?.toLowerCase() === 'craft'
const isTask = (item: ViewDataItem): boolean => item.type?.toLowerCase() === 'task'
const getEmailBody = (itemId: string): string | null => emailBodies.value.get(itemId) ?? null
const isEmailBodyLoading = (itemId: string): boolean => loadingEmailBodies.value.has(itemId)
const getCraftBody = (itemId: string): string | null => craftBodies.value.get(itemId) ?? null
const isCraftBodyLoading = (itemId: string): boolean => loadingCraftBodies.value.has(itemId)

const loadEmailBodies = async (messageIds: string[]) => {
  const toLoad = messageIds.filter(id => !emailBodies.value.has(id) && !loadingEmailBodies.value.has(id))
  if (toLoad.length === 0) return
  
  toLoad.forEach(id => loadingEmailBodies.value.add(id))
  
  // Load HTML bodies and attachments in parallel
  const [bodiesResult, ...attachmentResults] = await Promise.all([
    supabase.rpc('get_email_html_bodies', { p_message_ids: toLoad }),
    ...toLoad.map(id => supabase.rpc('get_email_files', { p_message_id: id }).then(r => ({ id, ...r })))
  ])
  
  toLoad.forEach(id => loadingEmailBodies.value.delete(id))
  
  // Store HTML bodies
  if (!bodiesResult.error && bodiesResult.data) {
    for (const row of bodiesResult.data) {
      if (row.html_body) {
        emailBodies.value.set(row.message_id, row.html_body)
      }
    }
  }
  
  // Store attachments
  for (const result of attachmentResults) {
    if (!result.error && result.data) {
      emailAttachments.value.set(result.id, result.data as EmailAttachmentFile[])
    }
  }
}

const getEmailAttachments = (itemId: string): EmailAttachmentFile[] => 
  emailAttachments.value.get(itemId) ?? []

// Load craft markdown bodies
const loadCraftBodies = async (documentIds: string[]) => {
  const toLoad = documentIds.filter(id => !craftBodies.value.has(id) && !loadingCraftBodies.value.has(id))
  if (toLoad.length === 0) return
  
  toLoad.forEach(id => loadingCraftBodies.value.add(id))
  
  const { data, error } = await supabase.rpc('get_craft_markdowns', { p_document_ids: toLoad })
  
  toLoad.forEach(id => loadingCraftBodies.value.delete(id))
  
  if (!error && data) {
    for (const row of data) {
      if (row.markdown) {
        craftBodies.value.set(row.document_id, row.markdown)
      }
    }
  }
}

// Email preview IntersectionObserver for lazy loading
let emailBodyObserver: IntersectionObserver | null = null

const setupEmailBodyObserver = () => {
  if (emailBodyObserver) emailBodyObserver.disconnect()
  
  emailBodyObserver = new IntersectionObserver(
    (entries) => {
      const visibleEmailIds = entries
        .filter(e => e.isIntersecting)
        .map(e => (e.target as HTMLElement).dataset.itemId)
        .filter((id): id is string => !!id && !emailBodies.value.has(id))
      
      if (visibleEmailIds.length > 0) {
        loadEmailBodies(visibleEmailIds)
      }
    },
    { threshold: 0.1, rootMargin: '100px' }
  )
  
  // Observe all email items
  emailItemRefs.value.forEach((el) => {
    emailBodyObserver?.observe(el)
  })
}

const setEmailItemRef = (el: HTMLElement | null, itemId: string) => {
  if (el) {
    emailItemRefs.value.set(itemId, el)
    emailBodyObserver?.observe(el)
  } else {
    const existing = emailItemRefs.value.get(itemId)
    if (existing) emailBodyObserver?.unobserve(existing)
    emailItemRefs.value.delete(itemId)
  }
}

// Craft preview IntersectionObserver for lazy loading
let craftBodyObserver: IntersectionObserver | null = null

const setupCraftBodyObserver = () => {
  if (craftBodyObserver) craftBodyObserver.disconnect()
  
  craftBodyObserver = new IntersectionObserver(
    (entries) => {
      const visibleCraftIds = entries
        .filter(e => e.isIntersecting)
        .map(e => (e.target as HTMLElement).dataset.itemId)
        .filter((id): id is string => !!id && !craftBodies.value.has(id))
      
      if (visibleCraftIds.length > 0) {
        loadCraftBodies(visibleCraftIds)
      }
    },
    { threshold: 0.1, rootMargin: '100px' }
  )
  
  // Observe all craft items
  craftItemRefs.value.forEach((el) => {
    craftBodyObserver?.observe(el)
  })
}

const setCraftItemRef = (el: HTMLElement | null, itemId: string) => {
  if (el) {
    craftItemRefs.value.set(itemId, el)
    craftBodyObserver?.observe(el)
  } else {
    const existing = craftItemRefs.value.get(itemId)
    if (existing) craftBodyObserver?.unobserve(existing)
    craftItemRefs.value.delete(itemId)
  }
}

// Gallery helpers
const gridColumns = computed(() => props.gridColumns || 4)
const isCompactGrid = computed(() => gridColumns.value >= 8)

const galleryGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${gridColumns.value}, 1fr)`,
  gap: isCompactGrid.value ? '0' : undefined
}))

const getGalleryColumns = (): number => gridColumns.value

const getGalleryIcon = (item: ViewDataItem): string => {
  if (props.viewType === 'projects') return 'pi pi-folder'
  if (props.viewType === 'people') return item.is_company ? 'pi pi-building' : 'pi pi-user'
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'pi pi-envelope'
  if (itemType === 'craft') return 'pi pi-file-edit'
  if (itemType === 'file') return 'pi pi-file'
  return 'pi pi-check-square'
}

const getGalleryTitle = (item: ViewDataItem): string => {
  if (props.viewType === 'people') return item.display_name || 'Unknown'
  return item.name || 'Untitled'
}

const getGalleryDescription = (item: ViewDataItem): string => {
  if (props.viewType === 'people') return item.notes || item.primary_email || ''
  return item.description || ''
}

const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Infinite scroll
let observer: IntersectionObserver | null = null

const setupIntersectionObserver = () => {
  if (observer) observer.disconnect()
  
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some(e => e.isIntersecting) && !props.loading) {
        emit('loadMore')
      }
    },
    { threshold: 0.1 }
  )
  
  if (scrollTrigger.value) observer.observe(scrollTrigger.value)
  if (galleryScrollTrigger.value) observer.observe(galleryScrollTrigger.value)
}

// Check if scroll trigger is visible and load more if needed
// This handles the case where on initial load, the viewport can fit more than PAGE_SIZE items
const checkScrollTriggerVisibility = () => {
  const trigger = localViewMode.value === 'gallery' ? galleryScrollTrigger.value : scrollTrigger.value
  if (!trigger || !props.hasMore) return
  
  const rect = trigger.getBoundingClientRect()
  const isVisible = rect.top < window.innerHeight && rect.bottom > 0
  if (isVisible) emit('loadMore')
}

// When loading finishes, check if we need to load more (trigger still visible)
watch(() => props.loading, (loading, wasLoading) => {
  if (wasLoading && !loading && props.hasMore) {
    // Use nextTick + small delay to ensure DOM has updated after items render
    setTimeout(checkScrollTriggerVisibility, 50)
  }
})

// // Handle horizontal scroll to keep toolbar pinned
// const handleParentScroll = () => {
//   if (!parentScrollContainer || !toolbarRef.value) return
//   const scrollLeft = parentScrollContainer.scrollLeft
//   toolbarRef.value.style.transform = `translateX(${scrollLeft}px)`
// }

// onMounted(() => {
//   setupIntersectionObserver()
  
//   // Find parent scroll container (.center-content) and attach scroll listener
//   let parent = toolbarRef.value?.parentElement
//   while (parent) {
//     const style = getComputedStyle(parent)
//     if (style.overflowX === 'auto' || style.overflowX === 'scroll' || 
//         style.overflow === 'auto' || style.overflow === 'scroll') {
//       parentScrollContainer = parent
//       parent.addEventListener('scroll', handleParentScroll, { passive: true })
//       break
//     }
//     parent = parent.parentElement
//   }
// })

// // Re-setup observer when view mode changes
// watch(() => localViewMode.value, () => {
//   setTimeout(setupIntersectionObserver, 100)
// })

// onUnmounted(() => {
//   if (observer) {
//     observer.disconnect()
//   }
//   if (parentScrollContainer) {
//     parentScrollContainer.removeEventListener('scroll', handleParentScroll)
//   }
// })

// Exposed methods
const focusSearch = () => {
  const wrapper = document.querySelector('.search-wrapper')
  const input = wrapper?.querySelector('input') as HTMLInputElement
  input?.focus()
}

const scrollToSelectedCell = () => {
  if (props.selectedRow === undefined || props.selectedRow < 0) return
  const rows = scrollContainerRef.value?.querySelectorAll('.table-row')
  if (rows && rows[props.selectedRow]) {
    rows[props.selectedRow].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

const scrollToSelectedGalleryItem = () => {
  if (props.selectedRow === undefined || props.selectedRow < 0) return
  if (!galleryGridRef.value) return
  const items = galleryGridRef.value.querySelectorAll('.gallery-item')
  if (items && items[props.selectedRow]) {
    items[props.selectedRow].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

defineExpose({ focusSearch, scrollToSelectedCell, getGalleryColumns, scrollToSelectedGalleryItem })
</script>

<style scoped>
.data-table-wrapper {
  border-bottom-left-radius: var(--radius-lg);
  border-bottom-right-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  width: fit-content;
  min-width: 0;
  /* Allow content to determine height, parent handles scroll */
  flex: 1 0 auto;
  position: relative;
}

/* Loading overlay - sticky to stay visible regardless of scroll position */
.loading-overlay {
  position: sticky;
  top: 0; /* Default: non-sticky toolbar */
  left: 0;
  width: calc(100vw - 13rem);
  height: calc(100vh - 150px);
  margin-bottom: calc(-100vh + 150px); /* Negative margin to not affect layout */
  display: flex;
  background: rgba(42, 42, 42, 0.85);
  z-index: 50;
}

/* When toolbar is sticky, offset below it */
.table-toolbar--sticky ~ .loading-overlay {
  top: 100px;
  height: calc(100vh - 250px);
  margin-bottom: calc(-100vh + 250px);
}

.table-toolbar.wide-view ~ .loading-overlay {
  width: calc(100vw - 4.3rem);
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
  position: sticky !important;
  left: 0 !important;
  z-index: 150;
  width: calc(100vw - 13rem);
}

.table-toolbar.wide-view {
  width: calc(100vw - 4.3rem);
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
}

.table-toolbar--sticky {
  top: var(--filter-bar-height, 0px);
}

.table-toolbar--sticky.wide-view {
  top: 0;
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

.column-selector {
  min-width: 200px;
}

:deep(.p-multiselect-item[data-p-disabled="true"]) {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Group by dropdown */
.group-by-wrapper {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.group-by-dropdown {
  min-width: 140px;
}

.group-order-btn {
  color: var(--text-secondary) !important;
}

.group-order-btn:hover {
  color: var(--accent-primary) !important;
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
  display: flex;
  flex-direction: column;
  font-size: 0.875rem;
  color: var(--text-tertiary);
  line-height: 1.2;
}

.revalidating-spinner {
  font-size: 1.5rem;
  color: var(--text-tertiary);
  margin-left: 0.5rem;
}

.count-shimmer {
  display: inline-block;
  background: linear-gradient(90deg, var(--text-disabled) 25%, var(--text-tertiary) 50%, var(--text-disabled) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 3px;
  color: transparent;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
  color: var(--text-tertiary);
  font-size: 1rem;
  cursor: help;
}

.search-wrapper > :deep(.tooltip-wrapper) {
  position: absolute;
  left: 1rem;
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

.project-filter-wrapper {
  width: 220px;
}

:deep(.project-option) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
}

:deep(.project-name) {
  color: var(--text-primary);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.project-meta) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
  flex-shrink: 0;
}

:deep(.project-company) {
  color: var(--text-tertiary);
  font-size: 0.75rem;
}

:deep(.project-status) {
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

:deep(.project-status.active) {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

:deep(.project-status.completed) {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-tertiary);
}

/* Table scroll container - no scroll, parent handles both axes */
.table-scroll-container {
  min-width: 0;
  width: fit-content; 
  background-color: var(--bg-primary) !important;
  /* scrooling fix here*/
}

/* Div-based Table Styles */
.tanstack-table {
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: 100%;
}

/* Header Row - must be above body frozen cells */
.table-header-row {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-tertiary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* When sticky mode is enabled, table header stacks below filter bar + toolbar */
.sticky-mode .table-header-row {
  top: calc(var(--filter-bar-height, 0px) + var(--toolbar-height, 0px));
}

.table-header-cells {
  display: flex;
}

.table-header-cell {
  padding: 1.25rem 1rem;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-primary);
  font-weight: 600;
  color: var(--text-primary);
  position: relative;
  user-select: none;
  cursor: grab;
  flex-shrink: 0;
}

.table-header-cell:active {
  cursor: grabbing;
}

.table-header-cell.dragging {
  opacity: 0.4;
  background: var(--accent-primary-dark);
  transform: scale(0.95);
}

/* TransitionGroup animation for column reordering */
.column-reorder-move {
  transition: transform 0.2s ease;
}

.column-reorder-enter-active,
.column-reorder-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.column-reorder-enter-from,
.column-reorder-leave-to {
  opacity: 0;
}

/* Frozen type column */
.frozen-col {
  position: sticky !important;
  left: 0 !important;
  background: var(--bg-tertiary) !important;
  width: 85px !important;
  min-width: 85px !important;
  max-width: 85px !important;
  flex-shrink: 0 !important;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.15);
}

/* Type column header - highest z-index */
.type-column-header {
  cursor: default !important;
  z-index: 210 !important;
  border-bottom: 1px solid var(--border-primary);
}

/* Type column cells - lower than header row */
.type-column-cell {
  position: relative;
  z-index: 10 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-bottom: 1px solid var(--border-primary);
}

/* Type column body - sticky left, inherit row background for striping/hover */
.data-table :deep(.p-datatable-tbody > tr > .type-column) {
  background: inherit !important;
  position: sticky !important;
  left: 0 !important;
  z-index: 2 !important;
}

.table-row {
  display: flex;
  cursor: pointer;
  background: var(--bg-secondary);
  height: 48px;
  min-height: 48px;
  max-height: 48px;
}

/* Group header row */
.group-header-row {
  background: var(--bg-tertiary) !important;
  border-top: 2px solid var(--accent-primary);
  cursor: default;
  position: sticky;
  top: calc(var(--filter-bar-height, 0px) + var(--toolbar-height, 0px) + 49px);
  z-index: 50;
}

.group-header-row:first-child {
  border-top: none;
}

.group-header-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-primary);
}

.group-icon {
  color: var(--accent-primary);
  font-size: 1.1rem;
}

.group-header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border-primary);
}

.group-label {
  color: var(--text-tertiary);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-value {
  font-weight: 600;
  color: var(--text-primary);
}

.group-count {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.table-row.row-odd {
  background: var(--bg-tertiary);
}

.table-row:hover {
  background: var(--bg-hover) !important;
}

.table-row.keyboard-selected {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
  background: var(--accent-primary-dark) !important;
}

/* Inherit row background for frozen column */
.table-row .frozen-col {
  background: inherit !important;
}

.table-cell {
  padding: 0 1rem;
  border-bottom: 1px solid var(--border-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 100%;
}

/* Ensure cell content doesn't overflow */
.table-cell > * {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Column header content */
.column-header-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.column-header-content.sortable {
  cursor: pointer;
}

.column-drag-handle {
  color: var(--text-tertiary);
  font-size: 0.7rem;
  margin-right: 0.5rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.table-header-cell:hover .column-drag-handle {
  opacity: 1;
}

.column-header-text {
  margin-right: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort-icon {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.sort-icon.pi-sort-amount-up-alt,
.sort-icon.pi-sort-amount-down {
  color: var(--accent-primary);
}

/* Resize handle */
.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle:hover,
.tanstack-table.is-resizing .resize-handle {
  background: var(--accent-primary);
}

/* Table body */
.tanstack-table td {
  padding: 1rem;
  border-bottom: 1px solid var(--border-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.tanstack-table tbody tr {
  cursor: pointer;
  background: var(--bg-secondary);
}

.tanstack-table tbody tr:nth-child(odd) {
  background: var(--bg-tertiary);
}

.tanstack-table tbody tr:hover {
  background: var(--bg-hover) !important;
}

.tanstack-table tbody tr.keyboard-selected {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
  background: var(--accent-primary-dark) !important;
}

/* Type cell link */
.type-cell-link {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  width: 100%;
  height: 100%;
}

.type-badge {
  display: inline-block;
  padding: 0.3rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
  width: 58px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.type-cell-link:hover .type-badge {
  transform: scale(1.08);
  filter: brightness(1.15);
}

/* Task type cell */
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

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

/* Loading and error states - centered content */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.empty-icon,
.loading-icon,
.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  color: var(--text-disabled);
}

.loading-icon {
  color: var(--accent-primary);
}

/* Error overlay - sticky to stay visible regardless of scroll position */
.error-overlay {
  position: sticky;
  top: 0; /* Default: non-sticky toolbar */
  left: 0;
  width: calc(100vw - 13rem);
  height: calc(100vh - 150px);
  margin-bottom: calc(-100vh + 150px); /* Negative margin to not affect layout */
  display: flex;
  background: rgba(42, 42, 42, 0.95);
  z-index: 50;
}

/* When toolbar is sticky, offset below it */
.table-toolbar--sticky ~ .error-overlay {
  top: 100px;
  height: calc(100vh - 250px);
  margin-bottom: calc(-100vh + 250px);
}

.table-toolbar.wide-view ~ .error-overlay {
  width: calc(100vw - 4.3rem);
}

.error-icon {
  color: #ef4444;
}

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.error-message {
  font-size: 0.9rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 400px;
  margin-bottom: 1.5rem;
}

.retry-btn {
  background: var(--accent-primary) !important;
  border-color: var(--accent-primary) !important;
}

.retry-btn:hover {
  background: var(--accent-secondary) !important;
  border-color: var(--accent-secondary) !important;
}

.scroll-trigger {
  height: 20px;
  margin: 1rem 0;
  position: sticky;
  left: 0;
}

/* Gallery View - vertical scroll handled by parent */
.gallery-view {
  padding-top: 2rem;
  padding-right: 1.5rem;
}

.gallery-group-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  background: var(--bg-tertiary);
  border-top: 2px solid var(--accent-primary);
  border-radius: 6px;
  position: sticky;
  top: calc(var(--filter-bar-height, 0px) + var(--toolbar-height, 0px));
  z-index: 50;

  .group-icon {
    color: var(--accent-primary);
    font-size: 1.1rem;
  }

  .group-label {
    color: var(--text-tertiary);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .group-value {
    color: var(--text-primary);
    font-weight: 600;
  }

  .group-count {
    color: var(--text-tertiary);
    font-size: 0.85rem;
  }
}

.gallery-view .gallery-group-header:first-child {
  margin-top: 0;
}

.gallery-grid {
  display: grid;
  gap: 2rem;
}

.gallery-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  cursor: pointer;
  transition: all var(--transition-normal);
  min-width: 0;
  overflow: hidden;
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

.gallery-item.compact {
  padding: 0;
}

.gallery-item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.gallery-header-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.gallery-header-date {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  margin-right: 0.5rem;
}

.gallery-item.compact .gallery-header-date {
  margin-right: 0.3rem;
}

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
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.gallery-type-badge-link:hover {
  transform: scale(1.08);
  filter: brightness(1.15);
}

.gallery-item-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.craft-preview-wrapper {
  width: 100%;
  height: 100%;
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

.gallery-item-content {
  min-width: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.gallery-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  overflow: hidden;
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

/* Task items: full-height thumbnail, minimal footer */
.gallery-item-footer {
  padding: 0.5rem 0;
  min-height: 0;
}

.footer-project {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-project i {
  font-size: 0.7rem;
  flex-shrink: 0;
}
</style>


