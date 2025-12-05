import { ref, computed, watch } from 'vue'
import type { FilterConfiguration, ColumnFilter, ViewType } from '@/types'

const STORAGE_KEY = 'ibhelm_filter_configurations'

// Default always-visible filters (can be easily changed here)
const DEFAULT_ALWAYS_VISIBLE_FILTERS = [
  'project',
  'involved_person',
  'building',
  'floor',
  'room',
  'kostengruppe'
]

// Default visible columns per view type
const DEFAULT_COLUMNS_BY_VIEW: Record<ViewType, string[]> = {
  items: ['type', 'name', 'status', 'project', 'customer', 'due_date', 'created_at'],
  projects: ['name', 'status', 'company_name', 'client_name', 'task_count', 'created_at'],
  people: ['display_name', 'primary_email', 'is_internal', 'tw_company_name', 'db_created_at']
}

const defaultConfig = (viewType: ViewType = 'items'): FilterConfiguration => {
  const columns = DEFAULT_COLUMNS_BY_VIEW[viewType]
  return {
    id: crypto.randomUUID(),
    name: 'Default Configuration',
    viewType,
    showTasks: true,
    showEmails: true,
    viewMode: 'list',
    alwaysVisibleFilters: {},
    dynamicFilters: [],
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

// Module-level activeConfig so all consumers share the same reactive reference
const activeConfig = ref<FilterConfiguration | null>(null)

// Load from browser storage
function loadConfigurations() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      allConfigurations.value = parsed.configs || []
      
      // Support both old format (single activeConfigId) and new format (per-view activeConfigIds)
      if (parsed.activeConfigIds) {
        activeConfigIds.value = {
          items: parsed.activeConfigIds.items || '',
          projects: parsed.activeConfigIds.projects || '',
          people: parsed.activeConfigIds.people || ''
        }
      } else if (parsed.activeConfigId) {
        // Migration: old format had a single activeConfigId
        // Try to find which view it belongs to and set it
        const config = allConfigurations.value.find(c => c.id === parsed.activeConfigId)
        if (config && config.viewType) {
          activeConfigIds.value[config.viewType] = parsed.activeConfigId
        }
      }
      
      // Migration: add viewType to configs that don't have it (assume 'items')
      allConfigurations.value = allConfigurations.value.map(config => {
        if (!config.viewType) {
          return { ...config, viewType: 'items' as ViewType }
        }
        return config
      })
    }

    // Ensure each view type has at least one configuration
    const viewTypes: ViewType[] = ['items', 'projects', 'people']
    for (const viewType of viewTypes) {
      const viewConfigs = allConfigurations.value.filter(c => c.viewType === viewType)
      if (viewConfigs.length === 0) {
        const config = defaultConfig(viewType)
        allConfigurations.value.push(config)
        activeConfigIds.value[viewType] = config.id
      } else {
        // If no active config for this view, set to first one
        if (!activeConfigIds.value[viewType] || !viewConfigs.find(c => c.id === activeConfigIds.value[viewType])) {
          activeConfigIds.value[viewType] = viewConfigs[0].id
        }
      }
    }
    
    saveConfigurations()
  } catch (error) {
    console.error('Error loading configurations:', error)
    // Create default configs for all views
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

// Initialize module-level watchers (runs once)
let moduleInitialized = false
function initializeModule() {
  if (moduleInitialized) return
  moduleInitialized = true
  
  // Load configurations from storage
  loadConfigurations()
  
  // Update active config reference when activeConfigIds, currentViewType, or allConfigurations change
  watch([allConfigurations, activeConfigIds, currentViewType], () => {
    const currentId = activeConfigIds.value[currentViewType.value]
    activeConfig.value = allConfigurations.value.find(c => c.id === currentId) || null
  }, { immediate: true, deep: true })
  
  // Auto-save when configurations change
  watch(allConfigurations, () => {
    saveConfigurations()
  }, { deep: true })

  watch(activeConfigIds, () => {
    saveConfigurations()
  }, { deep: true })
}

export function useFilterConfigs() {
  // Initialize module (only runs once)
  initializeModule()

  const setCurrentView = (viewType: ViewType) => {
    currentViewType.value = viewType
  }

  const createConfiguration = (name?: string) => {
    const config = defaultConfig(currentViewType.value)
    config.name = name || `Configuration ${configurations.value.length + 1}`
    allConfigurations.value.push(config)
    activeConfigIds.value[currentViewType.value] = config.id
    return config
  }

  const duplicateConfiguration = (id: string) => {
    const original = allConfigurations.value.find(c => c.id === id)
    if (!original) return null

    const duplicate: FilterConfiguration = {
      ...JSON.parse(JSON.stringify(original)), // Deep clone
      id: crypto.randomUUID(),
      name: `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    allConfigurations.value.push(duplicate)
    activeConfigIds.value[currentViewType.value] = duplicate.id
    return duplicate
  }

  const deleteConfiguration = (id: string) => {
    const index = allConfigurations.value.findIndex(c => c.id === id)
    if (index === -1) return false
    
    const config = allConfigurations.value[index]
    const viewType = config.viewType

    allConfigurations.value.splice(index, 1)

    // If we deleted the active config for this view, switch to first available for same view
    if (activeConfigIds.value[viewType] === id) {
      const viewConfigs = allConfigurations.value.filter(c => c.viewType === viewType)
      if (viewConfigs.length > 0) {
        activeConfigIds.value[viewType] = viewConfigs[0].id
      } else {
        // If no configs left for this view, create a default one
        const newConfig = defaultConfig(viewType)
        allConfigurations.value.push(newConfig)
        activeConfigIds.value[viewType] = newConfig.id
      }
    }

    return true
  }

  const updateConfiguration = (id: string, updates: Partial<FilterConfiguration>) => {
    const config = allConfigurations.value.find(c => c.id === id)
    if (!config) return false

    Object.assign(config, updates)
    config.updatedAt = new Date().toISOString()
    return true
  }

  const setActiveConfiguration = (id: string) => {
    const config = allConfigurations.value.find(c => c.id === id)
    if (config) {
      // Set active config for the view the config belongs to
      activeConfigIds.value[config.viewType] = id
      return true
    }
    return false
  }

  const addDynamicFilter = (filter: ColumnFilter) => {
    if (activeConfig.value) {
      activeConfig.value.dynamicFilters.push(filter)
      activeConfig.value.updatedAt = new Date().toISOString()
    }
  }

  const removeDynamicFilter = (filterId: string) => {
    if (activeConfig.value) {
      const index = activeConfig.value.dynamicFilters.findIndex(f => f.id === filterId)
      if (index !== -1) {
        activeConfig.value.dynamicFilters.splice(index, 1)
        activeConfig.value.updatedAt = new Date().toISOString()
      }
    }
  }

  const updateDynamicFilter = (filterId: string, updates: Partial<ColumnFilter>) => {
    if (activeConfig.value) {
      const filter = activeConfig.value.dynamicFilters.find(f => f.id === filterId)
      if (filter) {
        Object.assign(filter, updates)
        activeConfig.value.updatedAt = new Date().toISOString()
      }
    }
  }

  const updateAlwaysVisibleFilter = (filterName: string, value: string) => {
    if (activeConfig.value) {
      if (value) {
        activeConfig.value.alwaysVisibleFilters[filterName as keyof typeof activeConfig.value.alwaysVisibleFilters] = value
      } else {
        delete activeConfig.value.alwaysVisibleFilters[filterName as keyof typeof activeConfig.value.alwaysVisibleFilters]
      }
      activeConfig.value.updatedAt = new Date().toISOString()
    }
  }

  const clearAllFilters = () => {
    if (activeConfig.value) {
      activeConfig.value.alwaysVisibleFilters = {}
      activeConfig.value.dynamicFilters = []
      activeConfig.value.updatedAt = new Date().toISOString()
    }
  }

  return {
    configurations,
    activeConfig,
    activeConfigId,
    currentViewType,
    DEFAULT_ALWAYS_VISIBLE_FILTERS,
    setCurrentView,
    createConfiguration,
    duplicateConfiguration,
    deleteConfiguration,
    updateConfiguration,
    setActiveConfiguration,
    addDynamicFilter,
    removeDynamicFilter,
    updateDynamicFilter,
    updateAlwaysVisibleFilter,
    clearAllFilters
  }
}
