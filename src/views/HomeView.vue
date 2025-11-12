<template>
  <div class="home-view">
    <!-- Header -->
    <div class="page-header">
      <h1>ibhelm Dashboard</h1>
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
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ConfigurationPanel from '@/components/ConfigurationPanel.vue'
import FilterBar from '@/components/FilterBar.vue'
import DataTable from '@/components/DataTable.vue'
import ItemDetailDialog from '@/components/ItemDetailDialog.vue'
import { useAuth } from '@/composables/useAuth'
import { useFilterConfigs } from '@/composables/useFilterConfigs'
import { useData } from '@/composables/useData'
import type { DataItem, Column } from '@/types'

const router = useRouter()
const { user, signOut } = useAuth()
const { activeConfig, updateConfiguration } = useFilterConfigs()
const {
  dataItems,
  loading,
  hasMore,
  totalCount,
  loadData,
  loadMore,
  applyFilters,
  applySearch
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

// Apply filters to data
const filteredItems = computed(() => {
  return applyFilters(dataItems.value, activeConfig.value)
})

// Apply search to filtered data
const filteredAndSearchedItems = computed(() => {
  return applySearch(filteredItems.value, searchQuery.value)
})

// Load initial data when component mounts or config changes
watch([activeConfig], async () => {
  if (activeConfig.value) {
    await loadData(
      activeConfig.value.showTasks,
      activeConfig.value.showEmails,
      searchQuery.value
    )
  }
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
        searchQuery.value
      )
    }
  }, 500)
})

const clearSearch = () => {
  searchQuery.value = ''
}

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
      searchQuery.value
    )
  }
}

const handleUpdateVisibleColumns = (columns: string[]) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { visibleColumns: columns })
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
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
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

