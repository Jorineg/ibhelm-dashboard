<template>
  <div class="home-view">
    <!-- Header -->
    <div class="page-header">
      <h1>dbhelm Dashboard</h1>
      <div class="header-actions">
        <span class="user-email">{{ user?.email }}</span>
        <Button
          label="Sign Out"
          icon="pi pi-sign-out"
          @click="handleSignOut"
          outlined
          size="small"
        />
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Left Sidebar: Configuration Panel -->
      <aside class="left-sidebar">
        <ConfigurationPanel />
      </aside>

      <!-- Center: Search, Filters, and Table -->
      <main class="center-content">
        <!-- Search Bar -->
        <div class="search-section">
          <span class="p-input-icon-left search-bar">
            <i class="pi pi-search" />
            <InputText
              v-model="searchQuery"
              placeholder="Search across all columns..."
              class="search-input"
              @input="handleSearch"
            />
            <Button
              v-if="searchQuery"
              icon="pi pi-times"
              text
              rounded
              class="clear-search"
              @click="clearSearch"
            />
          </span>
        </div>

        <!-- Filters -->
        <div class="filters-section">
          <FilterBar :available-columns="availableColumns" />
        </div>

        <!-- Results count -->
        <div class="results-info">
          <span class="results-count">
            {{ filteredAndSearchedItems.length }} items
            <template v-if="searchQuery">
              matching "{{ searchQuery }}"
            </template>
          </span>
        </div>

        <!-- Data Table -->
        <DataTable
          :items="filteredAndSearchedItems"
          :columns="availableColumns"
          :loading="loading"
          :visible-columns="activeConfig?.visibleColumns || []"
          :column-order="activeConfig?.columnOrder || []"
          :show-tasks="activeConfig?.showTasks || true"
          :show-emails="activeConfig?.showEmails || true"
          :view-mode="activeConfig?.viewMode || 'list'"
          @update:visible-columns="handleUpdateVisibleColumns"
          @update:column-order="handleUpdateColumnOrder"
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

// Debounced search
let searchTimeout: number | null = null
const handleSearch = () => {
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
}

const clearSearch = () => {
  searchQuery.value = ''
  handleSearch()
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
  background: #f5f5f5;
  padding: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  font-size: 0.875rem;
  color: #666;
}

.main-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.left-sidebar {
  position: sticky;
  top: 1.5rem;
}

.center-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.search-section {
  display: flex;
  justify-content: center;
}

.search-bar {
  position: relative;
  width: 100%;
  max-width: 600px;
}

.search-input {
  width: 100%;
  font-size: 1rem;
  padding: 0.75rem 2.5rem;
}

.clear-search {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
}

.filters-section {
  /* Filters component has its own styling */
}

.results-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.results-count {
  font-size: 0.875rem;
  color: #666;
  font-weight: 500;
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

