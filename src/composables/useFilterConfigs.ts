import { ref, computed, watch, shallowRef } from 'vue'
import { useUserSettings, type FilterConfigurationsData } from '@/composables/useUserSettings'
import type { FilterConfiguration, ViewType, SortConfig, QuickFilters, ColumnFilters } from '@/types'

// Working copy of the active config (not persisted until saved)
const workingConfig = shallowRef<FilterConfiguration | null>(null)
// ID of the config the working copy is based on
const workingConfigBaseId = ref<string | null>(null)

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
  items: { field: 'updated_at', order: 'desc' },
  projects: { field: 'name', order: 'asc' },
  people: { field: 'display_name', order: 'asc' }
}

const createDefaultConfig = (viewType: ViewType, userSettings?: { default_sort_field: string, default_sort_order: 'asc' | 'desc' }): FilterConfiguration => {
  const columns = DEFAULT_COLUMNS_BY_VIEW[viewType]

  let sortConfig = DEFAULT_SORT_BY_VIEW[viewType]
  if (viewType === 'items' && userSettings) {
    sortConfig = {
      field: userSettings.default_sort_field || 'updated_at',
      order: userSettings.default_sort_order || 'desc'
    }
  }

  return {
    id: crypto.randomUUID(),
    name: 'Default Configuration',
    viewType,
    showTasks: true,
    showEmails: true,
    showCraft: true,
    showFiles: true,
    viewMode: 'list',
    sortConfig: sortConfig,
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

// Current view type (module-level)
const currentViewType = ref<ViewType>('items')

// Timing: when was config switch initiated (for perf logging)
let configSwitchTimestamp: number | null = null
export function getConfigSwitchTimestamp(): number | null {
  const ts = configSwitchTimestamp
  configSwitchTimestamp = null
  return ts
}
export function hasRecentConfigSwitch(): boolean {
  return configSwitchTimestamp !== null
}

export function useFilterConfigs() {
  const { 
    filterConfigurations, 
    updateFilterConfigurations,
    defaultSortField,
    defaultSortOrder,
    initialized: userSettingsInitialized
  } = useUserSettings()

  // Helper to update config data
  const updateData = (updates: Partial<FilterConfigurationsData>) => {
    updateFilterConfigurations({
      ...filterConfigurations.value,
      ...updates
    })
  }

  // Ensure each view has at least one config - returns true if changes were made
  const ensureDefaultConfigs = (): boolean => {
    const viewTypes: ViewType[] = ['items', 'projects', 'people']
    let needsUpdate = false
    const currentData = filterConfigurations.value
    const newConfigs = [...currentData.configs]
    const newActiveIds = { ...currentData.activeConfigIds }
    const newOrder = { ...currentData.configOrder }

    for (const viewType of viewTypes) {
      const viewConfigs = newConfigs.filter(c => c.viewType === viewType)
      if (viewConfigs.length === 0) {
        // No configs for this view - create default
        const config = createDefaultConfig(viewType, {
          default_sort_field: defaultSortField.value,
          default_sort_order: defaultSortOrder.value
        })
        newConfigs.push(config)
        newActiveIds[viewType] = config.id
        newOrder[viewType] = [config.id]
        needsUpdate = true
      } else if (!newActiveIds[viewType] || !viewConfigs.find(c => c.id === newActiveIds[viewType])) {
        // Has configs but no valid active - set first as active
        newActiveIds[viewType] = viewConfigs[0].id
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      updateFilterConfigurations({
        configs: newConfigs,
        activeConfigIds: newActiveIds,
        configOrder: newOrder,
        configHistoryStack: currentData.configHistoryStack,
        quickFilterOrder: currentData.quickFilterOrder
      })
    }
    
    return needsUpdate
  }

  // Ensure defaults exist - this must run:
  // 1. Immediately when composable is created (for initial render)
  // 2. When user settings finish loading (to persist defaults)
  // 3. When configs become empty (e.g., after DB load)
  ensureDefaultConfigs()
  
  // Watch for initialization state changes
  watch(userSettingsInitialized, (newVal, oldVal) => {
    if (newVal && !oldVal) {
      // Just finished initializing - ensure defaults exist and persist
      ensureDefaultConfigs()
    }
  })
  
  // Watch for configs becoming empty (e.g., after DB overwrites local state)
  watch(() => filterConfigurations.value.configs, (newConfigs) => {
    if (newConfigs.length === 0) {
      ensureDefaultConfigs()
    }
  }, { deep: true })

  // Local refs that sync with user settings
  const allConfigurations = computed({
    get: () => filterConfigurations.value.configs,
    set: (val) => {
      updateFilterConfigurations({
        ...filterConfigurations.value,
        configs: val
      })
    }
  })

  const activeConfigIds = computed({
    get: () => filterConfigurations.value.activeConfigIds,
    set: (val) => {
      updateFilterConfigurations({
        ...filterConfigurations.value,
        activeConfigIds: val
      })
    }
  })

  const configOrder = computed({
    get: () => filterConfigurations.value.configOrder,
    set: (val) => {
      updateFilterConfigurations({
        ...filterConfigurations.value,
        configOrder: val
      })
    }
  })

  const configHistoryStack = computed({
    get: () => filterConfigurations.value.configHistoryStack,
    set: (val) => {
      updateFilterConfigurations({
        ...filterConfigurations.value,
        configHistoryStack: val
      })
    }
  })

  const quickFilterOrder = computed({
    get: () => filterConfigurations.value.quickFilterOrder,
    set: (val) => {
      updateFilterConfigurations({
        ...filterConfigurations.value,
        quickFilterOrder: val
      })
    }
  })

  // Filtered configurations for current view only (sorted by custom order)
  const configurations = computed(() => {
    const viewConfigs = allConfigurations.value.filter(c => c.viewType === currentViewType.value)
    const order = configOrder.value[currentViewType.value] || []
    if (order.length === 0) return viewConfigs
    return viewConfigs.sort((a, b) => {
      const aIdx = order.indexOf(a.id)
      const bIdx = order.indexOf(b.id)
      if (aIdx === -1 && bIdx === -1) return 0
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })
  })

  const activeConfigId = computed(() => activeConfigIds.value[currentViewType.value] || '')

  // The saved (persisted) config
  const savedConfig = computed<FilterConfiguration | null>(() => {
    const currentId = activeConfigIds.value[currentViewType.value]
    if (!currentId) return null
    return allConfigurations.value.find(c => c.id === currentId) || null
  })

  // Initialize or sync working copy when saved config changes
  watch(savedConfig, (newSaved) => {
    if (!newSaved) {
      workingConfig.value = null
      workingConfigBaseId.value = null
      return
    }
    // Only reset working copy if we switched to a different config
    if (workingConfigBaseId.value !== newSaved.id) {
      workingConfig.value = JSON.parse(JSON.stringify(newSaved))
      workingConfigBaseId.value = newSaved.id
    }
  }, { immediate: true })

  // The active config returns the working copy (unsaved changes)
  const activeConfig = computed<FilterConfiguration | null>(() => {
    return workingConfig.value
  })

  // Check if there are unsaved changes
  const hasUnsavedChanges = computed(() => {
    if (!workingConfig.value || !savedConfig.value) return false
    return JSON.stringify(workingConfig.value) !== JSON.stringify(savedConfig.value)
  })

  // Save working copy to persistent storage
  const saveActiveConfiguration = () => {
    if (!workingConfig.value || !hasUnsavedChanges.value) return false
    const index = allConfigurations.value.findIndex(c => c.id === workingConfig.value!.id)
    if (index === -1) return false
    
    const updatedConfig = {
      ...workingConfig.value,
      updatedAt: new Date().toISOString()
    }
    const newConfigs = [...allConfigurations.value]
    newConfigs.splice(index, 1, updatedConfig)
    updateData({ configs: newConfigs })
    
    // Update working copy to match saved (so hasUnsavedChanges becomes false)
    workingConfig.value = JSON.parse(JSON.stringify(updatedConfig))
    return true
  }

  // Discard unsaved changes
  const discardChanges = () => {
    if (savedConfig.value) {
      workingConfig.value = JSON.parse(JSON.stringify(savedConfig.value))
    }
  }

  // Push current config to history stack
  const pushToHistory = (viewType: ViewType) => {
    const currentId = activeConfigIds.value[viewType]
    if (!currentId) return
    const stack = [...(configHistoryStack.value[viewType] || [])]
    const existingIdx = stack.indexOf(currentId)
    if (existingIdx !== -1) stack.splice(existingIdx, 1)
    stack.push(currentId)
    if (stack.length > 20) stack.shift()
    updateData({
      configHistoryStack: { ...configHistoryStack.value, [viewType]: stack }
    })
  }

  const setCurrentView = (viewType: ViewType) => {
    currentViewType.value = viewType
    // Ensure this view has configs
    ensureDefaultConfigs()
  }

  const createConfiguration = (name?: string) => {
    const viewType = currentViewType.value
    pushToHistory(viewType)
    const config = createDefaultConfig(viewType, {
      default_sort_field: defaultSortField.value,
      default_sort_order: defaultSortOrder.value
    })
    config.name = name || `Configuration ${configurations.value.length + 1}`
    
    const currentOrder = configOrder.value[viewType] || []
    updateData({
      configs: [...allConfigurations.value, config],
      configOrder: { ...configOrder.value, [viewType]: [...currentOrder, config.id] },
      activeConfigIds: { ...activeConfigIds.value, [viewType]: config.id }
    })
    return config
  }

  const duplicateConfiguration = (id: string) => {
    const original = allConfigurations.value.find(c => c.id === id)
    if (!original) return null

    const viewType = original.viewType
    pushToHistory(viewType)

    const duplicate: FilterConfiguration = {
      ...JSON.parse(JSON.stringify(original)),
      id: crypto.randomUUID(),
      name: `${original.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const order = [...(configOrder.value[viewType] || [])]
    const originalIdx = order.indexOf(id)
    if (originalIdx !== -1) {
      order.splice(originalIdx + 1, 0, duplicate.id)
    } else {
      order.push(duplicate.id)
    }

    updateData({
      configs: [...allConfigurations.value, duplicate],
      configOrder: { ...configOrder.value, [viewType]: order },
      activeConfigIds: { ...activeConfigIds.value, [viewType]: duplicate.id }
    })
    return duplicate
  }

  const deleteConfiguration = (id: string) => {
    const config = allConfigurations.value.find(c => c.id === id)
    if (!config) return false

    const viewType = config.viewType
    const newConfigs = allConfigurations.value.filter(c => c.id !== id)
    const newOrder = { ...configOrder.value }
    newOrder[viewType] = (newOrder[viewType] || []).filter(cid => cid !== id)
    const newHistory = { ...configHistoryStack.value }
    newHistory[viewType] = (newHistory[viewType] || []).filter(cid => cid !== id)
    const newActiveIds = { ...activeConfigIds.value }

    if (newActiveIds[viewType] === id) {
      const viewConfigs = newConfigs.filter(c => c.viewType === viewType)
      if (viewConfigs.length > 0) {
        // Pop from history stack until valid
        let nextId: string | undefined
        const stack = [...newHistory[viewType]]
        while (stack.length > 0) {
          const candidate = stack.pop()!
          if (viewConfigs.some(c => c.id === candidate)) {
            nextId = candidate
            break
          }
        }
        newHistory[viewType] = stack
        newActiveIds[viewType] = nextId || newOrder[viewType][0] || viewConfigs[0].id
      } else {
        // Create new default
        const newConfig = createDefaultConfig(viewType, {
          default_sort_field: defaultSortField.value,
          default_sort_order: defaultSortOrder.value
        })
        newConfigs.push(newConfig)
        newOrder[viewType] = [newConfig.id]
        newActiveIds[viewType] = newConfig.id
      }
    }

    updateData({
      configs: newConfigs,
      configOrder: newOrder,
      configHistoryStack: newHistory,
      activeConfigIds: newActiveIds
    })
    return true
  }

  // Update the working copy (does NOT persist - call saveActiveConfiguration to persist)
  const updateConfiguration = (id: string, updates: Partial<FilterConfiguration>) => {
    // Only update working copy if it's the active config
    if (workingConfig.value && workingConfig.value.id === id) {
      workingConfig.value = {
        ...workingConfig.value,
        ...updates
      }
      return true
    }
    return false
  }

  const setActiveConfiguration = (id: string) => {
    const config = allConfigurations.value.find(c => c.id === id)
    if (config) {
      const viewType = config.viewType
      if (activeConfigIds.value[viewType] !== id) {
        configSwitchTimestamp = performance.now()
        pushToHistory(viewType)
      }
      updateData({
        activeConfigIds: { ...activeConfigIds.value, [viewType]: id }
      })
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

  const hasActiveFilters = computed(() => {
    if (!activeConfig.value) return false
    const search = activeConfig.value.searchQuery
    const quick = activeConfig.value.quickFilters
    const col = activeConfig.value.columnFilters
    return !!search || Object.keys(quick).length > 0 || Object.keys(col).length > 0
  })

  const activeColumnFilterKeys = computed(() => {
    if (!activeConfig.value) return []
    return Object.keys(activeConfig.value.columnFilters) as (keyof ColumnFilters)[]
  })

  const quickFilterFields = computed(() => {
    const defaults = DEFAULT_QUICK_FILTERS_BY_VIEW[currentViewType.value]
    const customOrder = quickFilterOrder.value[currentViewType.value] || []
    if (customOrder.length === 0) return defaults
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
    updateData({
      quickFilterOrder: { ...quickFilterOrder.value, [currentViewType.value]: order }
    })
  }

  const updateConfigOrder = (order: string[]) => {
    updateData({
      configOrder: { ...configOrder.value, [currentViewType.value]: order }
    })
  }

  return {
    configurations,
    activeConfig,
    activeConfigId,
    currentViewType,
    quickFilterFields,
    hasActiveFilters,
    hasUnsavedChanges,
    activeColumnFilterKeys,
    setCurrentView,
    createConfiguration,
    duplicateConfiguration,
    deleteConfiguration,
    updateConfiguration,
    setActiveConfiguration,
    saveActiveConfiguration,
    discardChanges,
    updateSearchQuery,
    updateQuickFilter,
    updateQuickFilterOrder,
    updateConfigOrder,
    updateColumnFilter,
    removeColumnFilter,
    clearAllFilters
  }
}
