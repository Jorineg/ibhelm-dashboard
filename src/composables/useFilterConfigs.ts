import { ref, computed } from 'vue'
import type { FilterConfiguration, ViewType, SortConfig, QuickFilters, ColumnFilters } from '@/types'

const STORAGE_KEY = 'ibhelm_filter_configurations_v3'

// Default quick filter fields per view type
const DEFAULT_QUICK_FILTERS_BY_VIEW: Record<ViewType, (keyof QuickFilters)[]> = {
  items: ['project', 'involved_person', 'location', 'kostengruppe', 'tags'],
  projects: [],
  people: []
}

// Default visible columns per view type
const DEFAULT_COLUMNS_BY_VIEW: Record<ViewType, string[]> = {
  items: ['type', 'name', 'status', 'project', 'customer', 'due_date', 'created_at'],
  projects: ['name', 'status', 'company_name', 'client_name', 'task_count', 'created_at'],
  people: ['display_name', 'primary_email', 'is_internal', 'tw_company_name', 'db_created_at']
}

// Default sort config per view type
const DEFAULT_SORT_BY_VIEW: Record<ViewType, SortConfig> = {
  items: { field: 'sort_date', order: 'desc' },
  projects: { field: 'name', order: 'asc' },
  people: { field: 'display_name', order: 'asc' }
}

const defaultConfig = (viewType: ViewType = 'items'): FilterConfiguration => {
  const columns = DEFAULT_COLUMNS_BY_VIEW[viewType]
  return {
    id: crypto.randomUUID(),
    name: 'Default Configuration',
    viewType,
    showTasks: true,
    showEmails: true,
    showCraft: true,
    showFiles: true,
    viewMode: 'list',
    sortConfig: DEFAULT_SORT_BY_VIEW[viewType],
    searchQuery: '',
    quickFilters: {},
    columnFilters: {},
    visibleColumns: columns,
    columnOrder: columns,
    columnWidths: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

// All configurations (across all views)
const allConfigurations = ref<FilterConfiguration[]>([])

// Active config ID per view type
const activeConfigIds = ref<Record<ViewType, string>>({
  items: '',
  projects: '',
  people: ''
})

// Config order per view type (array of config IDs)
const configOrder = ref<Record<ViewType, string[]>>({
  items: [],
  projects: [],
  people: []
})

// Quick filter order per view type (global, not per config)
const quickFilterOrder = ref<Record<ViewType, (keyof QuickFilters)[]>>({
  items: [],
  projects: [],
  people: []
})

// Current view type
const currentViewType = ref<ViewType>('items')

// Filtered configurations for current view only (sorted by custom order)
const configurations = computed(() => {
  const viewConfigs = allConfigurations.value.filter(c => c.viewType === currentViewType.value)
  const order = configOrder.value[currentViewType.value]
  if (!order || order.length === 0) return viewConfigs
  // Sort by order, configs not in order go to end
  return viewConfigs.sort((a, b) => {
    const aIdx = order.indexOf(a.id)
    const bIdx = order.indexOf(b.id)
    if (aIdx === -1 && bIdx === -1) return 0
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })
})

// Current active config ID for the current view
const activeConfigId = computed(() => {
  return activeConfigIds.value[currentViewType.value]
})

// Module-level activeConfig computed - always derives from allConfigurations
const activeConfig = computed<FilterConfiguration | null>(() => {
  const currentId = activeConfigIds.value[currentViewType.value]
  return allConfigurations.value.find(c => c.id === currentId) || null
})

// Load from browser storage
function loadConfigurations() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      allConfigurations.value = parsed.configs || []
      activeConfigIds.value = parsed.activeConfigIds || { items: '', projects: '', people: '' }
      configOrder.value = parsed.configOrder || { items: [], projects: [], people: [] }
      quickFilterOrder.value = parsed.quickFilterOrder || { items: [], projects: [], people: [] }
    }

    // Ensure each view type has at least one configuration
    const viewTypes: ViewType[] = ['items', 'projects', 'people']
    for (const viewType of viewTypes) {
      const viewConfigs = allConfigurations.value.filter(c => c.viewType === viewType)
      if (viewConfigs.length === 0) {
        const config = defaultConfig(viewType)
        allConfigurations.value.push(config)
        activeConfigIds.value[viewType] = config.id
        configOrder.value[viewType] = [config.id]
      } else if (!activeConfigIds.value[viewType] || !viewConfigs.find(c => c.id === activeConfigIds.value[viewType])) {
        activeConfigIds.value[viewType] = viewConfigs[0].id
      }
    }

    saveConfigurations()
  } catch (error) {
    console.error('Error loading configurations:', error)
    const viewTypes: ViewType[] = ['items', 'projects', 'people']
    allConfigurations.value = []
    for (const viewType of viewTypes) {
      const config = defaultConfig(viewType)
      allConfigurations.value.push(config)
      activeConfigIds.value[viewType] = config.id
      configOrder.value[viewType] = [config.id]
    }
  }
}

// Save to browser storage
function saveConfigurations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      configs: allConfigurations.value,
      activeConfigIds: activeConfigIds.value,
      configOrder: configOrder.value,
      quickFilterOrder: quickFilterOrder.value
    }))
  } catch (error) {
    console.error('Error saving configurations:', error)
  }
}

// Initialize module (runs once)
let moduleInitialized = false
function initializeModule() {
  if (moduleInitialized) return
  moduleInitialized = true
  loadConfigurations()
}

export function useFilterConfigs() {
  initializeModule()

  const setCurrentView = (viewType: ViewType) => {
    currentViewType.value = viewType
  }

  const createConfiguration = (name?: string) => {
    const config = defaultConfig(currentViewType.value)
    config.name = name || `Configuration ${configurations.value.length + 1}`
    allConfigurations.value.push(config)
    configOrder.value[currentViewType.value].push(config.id)
    activeConfigIds.value[currentViewType.value] = config.id
    saveConfigurations()
    return config
  }

  const duplicateConfiguration = (id: string) => {
    const original = allConfigurations.value.find(c => c.id === id)
    if (!original) return null

    const duplicate: FilterConfiguration = {
      ...JSON.parse(JSON.stringify(original)),
      id: crypto.randomUUID(),
      name: `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    allConfigurations.value.push(duplicate)
    // Insert after original in order
    const order = configOrder.value[original.viewType]
    const originalIdx = order.indexOf(id)
    if (originalIdx !== -1) {
      order.splice(originalIdx + 1, 0, duplicate.id)
    } else {
      order.push(duplicate.id)
    }
    activeConfigIds.value[currentViewType.value] = duplicate.id
    saveConfigurations()
    return duplicate
  }

  const deleteConfiguration = (id: string) => {
    const index = allConfigurations.value.findIndex(c => c.id === id)
    if (index === -1) return false
    
    const config = allConfigurations.value[index]
    const viewType = config.viewType

    allConfigurations.value.splice(index, 1)
    // Remove from order
    const orderIdx = configOrder.value[viewType].indexOf(id)
    if (orderIdx !== -1) configOrder.value[viewType].splice(orderIdx, 1)

    if (activeConfigIds.value[viewType] === id) {
      const viewConfigs = allConfigurations.value.filter(c => c.viewType === viewType)
      if (viewConfigs.length > 0) {
        // Use first in order if available
        const order = configOrder.value[viewType]
        activeConfigIds.value[viewType] = order[0] || viewConfigs[0].id
      } else {
        const newConfig = defaultConfig(viewType)
        allConfigurations.value.push(newConfig)
        configOrder.value[viewType] = [newConfig.id]
        activeConfigIds.value[viewType] = newConfig.id
      }
    }

    saveConfigurations()
    return true
  }

  const updateConfiguration = (id: string, updates: Partial<FilterConfiguration>) => {
    const index = allConfigurations.value.findIndex(c => c.id === id)
    if (index === -1) return false

    const config = allConfigurations.value[index]
    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    allConfigurations.value.splice(index, 1, updatedConfig)
    saveConfigurations()
    return true
  }

  const setActiveConfiguration = (id: string) => {
    const config = allConfigurations.value.find(c => c.id === id)
    if (config) {
      activeConfigIds.value[config.viewType] = id
      saveConfigurations()
      return true
    }
    return false
  }

  // Quick filter helpers
  const updateQuickFilter = (filterName: keyof QuickFilters, value: string) => {
    if (activeConfig.value) {
      const newFilters = { ...activeConfig.value.quickFilters }
      if (value) {
        newFilters[filterName] = value
      } else {
        delete newFilters[filterName]
      }
      updateConfiguration(activeConfig.value.id, { quickFilters: newFilters })
    }
  }

  // Column filter helpers
  // Note: empty strings and empty arrays are kept (to show filter UI), only undefined/null deletes
  const updateColumnFilter = <K extends keyof ColumnFilters>(filterName: K, value: ColumnFilters[K]) => {
    if (activeConfig.value) {
      const newFilters = { ...activeConfig.value.columnFilters }
      if (value === undefined || value === null) {
        delete newFilters[filterName]
      } else {
        newFilters[filterName] = value
      }
      updateConfiguration(activeConfig.value.id, { columnFilters: newFilters })
    }
  }

  const removeColumnFilter = (filterName: keyof ColumnFilters) => {
    if (activeConfig.value) {
      const newFilters = { ...activeConfig.value.columnFilters }
      delete newFilters[filterName]
      updateConfiguration(activeConfig.value.id, { columnFilters: newFilters })
    }
  }

  const updateSearchQuery = (value: string) => {
    if (activeConfig.value) {
      updateConfiguration(activeConfig.value.id, { searchQuery: value })
    }
  }

  const clearAllFilters = () => {
    if (activeConfig.value) {
      updateConfiguration(activeConfig.value.id, { 
        searchQuery: '',
        quickFilters: {}, 
        columnFilters: {} 
      })
    }
  }

  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    if (!activeConfig.value) return false
    const search = activeConfig.value.searchQuery
    const quick = activeConfig.value.quickFilters
    const col = activeConfig.value.columnFilters
    return !!search || Object.keys(quick).length > 0 || Object.keys(col).length > 0
  })

  // Get active column filter keys (for UI display)
  const activeColumnFilterKeys = computed(() => {
    if (!activeConfig.value) return []
    return Object.keys(activeConfig.value.columnFilters) as (keyof ColumnFilters)[]
  })

  // Computed quick filter fields based on current view (with global custom order if set)
  const quickFilterFields = computed(() => {
    const defaults = DEFAULT_QUICK_FILTERS_BY_VIEW[currentViewType.value]
    const customOrder = quickFilterOrder.value[currentViewType.value]
    if (!customOrder || customOrder.length === 0) return defaults
    // Merge custom order with defaults (custom first, then any missing defaults)
    const result: (keyof QuickFilters)[] = []
    for (const field of customOrder) {
      if (defaults.includes(field)) result.push(field)
    }
    for (const field of defaults) {
      if (!result.includes(field)) result.push(field)
    }
    return result
  })

  const updateQuickFilterOrder = (order: (keyof QuickFilters)[]) => {
    quickFilterOrder.value[currentViewType.value] = order
    saveConfigurations()
  }

  const updateConfigOrder = (order: string[]) => {
    configOrder.value[currentViewType.value] = order
    saveConfigurations()
  }

  return {
    configurations,
    activeConfig,
    activeConfigId,
    currentViewType,
    quickFilterFields,
    hasActiveFilters,
    activeColumnFilterKeys,
    setCurrentView,
    createConfiguration,
    duplicateConfiguration,
    deleteConfiguration,
    updateConfiguration,
    setActiveConfiguration,
    updateSearchQuery,
    updateQuickFilter,
    updateQuickFilterOrder,
    updateConfigOrder,
    updateColumnFilter,
    removeColumnFilter,
    clearAllFilters
  }
}
