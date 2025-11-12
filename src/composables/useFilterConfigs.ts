import { ref, watch } from 'vue'
import type { FilterConfiguration, ColumnFilter } from '@/types'

const STORAGE_KEY = 'dbhelm_filter_configurations'

// Default always-visible filters (can be easily changed here)
const DEFAULT_ALWAYS_VISIBLE_FILTERS = [
  'project',
  'customer',
  'building',
  'floor',
  'room',
  'kostengruppe'
]

const defaultConfig = (): FilterConfiguration => ({
  id: crypto.randomUUID(),
  name: 'Default Configuration',
  showTasks: true,
  showEmails: true,
  viewMode: 'list',
  alwaysVisibleFilters: {},
  dynamicFilters: [],
  visibleColumns: [
    'name',
    'type',
    'status',
    'project',
    'customer',
    'due_date',
    'created_at'
  ],
  columnOrder: [
    'name',
    'type',
    'status',
    'project',
    'customer',
    'due_date',
    'created_at'
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

const configurations = ref<FilterConfiguration[]>([])
const activeConfigId = ref<string>('')

// Load from browser storage
function loadConfigurations() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      configurations.value = parsed.configs || []
      activeConfigId.value = parsed.activeConfigId || ''
    }
    
    // If no configurations exist, create default
    if (configurations.value.length === 0) {
      const config = defaultConfig()
      configurations.value = [config]
      activeConfigId.value = config.id
      saveConfigurations()
    }
    
    // If active config doesn't exist, set to first
    if (!configurations.value.find(c => c.id === activeConfigId.value)) {
      activeConfigId.value = configurations.value[0].id
    }
  } catch (error) {
    console.error('Error loading configurations:', error)
    const config = defaultConfig()
    configurations.value = [config]
    activeConfigId.value = config.id
  }
}

// Save to browser storage
function saveConfigurations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      configs: configurations.value,
      activeConfigId: activeConfigId.value
    }))
  } catch (error) {
    console.error('Error saving configurations:', error)
  }
}

export function useFilterConfigs() {
  const activeConfig = ref<FilterConfiguration | null>(null)

  // Initialize
  if (configurations.value.length === 0) {
    loadConfigurations()
  }

  // Update active config reference when activeConfigId changes
  watch([configurations, activeConfigId], () => {
    activeConfig.value = configurations.value.find(c => c.id === activeConfigId.value) || null
  }, { immediate: true, deep: true })

  // Auto-save when configurations change
  watch(configurations, () => {
    saveConfigurations()
  }, { deep: true })

  watch(activeConfigId, () => {
    saveConfigurations()
  })

  const createConfiguration = (name?: string) => {
    const config = defaultConfig()
    config.name = name || `Configuration ${configurations.value.length + 1}`
    configurations.value.push(config)
    activeConfigId.value = config.id
    return config
  }

  const duplicateConfiguration = (id: string) => {
    const original = configurations.value.find(c => c.id === id)
    if (!original) return null

    const duplicate: FilterConfiguration = {
      ...JSON.parse(JSON.stringify(original)), // Deep clone
      id: crypto.randomUUID(),
      name: `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    configurations.value.push(duplicate)
    activeConfigId.value = duplicate.id
    return duplicate
  }

  const deleteConfiguration = (id: string) => {
    const index = configurations.value.findIndex(c => c.id === id)
    if (index === -1) return false

    configurations.value.splice(index, 1)

    // If we deleted the active config, switch to first available
    if (activeConfigId.value === id && configurations.value.length > 0) {
      activeConfigId.value = configurations.value[0].id
    }

    // If no configs left, create a default one
    if (configurations.value.length === 0) {
      createConfiguration('Default Configuration')
    }

    return true
  }

  const updateConfiguration = (id: string, updates: Partial<FilterConfiguration>) => {
    const config = configurations.value.find(c => c.id === id)
    if (!config) return false

    Object.assign(config, updates)
    config.updatedAt = new Date().toISOString()
    return true
  }

  const setActiveConfiguration = (id: string) => {
    if (configurations.value.find(c => c.id === id)) {
      activeConfigId.value = id
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
    DEFAULT_ALWAYS_VISIBLE_FILTERS,
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

