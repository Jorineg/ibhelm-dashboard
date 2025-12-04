<template>
  <div class="home-view">
    <!-- Header -->
    <div class="page-header">
      <h1>ibhelm Dashboard</h1>
      
      <!-- View Tabs -->
      <nav class="view-tabs">
        <button 
          class="view-tab" 
          :class="{ active: activeView === 'items' }"
          @click="switchView('items')"
        >
          Items
        </button>
        <button 
          class="view-tab" 
          :class="{ active: activeView === 'projects' }"
          @click="switchView('projects')"
        >
          Projects
        </button>
        <button 
          class="view-tab" 
          :class="{ active: activeView === 'people' }"
          @click="switchView('people')"
        >
          People
        </button>
      </nav>
      
      <!-- Sync Status - Centered -->
      <div class="sync-status-panel">
        <div class="sync-status-item">
          <div class="sync-source">
            <span class="sync-icon">📋</span>
            <span class="sync-label">Teamwork</span>
          </div>
          <div class="sync-details">
            <div class="sync-time-row">
              <span class="sync-time-label">Last sync:</span>
              <span class="sync-time-value" :title="formatFullDate(syncStatus.teamwork.lastScanned)">
                {{ formatTime(syncStatus.teamwork.lastScanned) }}
              </span>
            </div>
            <div v-if="syncStatus.teamwork.pendingCount > 0" class="sync-queue-row">
              <span class="sync-queue-label">Queue:</span>
              <span class="sync-queue-value pending">{{ syncStatus.teamwork.pendingCount }} pending</span>
            </div>
            <div v-else class="sync-queue-row">
              <span class="sync-queue-ok">✓ synced</span>
            </div>
          </div>
        </div>
        
        <div class="sync-divider"></div>
        
        <div class="sync-status-item">
          <div class="sync-source">
            <span class="sync-icon">✉️</span>
            <span class="sync-label">Missive</span>
          </div>
          <div class="sync-details">
            <div class="sync-time-row">
              <span class="sync-time-label">Last sync:</span>
              <span class="sync-time-value" :title="formatFullDate(syncStatus.missive.lastScanned)">
                {{ formatTime(syncStatus.missive.lastScanned) }}
              </span>
            </div>
            <div v-if="syncStatus.missive.pendingCount > 0" class="sync-queue-row">
              <span class="sync-queue-label">Queue:</span>
              <span class="sync-queue-value pending">{{ syncStatus.missive.pendingCount }} pending</span>
            </div>
            <div v-else class="sync-queue-row">
              <span class="sync-queue-ok">✓ synced</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="header-actions">
        <button class="settings-btn" @click="goToSettings" title="Settings">
          <i class="pi pi-cog"></i>
        </button>
        <span class="user-email">{{ user?.email }}</span>
        <Button
          label="Sign Out"
          icon="pi pi-sign-out"
          @click="handleSignOut"
          outlined
          class="sign-out-btn"
        />
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Left Sidebar: Configuration Panel -->
      <aside class="left-sidebar">
        <ConfigurationPanel />
      </aside>

      <!-- Center: Filters and Table -->
      <main class="center-content">
        <!-- Filters -->
        <div class="filters-section">
          <FilterBar :available-columns="availableColumns" />
        </div>

        <!-- Data Table -->
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
          :view-mode="activeConfig?.viewMode || 'list'"
          :sort-config="currentSort"
          :view-type="activeView"
          :selected-task-types="selectedTaskTypes"
          @update:visible-columns="handleUpdateVisibleColumns"
          @update:column-order="handleUpdateColumnOrder"
          @update:column-widths="handleUpdateColumnWidths"
          @update:show-tasks="handleUpdateShowTasks"
          @update:show-emails="handleUpdateShowEmails"
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
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ConfigurationPanel from '@/components/ConfigurationPanel.vue'
import FilterBar from '@/components/FilterBar.vue'
import DataTable from '@/components/DataTable.vue'
import ItemDetailDialog from '@/components/ItemDetailDialog.vue'
import { useAuth } from '@/composables/useAuth'
import { useFilterConfigs } from '@/composables/useFilterConfigs'
import { useData } from '@/composables/useData'
import { useSyncStatus } from '@/composables/useSyncStatus'
import { useTaskTypes } from '@/composables/useTaskTypes'
import type { DataItem, ViewDataItem, Column, SortConfig, ViewType } from '@/types'

const router = useRouter()
const { user, signOut } = useAuth()
const { activeConfig, updateConfiguration } = useFilterConfigs()
const { syncStatus } = useSyncStatus()
const { taskTypes, initialize: initTaskTypes } = useTaskTypes()

// Selected task types for filtering
const selectedTaskTypes = ref<string[]>([])

// Active view state
const activeView = ref<ViewType>('items')

// Format time with seconds
const formatTime = (date: Date | null): string => {
  if (!date) return '--:--:--'
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Format full date for tooltip
const formatFullDate = (date: Date | null): string => {
  if (!date) return 'No data available'
  return 'V: ' + date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
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

// Items view columns
const itemColumns: Column[] = [
  { field: 'type', header: 'Type', sortable: true, width: '120px' },
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

// Projects view columns
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

// People view columns
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
    case 'projects':
      return projectColumns
    case 'people':
      return peopleColumns
    case 'items':
    default:
      return itemColumns
  }
})

// Switch view handler
const switchView = async (view: ViewType) => {
  if (activeView.value === view) return
  activeView.value = view
  searchQuery.value = ''
  
  // Set default sort for the view
  const defaultSort: SortConfig = view === 'items' 
    ? { field: 'sort_date', order: 'desc' }
    : view === 'projects'
      ? { field: 'name', order: 'asc' }
      : { field: 'display_name', order: 'asc' }
  
  await loadData(
    activeConfig.value?.showTasks ?? true,
    activeConfig.value?.showEmails ?? true,
    '',
    activeConfig.value || null,
    defaultSort,
    view,
    selectedTaskTypes.value
  )
}

// Note: Filters are now applied at the DATABASE level in useData.ts
// These client-side filters are kept for backwards compatibility but are mostly redundant
// since filtering happens server-side. They serve as a safety net for edge cases.
const filteredItems = computed(() => {
  // Since filters are applied server-side, this mostly just passes through
  return dataItems.value
})

// Search is also applied server-side, so this is redundant
const filteredAndSearchedItems = computed(() => {
  return filteredItems.value
})

// Load initial data when component mounts or config changes
// Watch for changes that should trigger a server-side reload
const dataFetchConfig = computed(() => {
  if (!activeConfig.value) return null
  return {
    id: activeConfig.value.id,
    showTasks: activeConfig.value.showTasks,
    showEmails: activeConfig.value.showEmails,
    // Include filters so changes trigger reload
    alwaysVisibleFilters: activeConfig.value.alwaysVisibleFilters,
    dynamicFilters: activeConfig.value.dynamicFilters
  }
})

// Debounce filter changes to avoid too many API calls
let filterTimeout: number | null = null
watch(dataFetchConfig, () => {
  if (filterTimeout) {
    clearTimeout(filterTimeout)
  }
  
  filterTimeout = window.setTimeout(async () => {
    if (activeConfig.value) {
      await loadData(
        activeConfig.value.showTasks,
        activeConfig.value.showEmails,
        searchQuery.value,
        activeConfig.value, // Pass filter config to apply at database level
        undefined,
        activeView.value,
        selectedTaskTypes.value
      )
    }
  }, 300) // 300ms debounce for filter changes
}, { immediate: true, deep: true })

// Watch search query changes with debouncing
let searchTimeout: number | null = null
watch(searchQuery, () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  searchTimeout = window.setTimeout(async () => {
    if (activeConfig.value) {
      await loadData(
        activeConfig.value.showTasks,
        activeConfig.value.showEmails,
        searchQuery.value,
        activeConfig.value, // Pass filter config to apply at database level
        undefined,
        activeView.value,
        selectedTaskTypes.value
      )
    }
  }, 500)
})

const clearSearch = () => {
  searchQuery.value = ''
}

// Watch for visible columns changes (e.g., when switching configs) and clean up widths
watch(() => activeConfig.value?.visibleColumns, (newColumns, oldColumns) => {
  if (!activeConfig.value || !newColumns || !oldColumns) return
  
  // Only clean up if columns actually changed
  const columnsChanged = JSON.stringify(newColumns) !== JSON.stringify(oldColumns)
  if (!columnsChanged) return
  
  // Clean up column widths for columns that are no longer visible
  const currentWidths = activeConfig.value.columnWidths || {}
  const newWidths: Record<string, string> = {}
  
  Object.keys(currentWidths).forEach(field => {
    if (newColumns.includes(field)) {
      newWidths[field] = currentWidths[field]
    }
  })
  
  // Only update if widths actually changed
  if (JSON.stringify(newWidths) !== JSON.stringify(currentWidths)) {
    updateConfiguration(activeConfig.value.id, { columnWidths: newWidths })
  }
}, { deep: true })

const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

const goToSettings = () => {
  router.push('/settings')
}

const handleRowClick = (item: ViewDataItem) => {
  selectedItem.value = item
  detailDialogVisible.value = true
}

const handleLoadMore = async () => {
  if (activeConfig.value && hasMore.value && !loading.value) {
    await loadMore(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      searchQuery.value,
      activeConfig.value, // Pass filter config to apply at database level
      activeView.value,
      selectedTaskTypes.value
    )
  }
}

const handleUpdateVisibleColumns = (columns: string[]) => {
  if (activeConfig.value) {
    // Clean up column widths for columns that are no longer visible
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

const handleUpdateViewMode = (mode: 'list' | 'gallery') => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { viewMode: mode })
  }
}

const handleUpdateSelectedTaskTypes = (types: string[]) => {
  selectedTaskTypes.value = types
  // Trigger data reload with new task type filter
  if (activeConfig.value) {
    loadData(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      searchQuery.value,
      activeConfig.value,
      undefined,
      activeView.value,
      types
    )
  }
}

const handleSort = async (sortConfig: SortConfig) => {
  if (activeConfig.value) {
    await loadData(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      searchQuery.value,
      activeConfig.value,
      sortConfig,
      activeView.value,
      selectedTaskTypes.value
    )
  }
}

onMounted(async () => {
  // Initialize task types and select all by default
  await initTaskTypes()
  selectedTaskTypes.value = taskTypes.value.map(t => t.id)
})
</script>

<style scoped>
.home-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem 2rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  position: relative;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  flex-shrink: 0;
}

/* View Tabs */
.view-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 3rem;
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
  background: var(--accent-primary, #6366f1);
  border-radius: 1px;
}

/* Sync Status Panel - Centered in header */
.sync-status-panel {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.sync-status-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.sync-source {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.sync-icon {
  font-size: 1rem;
}

.sync-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.sync-details {
  display: flex;
  flex-direction: column;
  gap: 0;
  line-height: 1.2;
}

.sync-time-row,
.sync-queue-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
}

.sync-time-label,
.sync-queue-label {
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
}

.sync-time-value {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  color: var(--text-secondary);
  cursor: default;
  font-size: 0.7rem;
}

.sync-queue-value {
  font-weight: 600;
}

.sync-queue-value.pending {
  color: #f5a623;
  background: rgba(245, 166, 35, 0.15);
  padding: 0 0.35rem;
  border-radius: 3px;
  font-size: 0.65rem;
}

.sync-queue-ok {
  color: #4ade80;
  font-weight: 500;
  font-size: 0.65rem;
}

.sync-divider {
  width: 1px;
  height: 1.75rem;
  background: rgba(255, 255, 255, 0.1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 1.1rem;
}

.settings-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: rotate(45deg);
}

.user-email {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.main-content {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2rem;
  align-items: start;
  max-width: 100%;
}

.left-sidebar {
  position: sticky;
  top: 2rem;
  min-width: 0;
}

.center-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

.filters-section {
  flex-shrink: 0;
  min-width: 0;
}

@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .left-sidebar {
    position: relative;
    top: 0;
  }
}
</style>

