<template>
  <div class="home-view">
    <!-- Header -->
    <div class="page-header">
      <h1>ibhelm Dashboard</h1>
      
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
          @update:visible-columns="handleUpdateVisibleColumns"
          @update:column-order="handleUpdateColumnOrder"
          @update:column-widths="handleUpdateColumnWidths"
          @update:show-tasks="handleUpdateShowTasks"
          @update:show-emails="handleUpdateShowEmails"
          @update:view-mode="handleUpdateViewMode"
          @row-click="handleRowClick"
          @load-more="handleLoadMore"
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
import type { DataItem, Column } from '@/types'

const router = useRouter()
const { user, signOut } = useAuth()
const { activeConfig, updateConfiguration } = useFilterConfigs()
const { syncStatus } = useSyncStatus()

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
  loadData,
  loadMore
} = useData()

const searchQuery = ref('')
const detailDialogVisible = ref(false)
const selectedItem = ref<DataItem | null>(null)

// Available columns for the table
const availableColumns = computed<Column[]>(() => [
  { field: 'type', header: 'Type', sortable: true, width: '100px' },
  { field: 'name', header: 'Name', sortable: true, width: '300px' },
  { field: 'description', header: 'Description', sortable: false, width: '400px' },
  { field: 'body', header: 'Email Content', sortable: false, width: '400px' },
  { field: 'preview', header: 'Email Preview', sortable: false, width: '300px' },
  { field: 'status', header: 'Status', sortable: true, width: '120px' },
  { field: 'project', header: 'Project', sortable: true, width: '200px' },
  { field: 'customer', header: 'Customer', sortable: true, width: '200px' },
  { field: 'building', header: 'Building', sortable: true, width: '150px' },
  { field: 'floor', header: 'Floor', sortable: true, width: '100px' },
  { field: 'room', header: 'Room', sortable: true, width: '100px' },
  { field: 'kostengruppe', header: 'Kostengruppe', sortable: true, width: '150px' },
  { field: 'due_date', header: 'Due Date', sortable: true, width: '150px' },
  { field: 'priority', header: 'Priority', sortable: true, width: '120px' },
  { field: 'progress', header: 'Progress', sortable: true, width: '100px' },
  { field: 'tasklist', header: 'Tasklist', sortable: true, width: '150px' },
  { field: 'assignees', header: 'Assignees', sortable: false, width: '200px' },
  { field: 'tags', header: 'Tags', sortable: false, width: '200px' },
  { field: 'from', header: 'From', sortable: true, width: '200px' },
  { field: 'from_email', header: 'From Email', sortable: true, width: '200px' },
  { field: 'conversation_subject', header: 'Conversation', sortable: true, width: '250px' },
  { field: 'attachment_count', header: 'Attachments', sortable: true, width: '120px' },
  { field: 'created_at', header: 'Created', sortable: true, width: '150px' },
  { field: 'updated_at', header: 'Updated', sortable: true, width: '150px' }
])

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
        activeConfig.value // Pass filter config to apply at database level
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
        activeConfig.value // Pass filter config to apply at database level
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

const handleRowClick = (item: DataItem) => {
  selectedItem.value = item
  detailDialogVisible.value = true
}

const handleLoadMore = async () => {
  if (activeConfig.value && hasMore.value && !loading.value) {
    await loadMore(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      searchQuery.value,
      activeConfig.value // Pass filter config to apply at database level
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

onMounted(() => {
  // Initial data load is handled by watch on activeConfig
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
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  flex-shrink: 0;
}

/* Sync Status Panel - Inline in header */
.sync-status-panel {
  display: flex;
  align-items: center;
  gap: 1.25rem;
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
  gap: 1.5rem;
  flex-shrink: 0;
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

