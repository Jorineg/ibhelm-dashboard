<template>
  <div class="home-view" @click="closeSyncPopup">
    <!-- Header -->
    <PageHeader
      title="ibhelm Dashboard"
      :user-email="user?.email"
      :show-sign-out="true"
      @sign-out="handleSignOut"
    >
      <template #after-title>
        <!-- View Tabs -->
        <nav class="view-tabs">
          <button 
            v-for="view in viewTabs"
            :key="view.id"
            class="view-tab" 
            :class="{ active: activeView === view.id }"
            @click="switchView(view.id)"
          >
            {{ view.label }}
          </button>
        </nav>
      </template>
      
      <template #center>
        <!-- Sync Status Indicator (minimal) -->
        <div class="sync-status-wrapper" @click.stop>
          <SyncStatusIndicator 
            :overall-status="overallStatus"
            :tooltip="headerTooltip"
            @click="toggleSyncPopup" 
          />
          <!-- Popup -->
          <div v-if="syncPopupVisible" class="sync-popup-container">
            <SyncStatusPanel 
              :sync-status="syncStatus" 
              :is-source-outdated="isSourceOutdated"
              :is-files-outdated="isFilesOutdated"
              :is-thumbnails-outdated="isThumbnailsOutdated"
              :is-attachments-outdated="isAttachmentsOutdated"
              :get-queue-ok-tooltip="getQueueOkTooltip"
              :get-queue-pending-tooltip="getQueuePendingTooltip"
              :get-failed-tooltip="getFailedTooltip"
            />
          </div>
        </div>
      </template>
      
      <template #actions>
        <Tooltip v-if="isAdmin" text="Services" position="bottom">
          <button class="services-btn" @click="goToServices">
            <i class="pi pi-server"></i>
          </button>
        </Tooltip>
        <Tooltip text="Settings" position="bottom">
          <button class="settings-btn" @click="goToSettings">
            <i class="pi pi-cog"></i>
          </button>
        </Tooltip>
      </template>
    </PageHeader>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Config Panel (left side) - hidden for projects and people views -->
      <ConfigurationPanel v-if="activeView === 'items'" ref="configPanelRef" />

      <!-- Filters and Table (aligned container) -->
      <main class="center-content" :style="stickyToolbar && activeView === 'items' ? { '--filter-bar-height': filterBarHeight + 'px' } : undefined">
        <main class="center-content-inner">
        <FilterBar v-if="activeView === 'items'" ref="filterBarRef" :available-columns="availableColumns" class="filters-section" :sticky="stickyToolbar" />
        <DataTable
          ref="dataTableRef"
          :sticky-toolbar="stickyToolbar"
          :search-query="searchQuery"
          @update:search-query="updateSearchQuery($event)"
          @clear-search="clearSearch"
          :items="filteredAndSearchedItems"
          :columns="availableColumns"
          :loading="loading"
          :count-loading="countLoading"
          :group-counts="groupCounts"
          :group-counts-loading="groupCountsLoading"
          :revalidating="revalidating"
          :error="error"
          :has-more="hasMore"
          :total-count="totalCount"
          :visible-columns="activeConfig?.visibleColumns || []"
          :column-order="activeConfig?.columnOrder || []"
          :column-widths="activeConfig?.columnWidths || {}"
          :show-tasks="activeConfig?.showTasks ?? true"
          :show-emails="activeConfig?.showEmails ?? true"
          :show-craft="activeConfig?.showCraft ?? true"
          :show-files="activeConfig?.showFiles ?? true"
          :view-mode="activeConfig?.viewMode || 'list'"
          :sort-config="activeConfig?.sortConfig || { field: 'updated_at', order: 'desc' }"
          :group-config="activeConfig?.groupConfig || null"
          :view-type="activeView"
          :selected-task-types="selectedTaskTypes"
          :selected-row="selectedRow"
          :selected-col="selectedCol"
          :hovered-row="hoveredRow"
          :exporting="exporting"
          :filter-config-id="activeConfig?.id"
          :project-filter="activeConfig?.quickFilters?.project || ''"
          :grid-columns="gridColumns"
          @update:visible-columns="handleUpdateVisibleColumns"
          @update:column-order="handleUpdateColumnOrder"
          @update:column-widths="handleUpdateColumnWidths"
          @update:show-tasks="handleUpdateShowTasks"
          @update:show-emails="handleUpdateShowEmails"
          @update:show-craft="handleUpdateShowCraft"
          @update:show-files="handleUpdateShowFiles"
          @update:view-mode="handleUpdateViewMode"
          @update:selected-task-types="handleUpdateSelectedTaskTypes"
          @update:selected-row="selectedRow = $event"
          @update:selected-col="selectedCol = $event"
          @update:hovered-row="hoveredRow = $event"
          @update:project-filter="handleUpdateProjectFilter"
          @update:group-config="handleUpdateGroupConfig"
          @row-click="handleRowClick"
          @load-more="handleLoadMore"
          @sort="handleSort"
          @export="handleExport"
          @retry="handleRetry"
        />
      </main>
      <div style="width: 1.5rem; flex-shrink: 0; z-index: 1000; position: absolute; right: 0.8rem; top: 6.5rem; bottom: 0; background: var(--bg-primary);"></div>
      </main>
    </div>

    <!-- Detail Dialog -->
    <ItemDetailDialog
      v-model:visible="detailDialogVisible"
      :item="selectedItem"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import ExcelJS from 'exceljs'
import { useRouter } from 'vue-router'
import { PageHeader, Tooltip } from '@/components/common'
import ConfigurationPanel from '@/components/ConfigurationPanel.vue'
import FilterBar from '@/components/FilterBar.vue'
import DataTable from '@/components/DataTable.vue'
import ItemDetailDialog from '@/components/ItemDetailDialog.vue'
import SyncStatusIndicator from '@/components/SyncStatusIndicator.vue'
import SyncStatusPanel from '@/components/SyncStatusPanel.vue'
import { useAuth } from '@/composables/useAuth'
import { useFilterConfigs, hasRecentConfigSwitch } from '@/composables/useFilterConfigs'
import { useData } from '@/composables/useData'
import { useSyncStatus } from '@/composables/useSyncStatus'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { useKeyBindings } from '@/composables/useKeyBindings'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { useUserSettings } from '@/composables/useUserSettings'
import { supabase } from '@/lib/supabase'
import type { ViewDataItem, Column, SortConfig, GroupConfig, ViewType } from '@/types'

const router = useRouter()
const { user, signOut, isAdmin } = useAuth()
const { activeConfig, configurations, updateConfiguration, setCurrentView, currentViewType, createConfiguration, deleteConfiguration, setActiveConfiguration, updateSearchQuery, updateGroupConfig, saveActiveConfiguration, hasUnsavedChanges } = useFilterConfigs()
const { syncStatus, overallStatus, isSourceOutdated, isFilesOutdated, isThumbnailsOutdated, isAttachmentsOutdated, headerTooltip, getQueueOkTooltip, getQueuePendingTooltip, getFailedTooltip } = useSyncStatus()
const { taskTypes, initialize: initTaskTypes } = useTaskTypes()
const { keyBindings } = useKeyBindings()
const { craftSpaceId, filesBucket, enabledFileIgnorePatterns } = useAppearanceSettings()
const { hideCompletedTasks, hideInactiveProjects, stickyToolbar, initialize: initUserSettings } = useUserSettings()

// Transform craft URL to include space ID (same as DataTable)
const transformCraftUrl = (url: string): string => {
  if (!url || !craftSpaceId.value) return url
  const blockIdMatch = url.match(/blockId=([^&]+)/)
  if (!blockIdMatch) return url
  return `craftdocs://open?spaceId=${craftSpaceId.value}&blockId=${blockIdMatch[1]}`
}

// Sync popup state
const syncPopupVisible = ref(false)

const toggleSyncPopup = () => {
  syncPopupVisible.value = !syncPopupVisible.value
}

const closeSyncPopup = () => {
  syncPopupVisible.value = false
}

// Grid zoom state (localStorage persisted) - number of columns per row
const GRID_ZOOM_STORAGE_KEY = 'ibhelm_grid_columns'
const GRID_COLUMN_LEVELS = [2, 3, 4, 6, 8, 11, 15]
const GRID_COLUMNS_DEFAULT = 4

const gridColumns = ref(
  parseInt(localStorage.getItem(GRID_ZOOM_STORAGE_KEY) || String(GRID_COLUMNS_DEFAULT))
)

const gridZoomIn = () => {
  const currentIdx = GRID_COLUMN_LEVELS.indexOf(gridColumns.value)
  const nextIdx = currentIdx === -1 ? 2 : Math.max(currentIdx - 1, 0) // fewer columns = zoom in
  gridColumns.value = GRID_COLUMN_LEVELS[nextIdx]
  localStorage.setItem(GRID_ZOOM_STORAGE_KEY, String(gridColumns.value))
}

const gridZoomOut = () => {
  const currentIdx = GRID_COLUMN_LEVELS.indexOf(gridColumns.value)
  const nextIdx = currentIdx === -1 ? 2 : Math.min(currentIdx + 1, GRID_COLUMN_LEVELS.length - 1) // more columns = zoom out
  gridColumns.value = GRID_COLUMN_LEVELS[nextIdx]
  localStorage.setItem(GRID_ZOOM_STORAGE_KEY, String(gridColumns.value))
}

// View tabs configuration
const viewTabs = [
  { id: 'items' as ViewType, label: 'Items' },
  { id: 'projects' as ViewType, label: 'Projects' },
  { id: 'people' as ViewType, label: 'People' }
]

// Active view state - sync with filter config's currentViewType
const activeView = computed(() => currentViewType.value)

const {
  dataItems,
  loading,
  countLoading,
  groupCounts,
  groupCountsLoading,
  revalidating,
  hasMore,
  totalCount,
  error,
  loadData,
  loadMore,
  fetchAllForExport
} = useData()

const exporting = ref(false)

const searchQuery = computed(() => activeConfig.value?.searchQuery || '')
const detailDialogVisible = ref(false)
const selectedItem = ref<ViewDataItem | null>(null)
const isPeeking = ref(false)
const wasSelectionModeActive = ref(false) // Track if selection was active before opening dialog

// Keyboard navigation
const selectedRow = ref(-1)
const selectedCol = ref(0)
const hoveredRow = ref(-1)
const dataTableRef = ref<{ 
  focusSearch: () => void
  scrollToSelectedCell: () => void
  getGalleryColumns: () => number
  scrollToSelectedGalleryItem: () => void
} | null>(null)

// Ref for ConfigurationPanel to trigger rename
const configPanelRef = ref<{ startRenameActive: () => void } | null>(null)

// Ref for FilterBar to focus/clear quick filters
const filterBarRef = ref<{ focusQuickFilter: (filter: string) => void; clearQuickFilter: (filter: string) => void } | null>(null)

// FilterBar height tracking for sticky toolbar stacking
const filterBarHeight = ref(0)
const filterBarResizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    filterBarHeight.value = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height
  }
})

const selectedTaskTypes = computed(() => {
  if (!activeConfig.value) return []
  return activeConfig.value.selectedTaskTypes ?? taskTypes.value.map(t => t.id)
})

// Column definitions (type column is fixed/frozen in DataTable)
const itemColumns: Column[] = [
  { field: 'name', header: 'Name', sortable: true, width: '300px' },
  { field: 'description', header: 'Description', sortable: false, width: '400px' },
  { field: 'body', header: 'Body', sortable: false, width: '400px' },
  { field: 'status', header: 'Status', sortable: true, width: '120px' },
  { field: 'project', header: 'Project', sortable: true, width: '200px' },
  { field: 'customer', header: 'Customer', sortable: true, width: '200px' },
  { field: 'location', header: 'Location', sortable: true, width: '150px' },
  { field: 'location_path', header: 'Location Path', sortable: true, width: '250px' },
  { field: 'cost_group', header: 'Cost Group', sortable: true, width: '150px' },
  { field: 'cost_group_code', header: 'Cost Code', sortable: true, width: '100px' },
  { field: 'due_date', header: 'Due Date', sortable: true, width: '150px' },
  { field: 'priority', header: 'Priority', sortable: true, width: '120px' },
  { field: 'progress', header: 'Progress', sortable: true, width: '100px' },
  { field: 'accumulated_estimated_minutes', header: 'Est. Minutes', sortable: true, width: '120px' },
  { field: 'logged_minutes', header: 'Logged Min.', sortable: true, width: '120px' },
  { field: 'billable_minutes', header: 'Billable Min.', sortable: true, width: '120px' },
  { field: 'tasklist', header: 'Tasklist', sortable: true, width: '150px' },
  { field: 'creator', header: 'Creator', sortable: true, width: '200px' },
  { field: 'assigned_to', header: 'Assigned To', sortable: false, width: '200px' },
  { field: 'tags', header: 'Tags', sortable: false, width: '200px' },
  { field: 'recipients', header: 'Recipients', sortable: false, width: '250px' },
  { field: 'conversation_subject', header: 'Conversation', sortable: true, width: '250px' },
  { field: 'attachment_count', header: 'Attachments', sortable: true, width: '120px' },
  { field: 'file_extension', header: 'File Ext.', sortable: true, width: '100px' },
  { field: 'created_at', header: 'Created', sortable: true, width: '150px' },
  { field: 'updated_at', header: 'Updated', sortable: true, width: '150px' }
]

const projectColumns: Column[] = [
  { field: 'name', header: 'Project Name', sortable: true, width: '250px' },
  { field: 'description', header: 'Description', sortable: false, width: '300px' },
  { field: 'status', header: 'Status', sortable: true, width: '120px' },
  { field: 'company_name', header: 'Company', sortable: true, width: '200px' },
  { field: 'client_name', header: 'Client', sortable: true, width: '200px' },
  { field: 'client_email', header: 'Client Email', sortable: true, width: '200px' },
  { field: 'default_location_name', header: 'Default Location', sortable: true, width: '150px' },
  { field: 'default_location_path', header: 'Location Path', sortable: true, width: '250px' },
  { field: 'default_cost_group_name', header: 'Cost Group', sortable: true, width: '150px' },
  { field: 'default_cost_group_code', header: 'Cost Code', sortable: true, width: '100px' },
  { field: 'nas_folder_path', header: 'NAS Path', sortable: true, width: '250px' },
  { field: 'internal_notes', header: 'Notes', sortable: false, width: '300px' },
  { field: 'task_count', header: 'Tasks', sortable: true, width: '80px' },
  { field: 'completed_task_count', header: 'Completed', sortable: true, width: '100px' },
  { field: 'file_count', header: 'Files', sortable: true, width: '80px' },
  { field: 'conversation_count', header: 'Conversations', sortable: true, width: '120px' },
  { field: 'contractor_count', header: 'Contractors', sortable: true, width: '100px' },
  { field: 'start_date', header: 'Start Date', sortable: true, width: '150px' },
  { field: 'end_date', header: 'End Date', sortable: true, width: '150px' },
  { field: 'created_at', header: 'Created', sortable: true, width: '150px' },
  { field: 'updated_at', header: 'Updated', sortable: true, width: '150px' }
]

const peopleColumns: Column[] = [
  { field: 'display_name', header: 'Name', sortable: true, width: '200px' },
  { field: 'primary_email', header: 'Email', sortable: true, width: '250px' },
  { field: 'is_internal', header: 'Internal', sortable: true, width: '100px' },
  { field: 'is_company', header: 'Company', sortable: true, width: '100px' },
  { field: 'preferred_contact_method', header: 'Contact Method', sortable: true, width: '150px' },
  { field: 'notes', header: 'Notes', sortable: false, width: '300px' },
  { field: 'tw_company_name', header: 'TW Company', sortable: true, width: '200px' },
  { field: 'tw_company_website', header: 'Website', sortable: true, width: '200px' },
  { field: 'tw_user_first_name', header: 'TW First Name', sortable: true, width: '150px' },
  { field: 'tw_user_last_name', header: 'TW Last Name', sortable: true, width: '150px' },
  { field: 'tw_user_email', header: 'TW Email', sortable: true, width: '200px' },
  { field: 'm_contact_name', header: 'Missive Name', sortable: true, width: '200px' },
  { field: 'm_contact_email', header: 'Missive Email', sortable: true, width: '200px' },
  { field: 'db_created_at', header: 'Created', sortable: true, width: '150px' },
  { field: 'db_updated_at', header: 'Updated', sortable: true, width: '150px' }
]

// Available columns based on active view
const availableColumns = computed<Column[]>(() => {
  switch (activeView.value) {
    case 'projects': return projectColumns
    case 'people': return peopleColumns
    default: return itemColumns
  }
})

// Switch view handler - just changes view, watcher handles data loading
const switchView = (view: ViewType) => {
  if (currentViewType.value === view) return
  setCurrentView(view)
}

// Filtered items (server-side filtering is primary)
const filteredAndSearchedItems = computed(() => dataItems.value)

// Watch for config changes - use JSON string comparison to avoid deep reactivity issues
const dataFetchConfigKey = computed(() => {
  if (!activeConfig.value) return null
  return JSON.stringify({
    id: activeConfig.value.id,
    showTasks: activeConfig.value.showTasks,
    showEmails: activeConfig.value.showEmails,
    showCraft: activeConfig.value.showCraft,
    showFiles: activeConfig.value.showFiles,
    selectedTaskTypes: activeConfig.value.selectedTaskTypes,
    searchQuery: activeConfig.value.searchQuery,
    quickFilters: activeConfig.value.quickFilters,
    columnFilters: activeConfig.value.columnFilters,
    groupConfig: activeConfig.value.groupConfig,
    hideCompletedTasks: hideCompletedTasks.value,
    hideInactiveProjects: hideInactiveProjects.value,
    fileIgnorePatterns: enabledFileIgnorePatterns.value
  })
})

// Debounce timer for filter changes
let debounceTimer: number | null = null
let isFirstLoad = true

// Simple watch: debounce typing (300ms), then load
// Race conditions handled inside loadData via version checking
watch(dataFetchConfigKey, (newKey) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!newKey || !activeConfig.value) return
  
  // Capture current values (they could change during debounce)
  const params = {
    showTasks: activeConfig.value.showTasks,
    showEmails: activeConfig.value.showEmails,
    showCraft: activeConfig.value.showCraft ?? true,
    showFiles: activeConfig.value.showFiles ?? true,
    sortConfig: activeConfig.value.sortConfig,
    config: activeConfig.value,
    search: searchQuery.value,
    viewType: currentViewType.value,
    taskTypes: selectedTaskTypes.value
  }
  
  const doLoad = () => {
    loadData(
      params.showTasks, params.showEmails, params.showCraft, params.showFiles,
      params.search, params.config, params.sortConfig, params.viewType, params.taskTypes,
      hideCompletedTasks.value, hideInactiveProjects.value, enabledFileIgnorePatterns.value
    )
  }
  
  // No debounce for first load or config switches (show cache instantly)
  if (isFirstLoad || hasRecentConfigSwitch()) {
    isFirstLoad = false
    doLoad()
  } else {
    debounceTimer = window.setTimeout(doLoad, 300)
  }
}, { immediate: true })

const clearSearch = () => {
  updateSearchQuery('')
}

// Watch for visible columns changes
watch(() => activeConfig.value?.visibleColumns, (newColumns, oldColumns) => {
  if (!activeConfig.value || !newColumns || !oldColumns) return
  
  const columnsChanged = JSON.stringify(newColumns) !== JSON.stringify(oldColumns)
  if (!columnsChanged) return
  
  const currentWidths = activeConfig.value.columnWidths || {}
  const newWidths: Record<string, string> = {}
  
  Object.keys(currentWidths).forEach(field => {
    if (newColumns.includes(field)) {
      newWidths[field] = currentWidths[field]
    }
  })
  
  if (JSON.stringify(newWidths) !== JSON.stringify(currentWidths)) {
    updateConfiguration(activeConfig.value.id, { columnWidths: newWidths })
  }
}, { deep: true })

// Reset scroll position when switching filter configurations
watch(() => activeConfig.value?.id, () => {
  const scrollContainer = document.querySelector('.center-content')
  if (scrollContainer) {
    scrollContainer.scrollTo({ top: 0, left: 0 })
  }
})

// Navigation
const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

const goToSettings = () => {
  router.push('/settings')
}

const goToServices = () => {
  router.push('/services')
}

// Event handlers
const handleRowClick = (item: ViewDataItem) => {
  // Track if selection mode was active before opening dialog
  wasSelectionModeActive.value = selectedRow.value >= 0
  
  // Find the index of the clicked item and set selection to it
  const itemIndex = filteredAndSearchedItems.value.findIndex(i => i.id === item.id)
  if (itemIndex >= 0) {
    selectedRow.value = itemIndex
  }
  
  selectedItem.value = item
  detailDialogVisible.value = true
}

const handleLoadMore = async () => {
  if (activeConfig.value && hasMore.value && !loading.value) {
    await loadMore(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      activeConfig.value.showCraft ?? true,
      activeConfig.value.showFiles ?? true,
      searchQuery.value,
      activeConfig.value,
      currentViewType.value,
      selectedTaskTypes.value,
      hideCompletedTasks.value,
      hideInactiveProjects.value,
      enabledFileIgnorePatterns.value
    )
  }
}

const handleUpdateVisibleColumns = (columns: string[]) => {
  if (activeConfig.value) {
    const newWidths: Record<string, string> = {}
    Object.keys(activeConfig.value.columnWidths || {}).forEach(field => {
      if (columns.includes(field)) {
        newWidths[field] = activeConfig.value!.columnWidths![field]
      }
    })
    
    updateConfiguration(activeConfig.value.id, { 
      visibleColumns: columns,
      columnWidths: newWidths
    })
  }
}

const handleUpdateColumnOrder = (order: string[]) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { columnOrder: order })
  }
}

const handleUpdateColumnWidths = (widths: Record<string, string>) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { columnWidths: widths })
  }
}

const handleUpdateShowTasks = (show: boolean) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { showTasks: show })
  }
}

const handleUpdateShowEmails = (show: boolean) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { showEmails: show })
  }
}

const handleUpdateShowCraft = (show: boolean) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { showCraft: show })
  }
}

const handleUpdateShowFiles = (show: boolean) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { showFiles: show })
  }
}

const handleUpdateViewMode = (mode: 'list' | 'gallery') => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { viewMode: mode })
  }
}

const handleUpdateSelectedTaskTypes = (types: string[]) => {
  if (activeConfig.value) {
    // Persist selected task types to configuration - the watch will trigger data reload
    updateConfiguration(activeConfig.value.id, { selectedTaskTypes: types })
  }
}

const handleUpdateProjectFilter = (value: string) => {
  if (activeConfig.value) {
    const newFilters = { ...activeConfig.value.quickFilters }
    if (value) {
      newFilters.project = value
    } else {
      delete newFilters.project
    }
    updateConfiguration(activeConfig.value.id, { quickFilters: newFilters })
  }
}

const handleUpdateGroupConfig = (config: GroupConfig | null) => {
  updateGroupConfig(config)
}

const handleSort = async (sortConfig: SortConfig) => {
  if (activeConfig.value) {
    // Save sort config to filter configuration for persistence
    updateConfiguration(activeConfig.value.id, { sortConfig })
    
    await loadData(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      activeConfig.value.showCraft ?? true,
      activeConfig.value.showFiles ?? true,
      searchQuery.value,
      activeConfig.value,
      sortConfig,
      currentViewType.value,
      selectedTaskTypes.value,
      hideCompletedTasks.value,
      hideInactiveProjects.value,
      enabledFileIgnorePatterns.value
    )
  }
}

const handleRetry = async () => {
  if (activeConfig.value) {
    await loadData(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      activeConfig.value.showCraft ?? true,
      activeConfig.value.showFiles ?? true,
      searchQuery.value,
      activeConfig.value,
      activeConfig.value.sortConfig,
      currentViewType.value,
      selectedTaskTypes.value,
      hideCompletedTasks.value,
      hideInactiveProjects.value,
      enabledFileIgnorePatterns.value
    )
  }
}

const handleExport = async () => {
  if (exporting.value) return
  exporting.value = true
  
  try {
    const allData = await fetchAllForExport(
      activeConfig.value?.showTasks ?? true,
      activeConfig.value?.showEmails ?? true,
      activeConfig.value?.showCraft ?? true,
      activeConfig.value?.showFiles ?? true,
      searchQuery.value,
      activeConfig.value || null,
      currentViewType.value,
      selectedTaskTypes.value,
      hideCompletedTasks.value,
      hideInactiveProjects.value,
      enabledFileIgnorePatterns.value
    )
    
    // Get visible columns only, plus type and link
    const visibleFields = activeConfig.value?.visibleColumns || []
    const columns = availableColumns.value.filter(c => visibleFields.includes(c.field))
    
    // Build headers and fields: Type first, then visible columns, then Link
    const headers = ['Type', ...columns.map(c => c.header), 'Link']
    const fields = ['type', ...columns.map(c => c.field)]
    
    // Helper to get primary URL (for files, export storage path since signed URLs expire)
    const getLink = (item: ViewDataItem): string => {
      if (item.teamwork_url) return item.teamwork_url
      if (item.missive_url) return item.missive_url
      if (item.craft_url) return transformCraftUrl(item.craft_url)
      if (item.storage_path) return `storage:${item.storage_path}`
      return ''
    }
    
    // Excel cell limit is 32767 chars
    const truncate = (val: string) => val.length > 32000 ? val.slice(0, 32000) + '...' : val
    
    // Convert data to rows
    const rows = allData.map(item => {
      const rowData = fields.map(field => {
        const value = item[field]
        if (value === null || value === undefined) return ''
        if (Array.isArray(value)) return truncate(value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', '))
        if (typeof value === 'object') return truncate(JSON.stringify(value))
        return typeof value === 'string' ? truncate(value) : value
      })
      rowData.push(getLink(item))
      return rowData
    })
    
    // Create workbook and worksheet
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(activeView.value)
    ws.addRows([headers, ...rows])
    
    // Download
    const filename = `${activeView.value}_export_${new Date().toISOString().slice(0, 10)}.xlsx`
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export failed:', error)
  } finally {
    exporting.value = false
  }
}

// Keyboard shortcut handlers
const handleKeyDown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  
  // Let browser handle Ctrl/Cmd/Alt modified shortcuts (e.g., Cmd+R for reload)
  // Shift is allowed since we use it for clearing filters
  if (event.ctrlKey || event.metaKey || event.altKey) return
  
  const bindings = keyBindings.value
  const key = event.key
  
  // Escape or Enter: blur input, or close dialog, or deselect
  if (key === bindings.closeDialog.key || (key === 'Enter' && isTyping)) {
    event.preventDefault()
    if (isTyping) {
      (target as HTMLInputElement).blur()
      return
    }
    if (detailDialogVisible.value) {
      detailDialogVisible.value = false
      isPeeking.value = false
      // Restore selection state: clear if it wasn't active before opening
      if (!wasSelectionModeActive.value) {
        selectedRow.value = -1
      }
      return
    }
    if (selectedRow.value >= 0) {
      selectedRow.value = -1
    }
    return
  }
  
  // Toggle detail popup (works even when dialog is open)
  if (key === bindings.openDetail.key && !isTyping) {
    event.preventDefault()
    if (detailDialogVisible.value) {
      detailDialogVisible.value = false
      isPeeking.value = false
      // Restore selection state: clear if it wasn't active before opening
      if (!wasSelectionModeActive.value) {
        selectedRow.value = -1
      }
    } else if (selectedRow.value >= 0) {
      // Opening from selection mode - remember this
      wasSelectionModeActive.value = true
      const item = filteredAndSearchedItems.value[selectedRow.value]
      if (item) {
        selectedItem.value = item
        detailDialogVisible.value = true
      }
    }
    return
  }
  
  // Arrow up/down navigation when dialog is open: show prev/next item
  if (detailDialogVisible.value && !isPeeking.value) {
    const maxIndex = filteredAndSearchedItems.value.length - 1
    
    if (key === bindings.navigateUp.key) {
      event.preventDefault()
      if (selectedRow.value > 0) {
        selectedRow.value--
        selectedItem.value = filteredAndSearchedItems.value[selectedRow.value]
      }
      return
    }
    
    if (key === bindings.navigateDown.key) {
      event.preventDefault()
      if (selectedRow.value < maxIndex) {
        selectedRow.value++
        selectedItem.value = filteredAndSearchedItems.value[selectedRow.value]
      } else if (selectedRow.value === maxIndex && hasMore.value && !loading.value) {
        handleLoadMore()
      }
      return
    }
  }
  
  // Peek detail (hold key to show, release to hide)
  if (key === bindings.peek.key && !isTyping && !detailDialogVisible.value) {
    event.preventDefault()
    // Track selection state before peeking
    wasSelectionModeActive.value = selectedRow.value >= 0
    // Use selected row, or hovered row if nothing selected
    const targetRow = selectedRow.value >= 0 ? selectedRow.value : hoveredRow.value
    if (targetRow >= 0) {
      const item = filteredAndSearchedItems.value[targetRow]
      if (item) {
        // Set selectedRow to the peeked item's index for arrow navigation
        selectedRow.value = targetRow
        selectedItem.value = item
        detailDialogVisible.value = true
        isPeeking.value = true
      }
    }
    return
  }
  
  // Ignore other shortcuts if typing or dialog is open
  if (isTyping || detailDialogVisible.value) return
  
  // Filter config shortcuts 1-9
  const configNumber = parseInt(key)
  if (configNumber >= 1 && configNumber <= 9) {
    const configBindingKey = `filterConfig${configNumber}` as keyof typeof bindings
    if (key === bindings[configBindingKey].key) {
      event.preventDefault()
      const configs = configurations.value
      if (configNumber <= configs.length) {
        setActiveConfiguration(configs[configNumber - 1].id)
      }
      return
    }
  }
  
  // Filter config 10 (key '0')
  if (key === bindings.filterConfig0.key) {
    event.preventDefault()
    const configs = configurations.value
    if (configs.length >= 10) {
      setActiveConfiguration(configs[9].id)
    }
    return
  }
  
  // Navigation shortcuts - handle differently for list vs gallery view
  const isGalleryView = activeConfig.value?.viewMode === 'gallery'
  const maxIndex = filteredAndSearchedItems.value.length - 1
  
  const scrollToSelected = () => {
    nextTick(() => {
      if (isGalleryView) {
        dataTableRef.value?.scrollToSelectedGalleryItem()
      } else {
        dataTableRef.value?.scrollToSelectedCell()
      }
    })
  }
  
  const initSelection = () => {
    if (selectedRow.value === -1 && maxIndex >= 0) {
      selectedRow.value = 0
      scrollToSelected()
      return true
    }
    return false
  }
  
  if (key === bindings.navigateDown.key) {
    event.preventDefault()
    if (initSelection()) return
    if (isGalleryView) {
      // Move down by number of columns in gallery
      const cols = dataTableRef.value?.getGalleryColumns() || 1
      const newIndex = Math.min(selectedRow.value + cols, maxIndex)
      if (newIndex !== selectedRow.value) {
        selectedRow.value = newIndex
        scrollToSelected()
      } else if (selectedRow.value === maxIndex && hasMore.value && !loading.value) {
        handleLoadMore()
      }
    } else {
      if (selectedRow.value < maxIndex) {
        selectedRow.value++
        scrollToSelected()
      } else if (selectedRow.value === maxIndex && hasMore.value && !loading.value) {
        handleLoadMore()
      }
    }
    return
  }
  
  if (key === bindings.navigateUp.key) {
    event.preventDefault()
    if (initSelection()) return
    if (isGalleryView) {
      // Move up by number of columns in gallery
      const cols = dataTableRef.value?.getGalleryColumns() || 1
      const newIndex = Math.max(selectedRow.value - cols, 0)
      if (newIndex !== selectedRow.value) {
        selectedRow.value = newIndex
        scrollToSelected()
      }
    } else {
      if (selectedRow.value > 0) {
        selectedRow.value--
        scrollToSelected()
      }
    }
    return
  }
  
  if (key === bindings.navigateLeft.key) {
    event.preventDefault()
    if (isGalleryView) {
      // Move left by 1 in gallery
      if (initSelection()) return
      if (selectedRow.value > 0) {
        selectedRow.value--
        scrollToSelected()
      }
    } else {
      // Horizontal scroll in list view - scroll the .center-content parent
      document.querySelector('.center-content')?.scrollBy({ left: -200, behavior: 'smooth' })
    }
    return
  }
  
  if (key === bindings.navigateRight.key) {
    event.preventDefault()
    if (isGalleryView) {
      // Move right by 1 in gallery
      if (initSelection()) return
      if (selectedRow.value < maxIndex) {
        selectedRow.value++
        scrollToSelected()
      } else if (selectedRow.value === maxIndex && hasMore.value && !loading.value) {
        handleLoadMore()
      }
    } else {
      // Horizontal scroll in list view - scroll the .center-content parent
      document.querySelector('.center-content')?.scrollBy({ left: 200, behavior: 'smooth' })
    }
    return
  }
  
  // Open link (Enter)
  if (key === bindings.openLink.key && selectedRow.value >= 0) {
    event.preventDefault()
    const item = filteredAndSearchedItems.value[selectedRow.value]
    if (item) {
      // Handle files with signed URL
      if (item.type === 'file' && item.storage_path) {
        supabase.storage
          .from(filesBucket.value)
          .createSignedUrl(item.storage_path, 300)
          .then(({ data, error }) => {
            if (!error && data?.signedUrl) {
              window.open(data.signedUrl, '_blank')
            }
          })
        return
      }
      // Other item types
      let url = item.teamwork_url || item.missive_url
      if (!url && item.craft_url) {
        url = transformCraftUrl(item.craft_url)
      }
      if (url) window.open(url, '_blank')
    }
    return
  }
  
  // New config
  if (key === bindings.newConfig.key) {
    event.preventDefault()
    createConfiguration()
    return
  }
  
  // Delete config
  if (key === bindings.deleteConfig.key) {
    event.preventDefault()
    if (activeConfig.value && configurations.value.length > 1) {
      deleteConfiguration(activeConfig.value.id)
    }
    return
  }
  
  // Rename config
  if (key === bindings.renameConfig.key) {
    event.preventDefault()
    configPanelRef.value?.startRenameActive()
    return
  }
  
  // Save config
  if (key === bindings.saveConfig.key) {
    event.preventDefault()
    if (hasUnsavedChanges.value) {
      saveActiveConfiguration()
    }
    return
  }
  
  // Focus search or clear search (Shift+S)
  if (key.toLowerCase() === bindings.focusSearch.key) {
    event.preventDefault()
    if (event.shiftKey) {
      clearSearch()
    } else {
      dataTableRef.value?.focusSearch()
    }
    return
  }
  
  // Toggle view
  if (key === bindings.toggleView.key) {
    event.preventDefault()
    const newMode = activeConfig.value?.viewMode === 'gallery' ? 'list' : 'gallery'
    handleUpdateViewMode(newMode)
    return
  }
  
  // Grid zoom in/out (only in gallery view)
  if (activeConfig.value?.viewMode === 'gallery') {
    if (key === bindings.gridZoomIn.key) {
      event.preventDefault()
      gridZoomIn()
      return
    }
    if (key === bindings.gridZoomOut.key) {
      event.preventDefault()
      gridZoomOut()
      return
    }
  }
  
  // Quick filter shortcuts (only in items view)
  // Shift + key clears the filter, key alone focuses the filter
  // Note: Shift changes event.key to uppercase, so compare case-insensitively
  if (activeView.value === 'items') {
    const keyLower = key.toLowerCase()
    if (keyLower === bindings.focusProject.key) {
      event.preventDefault()
      if (event.shiftKey) {
        filterBarRef.value?.clearQuickFilter('project')
      } else {
        filterBarRef.value?.focusQuickFilter('project')
      }
      return
    }
    if (keyLower === bindings.focusCostGroup.key) {
      event.preventDefault()
      if (event.shiftKey) {
        filterBarRef.value?.clearQuickFilter('kostengruppe')
      } else {
        filterBarRef.value?.focusQuickFilter('kostengruppe')
      }
      return
    }
    if (keyLower === bindings.focusLocation.key) {
      event.preventDefault()
      if (event.shiftKey) {
        filterBarRef.value?.clearQuickFilter('location')
      } else {
        filterBarRef.value?.focusQuickFilter('location')
      }
      return
    }
    if (keyLower === bindings.focusTags.key) {
      event.preventDefault()
      if (event.shiftKey) {
        filterBarRef.value?.clearQuickFilter('tags')
      } else {
        filterBarRef.value?.focusQuickFilter('tags')
      }
      return
    }
    if (keyLower === bindings.focusInvolvedPerson.key) {
      event.preventDefault()
      if (event.shiftKey) {
        filterBarRef.value?.clearQuickFilter('involved_person')
      } else {
        filterBarRef.value?.focusQuickFilter('involved_person')
      }
      return
    }
    
    // Type toggle shortcuts
    if (key === bindings.toggleEmails.key) {
      event.preventDefault()
      handleUpdateShowEmails(!(activeConfig.value?.showEmails ?? true))
      return
    }
    if (key === bindings.toggleCraft.key) {
      event.preventDefault()
      handleUpdateShowCraft(!(activeConfig.value?.showCraft ?? true))
      return
    }
    if (key === bindings.toggleFiles.key) {
      event.preventDefault()
      handleUpdateShowFiles(!(activeConfig.value?.showFiles ?? true))
      return
    }
    
    // Task type toggle shortcuts
    if (key === bindings.toggleTaskType1.key || key === bindings.toggleTaskType2.key || key === bindings.toggleTaskType3.key) {
      event.preventDefault()
      const typeIndex = key === bindings.toggleTaskType1.key ? 0 : key === bindings.toggleTaskType2.key ? 1 : 2
      if (typeIndex < taskTypes.value.length) {
        const typeId = taskTypes.value[typeIndex].id
        const current = selectedTaskTypes.value
        const newTypes = current.includes(typeId) 
          ? current.filter(id => id !== typeId)
          : [...current, typeId]
        handleUpdateSelectedTaskTypes(newTypes)
      }
      return
    }
  }
}

// Handle peek key release
const handleKeyUp = (event: KeyboardEvent) => {
  if (isPeeking.value && event.key === keyBindings.value.peek.key) {
    detailDialogVisible.value = false
    isPeeking.value = false
  }
}

// Reset state when dialog closes (e.g., by clicking outside)
watch(detailDialogVisible, (visible) => {
  if (!visible) {
    isPeeking.value = false
    // Restore selection state: clear if it wasn't active before opening
    if (!wasSelectionModeActive.value) {
      selectedRow.value = -1
    }
  }
})

// Reset selection when data changes
watch(() => filteredAndSearchedItems.value.length, () => {
  if (selectedRow.value >= filteredAndSearchedItems.value.length) {
    selectedRow.value = Math.max(0, filteredAndSearchedItems.value.length - 1)
  }
})

// Initialize user settings when user becomes available
watch(() => user.value?.id, async (newUserId) => {
  if (newUserId) {
    await initUserSettings(newUserId)
  }
}, { immediate: true })

// Watch for FilterBar mount/unmount to observe its height
watch(() => activeView.value, (view) => {
  filterBarResizeObserver.disconnect()
  filterBarHeight.value = 0
  if (view === 'items') {
    // Use nextTick to ensure DOM is updated, then query directly
    nextTick(() => {
      const el = document.querySelector('.filter-bar') as HTMLElement
      if (el) {
        filterBarHeight.value = el.offsetHeight
        filterBarResizeObserver.observe(el)
      }
    })
  }
}, { immediate: true })

onMounted(async () => {
  await initTaskTypes()
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
  filterBarResizeObserver.disconnect()
})
</script>

<style scoped>
.home-view {
  height: 100%;
  background: var(--bg-primary);
  padding: 2rem;
  padding-right: 0;
  display: flex;
  flex-direction: column;
  overflow: clip;
}

/* View Tabs */
.view-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.view-tab {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1rem;
  font-weight: 400;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease, background 0.15s ease;
  letter-spacing: 0.01em;
  position: relative;
}

.view-tab:hover:not(.active) {
  color: var(--text-secondary);
}

.view-tab.active {
  color: var(--text-primary);
  font-weight: 600;
}

.view-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 70%;
  height: 2px;
  background: var(--accent-primary);
  border-radius: 1px;
}

/* Sync Status Wrapper */
.sync-status-wrapper {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.sync-popup-container {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 0.5rem;
  z-index: 9999;
}

/* Services button (admin only) */
.services-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.services-btn i {
  font-size: 1.4rem;
}

.services-btn:hover {
  color: var(--accent-primary);
}

/* Settings button */
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.settings-btn i {
  font-size: 1.5rem;
}

.settings-btn:hover {
  color: var(--text-primary);
  transform: rotate(45deg);
}

/* Main Content */
.main-content {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
  overflow: clip;
}

.center-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: scroll;
}

/* 1. Target the scrollbar container */
.center-content::-webkit-scrollbar {
    -webkit-appearance: none;
    width: 10px;      /* Vertical scrollbar width */
    height: 10px;     /* Horizontal scrollbar height */
}

.center-content::-webkit-scrollbar-corner {
    background: var(--bg-primary) !important;
}

/* 2. Style the moving part (the thumb) */
.center-content::-webkit-scrollbar-thumb {
    background-color: var(--bg-tertiary); /* Dark grey color */
    border-radius: 5px;       /* Rounded corners */
    height: 10px;
}

/* 3. Style the track (optional, but good for contrast) */
.center-content::-webkit-scrollbar-track {
    background: var(--bg-primary);  /* Or a specific color */
    background-clip: padding-box;
}



.center-content-inner {
  display: block;
  width: fit-content;
  min-width: 100%;
  min-height: min-content;
}
.filters-section {
  min-width: 0;
  flex-shrink: 0;
}
</style>
