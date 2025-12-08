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
      <!-- Config Panel (left side) -->
      <ConfigurationPanel />

      <!-- Filters and Table (aligned container) -->
      <main class="center-content">
        <FilterBar :available-columns="availableColumns" class="filters-section" />
        <DataTable
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
          :view-mode="activeConfig?.viewMode || 'list'"
          :sort-config="currentSort"
          :view-type="activeView"
          :selected-task-types="selectedTaskTypes"
          @update:visible-columns="handleUpdateVisibleColumns"
          @update:column-order="handleUpdateColumnOrder"
          @update:column-widths="handleUpdateColumnWidths"
          @update:show-tasks="handleUpdateShowTasks"
          @update:show-emails="handleUpdateShowEmails"
          @update:show-craft="handleUpdateShowCraft"
          @update:view-mode="handleUpdateViewMode"
          @update:selected-task-types="handleUpdateSelectedTaskTypes"
          @row-click="handleRowClick"
          @load-more="handleLoadMore"
          @sort="handleSort"
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
import { ref, computed, watch, onMounted, nextTick } from 'vue'
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
import type { ViewDataItem, Column, SortConfig, ViewType } from '@/types'

const router = useRouter()
const { user, signOut } = useAuth()
const { activeConfig, updateConfiguration, setCurrentView, currentViewType } = useFilterConfigs()
const { syncStatus, overallStatus, isSourceOutdated } = useSyncStatus()
const { taskTypes, initialize: initTaskTypes } = useTaskTypes()

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
  currentSort,
  loadData,
  loadMore
} = useData()

const searchQuery = ref('')
const detailDialogVisible = ref(false)
const selectedItem = ref<ViewDataItem | null>(null)

const selectedTaskTypes = computed(() => {
  if (!activeConfig.value) return []
  return activeConfig.value.selectedTaskTypes ?? taskTypes.value.map(t => t.id)
})

// Column definitions (type column is fixed/frozen in DataTable)
const itemColumns: Column[] = [
  { field: 'name', header: 'Name', sortable: true, width: '300px' },
  { field: 'description', header: 'Description', sortable: false, width: '400px' },
  { field: 'body', header: 'Email Content', sortable: false, width: '400px' },
  { field: 'preview', header: 'Email Preview', sortable: false, width: '300px' },
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
    selectedTaskTypes: activeConfig.value.selectedTaskTypes,
    alwaysVisibleFilters: activeConfig.value.alwaysVisibleFilters,
    dynamicFilters: activeConfig.value.dynamicFilters
  })
})

// Track if initial load has been done to prevent double loading on page reload
let initialLoadDone = false
let filterTimeout: number | null = null

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
        searchQuery.value,
        activeConfig.value,
        undefined,
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
        searchQuery.value,
        activeConfig.value,
        undefined,
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

const handleSort = async (sortConfig: SortConfig) => {
  if (activeConfig.value) {
    await loadData(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      activeConfig.value.showCraft ?? true,
      searchQuery.value,
      activeConfig.value,
      sortConfig,
      currentViewType.value,
      selectedTaskTypes.value
    )
  }
}

onMounted(async () => {
  await initTaskTypes()
  // The dataFetchConfig watch will trigger the initial data load
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
