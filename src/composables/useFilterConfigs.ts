import { ref, computed } from 'vue'
import type { FilterConfiguration, ViewType, SortConfig, QuickFilters, ColumnFilters } from '@/types'

const STORAGE_KEY = 'ibhelm_filter_configurations_v2'

// Default quick filter fields per view type
const DEFAULT_QUICK_FILTERS_BY_VIEW: Record<ViewType, (keyof QuickFilters)[]> = {
  items: ['project', 'involved_person', 'building', 'floor', 'room', 'kostengruppe', 'tags'],
  projects: [],
  people: ['project']
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
    viewMode: 'list',
    sortConfig: DEFAULT_SORT_BY_VIEW[viewType],
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

// Current view type
const currentViewType = ref<ViewType>('items')

// Filtered configurations for current view only
const configurations = computed(() => {
  return allConfigurations.value.filter(c => c.viewType === currentViewType.value)
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
    }

    // Ensure each view type has at least one configuration
    const viewTypes: ViewType[] = ['items', 'projects', 'people']
    for (const viewType of viewTypes) {
      const viewConfigs = allConfigurations.value.filter(c => c.viewType === viewType)
      if (viewConfigs.length === 0) {
        const config = defaultConfig(viewType)
        allConfigurations.value.push(config)
        activeConfigIds.value[viewType] = config.id
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
    }
  }
}

// Save to browser storage
function saveConfigurations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      configs: allConfigurations.value,
      activeConfigIds: activeConfigIds.value
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

    if (activeConfigIds.value[viewType] === id) {
      const viewConfigs = allConfigurations.value.filter(c => c.viewType === viewType)
      if (viewConfigs.length > 0) {
        activeConfigIds.value[viewType] = viewConfigs[0].id
      } else {
        const newConfig = defaultConfig(viewType)
        allConfigurations.value.push(newConfig)
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
  const updateColumnFilter = <K extends keyof ColumnFilters>(filterName: K, value: ColumnFilters[K]) => {
    if (activeConfig.value) {
      const newFilters = { ...activeConfig.value.columnFilters }
      if (value === undefined || value === null || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
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

  const clearAllFilters = () => {
    if (activeConfig.value) {
      updateConfiguration(activeConfig.value.id, { 
        quickFilters: {}, 
        columnFilters: {} 
      })
    }
  }

  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    if (!activeConfig.value) return false
    const quick = activeConfig.value.quickFilters
    const col = activeConfig.value.columnFilters
    return Object.keys(quick).length > 0 || Object.keys(col).length > 0
  })

  // Get active column filter keys (for UI display)
  const activeColumnFilterKeys = computed(() => {
    if (!activeConfig.value) return []
    return Object.keys(activeConfig.value.columnFilters) as (keyof ColumnFilters)[]
  })

  // Computed quick filter fields based on current view
  const quickFilterFields = computed(() => DEFAULT_QUICK_FILTERS_BY_VIEW[currentViewType.value])

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
    updateQuickFilter,
    updateColumnFilter,
    removeColumnFilter,
    clearAllFilters
  }
}
