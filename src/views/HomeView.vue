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
            @click="toggleSyncPopup" 
          />
          <!-- Popup -->
          <div v-if="syncPopupVisible" class="sync-popup-container">
            <SyncStatusPanel 
              :sync-status="syncStatus" 
              :is-source-outdated="isSourceOutdated"
              :is-files-outdated="isFilesOutdated"
              :is-thumbnails-outdated="isThumbnailsOutdated"
            />
          </div>
        </div>
      </template>
      
      <template #actions>
        <button class="settings-btn" @click="goToSettings" title="Settings">
          <i class="pi pi-cog"></i>
        </button>
      </template>
    </PageHeader>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Config Panel (left side) - hidden for projects and people views -->
      <ConfigurationPanel v-if="activeView === 'items'" ref="configPanelRef" />

      <!-- Filters and Table (aligned container) -->
      <main class="center-content">
        <FilterBar v-if="activeView === 'items'" :available-columns="availableColumns" class="filters-section" />
        <DataTable
          ref="dataTableRef"
          :search-query="searchQuery"
          @update:search-query="searchQuery = $event"
          @clear-search="clearSearch"
          :items="filteredAndSearchedItems"
          :columns="availableColumns"
          :loading="loading"
          :total-count="totalCount"
          :visible-columns="activeConfig?.visibleColumns || []"
          :column-order="activeConfig?.columnOrder || []"
          :column-widths="activeConfig?.columnWidths || {}"
          :show-tasks="activeConfig?.showTasks ?? true"
          :show-emails="activeConfig?.showEmails ?? true"
          :show-craft="activeConfig?.showCraft ?? true"
          :show-files="activeConfig?.showFiles ?? true"
          :view-mode="activeConfig?.viewMode || 'list'"
          :sort-config="activeConfig?.sortConfig || { field: 'sort_date', order: 'desc' }"
          :view-type="activeView"
          :selected-task-types="selectedTaskTypes"
          :selected-row="selectedRow"
          :selected-col="selectedCol"
          :exporting="exporting"
          :filter-config-id="activeConfig?.id"
          :project-filter="activeConfig?.quickFilters?.project || ''"
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
          @update:project-filter="handleUpdateProjectFilter"
          @row-click="handleRowClick"
          @load-more="handleLoadMore"
          @sort="handleSort"
          @export="handleExport"
        />
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
import { PageHeader } from '@/components/common'
import ConfigurationPanel from '@/components/ConfigurationPanel.vue'
import FilterBar from '@/components/FilterBar.vue'
import DataTable from '@/components/DataTable.vue'
import ItemDetailDialog from '@/components/ItemDetailDialog.vue'
import SyncStatusIndicator from '@/components/SyncStatusIndicator.vue'
import SyncStatusPanel from '@/components/SyncStatusPanel.vue'
import { useAuth } from '@/composables/useAuth'
import { useFilterConfigs } from '@/composables/useFilterConfigs'
import { useData } from '@/composables/useData'
import { useSyncStatus } from '@/composables/useSyncStatus'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { useKeyBindings } from '@/composables/useKeyBindings'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { supabase } from '@/lib/supabase'
import type { ViewDataItem, Column, SortConfig, ViewType } from '@/types'

const router = useRouter()
const { user, signOut } = useAuth()
const { activeConfig, configurations, updateConfiguration, setCurrentView, currentViewType, createConfiguration, deleteConfiguration, setActiveConfiguration } = useFilterConfigs()
const { syncStatus, overallStatus, isSourceOutdated, isFilesOutdated, isThumbnailsOutdated } = useSyncStatus()
const { taskTypes, initialize: initTaskTypes } = useTaskTypes()
const { keyBindings } = useKeyBindings()
const { craftSpaceId, filesBucket } = useAppearanceSettings()

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
  hasMore,
  totalCount,
  loadData,
  loadMore,
  fetchAllForExport,
  clearAndStartLoading
} = useData()

const exporting = ref(false)

const searchQuery = ref('')
const detailDialogVisible = ref(false)
const selectedItem = ref<ViewDataItem | null>(null)

// Keyboard navigation
const selectedRow = ref(-1)
const selectedCol = ref(0)
const dataTableRef = ref<{ 
  focusSearch: () => void
  scrollToSelectedCell: () => void
  scrollHorizontal: (dir: 'left' | 'right') => void
  getGalleryColumns: () => number
  scrollToSelectedGalleryItem: () => void 
} | null>(null)
const configPanelRef = ref<{
  toggle: () => void
  expand: () => void
  collapse: () => void
  isExpanded: boolean
} | null>(null)

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
  { field: 'tasklist', header: 'Tasklist', sortable: true, width: '150px' },
  { field: 'assignees', header: 'Assignees', sortable: false, width: '200px' },
  { field: 'tags', header: 'Tags', sortable: false, width: '200px' },
  { field: 'from_name', header: 'From', sortable: true, width: '200px' },
  { field: 'from_email', header: 'From Email', sortable: true, width: '200px' },
  { field: 'recipients', header: 'Recipients', sortable: false, width: '250px' },
  { field: 'conversation_subject', header: 'Conversation', sortable: true, width: '250px' },
  { field: 'attachment_count', header: 'Attachments', sortable: true, width: '120px' },
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

// Switch view handler
const switchView = async (view: ViewType) => {
  if (currentViewType.value === view) return
  searchQuery.value = ''
  setCurrentView(view)
  
  // Wait for Vue to update the reactive state (activeConfig will change)
  await nextTick()
  
  const defaultSort: SortConfig = view === 'items' 
    ? { field: 'sort_date', order: 'desc' }
    : view === 'projects'
      ? { field: 'name', order: 'asc' }
      : { field: 'display_name', order: 'asc' }
  
  await loadData(
    activeConfig.value?.showTasks ?? true,
    activeConfig.value?.showEmails ?? true,
    activeConfig.value?.showCraft ?? true,
    activeConfig.value?.showFiles ?? true,
    '',
    activeConfig.value || null,
    defaultSort,
    view,
    selectedTaskTypes.value
  )
  
  // Clear any pending filter timeout to prevent double-load from the dataFetchConfig watcher
  if (filterTimeout) {
    clearTimeout(filterTimeout)
    filterTimeout = null
  }
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
    quickFilters: activeConfig.value.quickFilters,
    columnFilters: activeConfig.value.columnFilters
  })
})

// Track if initial load has been done to prevent double loading on page reload
let initialLoadDone = false
let filterTimeout: number | null = null

// Watch for config ID changes to immediately clear data (prevents flicker when switching configs)
watch(() => activeConfig.value?.id, (newId, oldId) => {
  if (oldId && newId !== oldId) {
    // Immediately clear items and show loading to prevent new config being applied to old data
    clearAndStartLoading()
  }
})

watch(dataFetchConfigKey, async (newKey, oldKey) => {
  if (filterTimeout) clearTimeout(filterTimeout)
  
  // Skip if no config
  if (!newKey || !activeConfig.value) return
  
  // Skip if this is the same config key (prevents duplicate loads)
  if (initialLoadDone && newKey === oldKey) return
  
  filterTimeout = window.setTimeout(async () => {
    if (activeConfig.value) {
      initialLoadDone = true
      await loadData(
        activeConfig.value.showTasks,
        activeConfig.value.showEmails,
        activeConfig.value.showCraft ?? true,
        activeConfig.value.showFiles ?? true,
        searchQuery.value,
        activeConfig.value,
        activeConfig.value.sortConfig,
        currentViewType.value,
        selectedTaskTypes.value
      )
    }
  }, 300)
}, { immediate: true })

// Search debouncing
let searchTimeout: number | null = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  
  searchTimeout = window.setTimeout(async () => {
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
        selectedTaskTypes.value
      )
    }
  }, 500)
})

const clearSearch = () => {
  searchQuery.value = ''
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

// Navigation
const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

const goToSettings = () => {
  router.push('/settings')
}

// Event handlers
const handleRowClick = (item: ViewDataItem) => {
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
      selectedTaskTypes.value
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
      selectedTaskTypes.value
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
      selectedTaskTypes.value
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
  
  const bindings = keyBindings.value
  const key = event.key
  
  // Escape: blur input, or close dialog, or deselect
  if (key === bindings.closeDialog.key) {
    event.preventDefault()
    if (isTyping) {
      (target as HTMLInputElement).blur()
      return
    }
    if (detailDialogVisible.value) {
      detailDialogVisible.value = false
      return
    }
    // Deselect row if nothing else to close
    if (selectedRow.value >= 0) {
      selectedRow.value = -1
    }
    return
  }
  
  // Toggle detail popup with 'o' (works even when dialog is open)
  if (key === bindings.openDetail.key && !isTyping) {
    event.preventDefault()
    if (detailDialogVisible.value) {
      detailDialogVisible.value = false
    } else if (selectedRow.value >= 0) {
      const item = filteredAndSearchedItems.value[selectedRow.value]
      if (item) {
        selectedItem.value = item
        detailDialogVisible.value = true
      }
    }
    return
  }
  
  // Ignore other shortcuts if typing or dialog is open
  if (isTyping || detailDialogVisible.value) return
  
  // Toggle filter popup (f)
  if (key === bindings.toggleFilterPopup.key) {
    event.preventDefault()
    configPanelRef.value?.toggle()
    return
  }
  
  // Filter config shortcuts 1-9
  const configNumber = parseInt(key)
  if (configNumber >= 1 && configNumber <= 9) {
    const configBindingKey = `filterConfig${configNumber}` as keyof typeof bindings
    if (key === bindings[configBindingKey].key) {
      event.preventDefault()
      const configs = configurations.value
      if (configNumber <= configs.length) {
        const targetConfig = configs[configNumber - 1]
        if (targetConfig.id === activeConfig.value?.id) {
          // Same config - toggle popup
          configPanelRef.value?.toggle()
        } else {
          setActiveConfiguration(targetConfig.id)
        }
      }
      return
    }
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
      // Horizontal scroll in list view
      dataTableRef.value?.scrollHorizontal('left')
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
      // Horizontal scroll in list view
      dataTableRef.value?.scrollHorizontal('right')
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
  
  // New config (n)
  if (key === bindings.newConfig.key) {
    event.preventDefault()
    createConfiguration()
    return
  }
  
  // Delete config (d)
  if (key === bindings.deleteConfig.key) {
    event.preventDefault()
    if (activeConfig.value && configurations.value.length > 1) {
      deleteConfiguration(activeConfig.value.id)
    }
    return
  }
  
  // Focus search (s)
  if (key === bindings.focusSearch.key) {
    event.preventDefault()
    dataTableRef.value?.focusSearch()
    return
  }
  
  // Toggle view (v)
  if (key === bindings.toggleView.key) {
    event.preventDefault()
    const newMode = activeConfig.value?.viewMode === 'gallery' ? 'list' : 'gallery'
    handleUpdateViewMode(newMode)
    return
  }
}

// Reset selection when data changes
watch(() => filteredAndSearchedItems.value.length, () => {
  if (selectedRow.value >= filteredAndSearchedItems.value.length) {
    selectedRow.value = Math.max(0, filteredAndSearchedItems.value.length - 1)
  }
})

onMounted(async () => {
  await initTaskTypes()
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.home-view {
  height: 100%;
  background: var(--bg-primary);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  transition: all 0.15s ease;
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
  font-size: 1.25rem;
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
  overflow: hidden;
}

.center-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.filters-section {
  min-width: 0;
  flex-shrink: 0;
}
</style>
