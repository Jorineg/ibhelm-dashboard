import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { getCached, setCache } from '@/lib/cache'
import type { FilterConfiguration, ViewType, QuickFilters } from '@/types'
import type { KeyBindings } from './useKeyBindings'

// ===== USER SETTINGS TYPES =====

export interface UserSettings {
  hide_completed_tasks: boolean
  hide_inactive_projects: boolean
  default_sort_field: string
  default_sort_order: 'asc' | 'desc'
  tooltips_disabled: boolean
  filter_configurations: FilterConfigurationsData
  key_bindings: Partial<Record<keyof KeyBindings, string>>
}

export interface FilterConfigurationsData {
  configs: FilterConfiguration[]
  activeConfigIds: Record<ViewType, string>
  configOrder: Record<ViewType, string[]>
  configHistoryStack: Record<ViewType, string[]>
  quickFilterOrder: Record<ViewType, (keyof QuickFilters)[]>
}

// ===== DEFAULTS =====

const DEFAULT_FILTER_CONFIGURATIONS: FilterConfigurationsData = {
  configs: [],
  activeConfigIds: { items: '', projects: '', people: '' },
  configOrder: { items: [], projects: [], people: [] },
  configHistoryStack: { items: [], projects: [], people: [] },
  quickFilterOrder: { items: [], projects: [], people: [] }
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  hide_completed_tasks: false,
  hide_inactive_projects: false,
  default_sort_field: 'updated_at',
  default_sort_order: 'desc',
  tooltips_disabled: false,
  filter_configurations: { ...DEFAULT_FILTER_CONFIGURATIONS },
  key_bindings: {}
}

// ===== MODULE STATE =====

const settings = ref<UserSettings>({ ...DEFAULT_USER_SETTINGS })
const loading = ref(false)
const saving = ref(false)
const initialized = ref(false)
const userId = ref<string | null>(null)

// Debounce save to avoid excessive DB writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 500

// ===== COMPOSABLE =====

export function useUserSettings() {
  const fetchSettings = async (uid: string) => {
    try {
      loading.value = true
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', uid)
        .maybeSingle()

      if (error) throw error

      if (data) {
        // Merge with defaults - but keep loaded configs if they exist
        const loadedConfigs = data.settings?.filter_configurations || {}
        const merged: UserSettings = {
          ...DEFAULT_USER_SETTINGS,
          ...data.settings,
          filter_configurations: {
            configs: loadedConfigs.configs || [],
            activeConfigIds: { ...DEFAULT_FILTER_CONFIGURATIONS.activeConfigIds, ...(loadedConfigs.activeConfigIds || {}) },
            configOrder: { ...DEFAULT_FILTER_CONFIGURATIONS.configOrder, ...(loadedConfigs.configOrder || {}) },
            configHistoryStack: { ...DEFAULT_FILTER_CONFIGURATIONS.configHistoryStack, ...(loadedConfigs.configHistoryStack || {}) },
            quickFilterOrder: { ...DEFAULT_FILTER_CONFIGURATIONS.quickFilterOrder, ...(loadedConfigs.quickFilterOrder || {}) }
          }
        }
        settings.value = merged
        setCache(`user_settings_${uid}`, merged)
      } else {
        // No settings row yet - create one
        await createDefaultSettings(uid)
      }
    } catch (error) {
      console.error('Error fetching user settings:', error)
    } finally {
      loading.value = false
    }
  }

  const createDefaultSettings = async (uid: string) => {
    try {
      // Migrate from localStorage if available
      const migratedSettings = migrateFromLocalStorage()
      const settingsToSave: UserSettings = {
        ...DEFAULT_USER_SETTINGS,
        ...migratedSettings,
        filter_configurations: {
          ...DEFAULT_FILTER_CONFIGURATIONS,
          ...(migratedSettings.filter_configurations || {})
        }
      }
      
      const { error } = await supabase
        .from('user_settings')
        .insert({ user_id: uid, settings: settingsToSave })

      if (error) throw error
      settings.value = settingsToSave
      setCache(`user_settings_${uid}`, settingsToSave)
    } catch (error) {
      console.error('Error creating user settings:', error)
    }
  }

  const migrateFromLocalStorage = (): Partial<UserSettings> => {
    const migrated: Partial<UserSettings> = {}
    
    // Migrate filter configurations
    try {
      const stored = localStorage.getItem('ibhelm_filter_configurations_v3')
      if (stored) {
        const parsed = JSON.parse(stored)
        migrated.filter_configurations = {
          configs: parsed.configs || [],
          activeConfigIds: parsed.activeConfigIds || { items: '', projects: '', people: '' },
          configOrder: parsed.configOrder || { items: [], projects: [], people: [] },
          configHistoryStack: parsed.configHistoryStack || { items: [], projects: [], people: [] },
          quickFilterOrder: parsed.quickFilterOrder || { items: [], projects: [], people: [] }
        }
        // Clear localStorage after successful migration
        localStorage.removeItem('ibhelm_filter_configurations_v3')
      }
    } catch (e) {
      console.warn('Failed to migrate filter configurations:', e)
    }

    // Migrate key bindings
    try {
      const stored = localStorage.getItem('ibhelm_key_bindings')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Extract just the key strings from KeyBinding objects
        const keyMap: Partial<Record<keyof KeyBindings, string>> = {}
        for (const [action, binding] of Object.entries(parsed)) {
          if (binding && typeof binding === 'object' && 'key' in binding) {
            keyMap[action as keyof KeyBindings] = (binding as { key: string }).key
          }
        }
        migrated.key_bindings = keyMap
        localStorage.removeItem('ibhelm_key_bindings')
      }
    } catch (e) {
      console.warn('Failed to migrate key bindings:', e)
    }

    return migrated
  }

  const initialize = async (uid: string) => {
    // Already initialized for this user
    if (initialized.value && userId.value === uid) return
    
    userId.value = uid
    
    // Try cached first
    const cached = getCached<UserSettings>(`user_settings_${uid}`)
    if (cached) {
      settings.value = {
        ...DEFAULT_USER_SETTINGS,
        ...cached,
        filter_configurations: {
          ...DEFAULT_FILTER_CONFIGURATIONS,
          ...(cached.filter_configurations || {})
        }
      }
      // Set initialized after loading cached data
      initialized.value = true
      // Background refresh (don't await)
      fetchSettings(uid)
    } else {
      // No cache - must wait for fetch
      await fetchSettings(uid)
      initialized.value = true
    }
  }

  const saveSettings = async () => {
    if (!userId.value) return false
    
    try {
      saving.value = true
      const { error } = await supabase
        .from('user_settings')
        .update({ settings: settings.value, db_updated_at: new Date().toISOString() })
        .eq('user_id', userId.value)

      if (error) throw error
      setCache(`user_settings_${userId.value}`, settings.value)
      return true
    } catch (error) {
      console.error('Error saving user settings:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      saveSettings()
      saveTimeout = null
    }, SAVE_DEBOUNCE_MS)
  }

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    settings.value = { ...settings.value, [key]: value }
    debouncedSave()
  }

  // ===== COMPUTED ACCESSORS =====

  const hideCompletedTasks = computed(() => settings.value.hide_completed_tasks)
  const hideInactiveProjects = computed(() => settings.value.hide_inactive_projects)
  const defaultSortField = computed(() => settings.value.default_sort_field)
  const defaultSortOrder = computed(() => settings.value.default_sort_order)
  const tooltipsDisabled = computed(() => settings.value.tooltips_disabled)
  const filterConfigurations = computed(() => settings.value.filter_configurations)
  const keyBindings = computed(() => settings.value.key_bindings)

  // ===== UPDATE HELPERS =====

  const updateHideCompletedTasks = (value: boolean) => updateSetting('hide_completed_tasks', value)
  const updateHideInactiveProjects = (value: boolean) => updateSetting('hide_inactive_projects', value)
  const updateDefaultSortField = (value: string) => updateSetting('default_sort_field', value)
  const updateDefaultSortOrder = (value: 'asc' | 'desc') => updateSetting('default_sort_order', value)
  const updateTooltipsDisabled = (value: boolean) => updateSetting('tooltips_disabled', value)
  
  const updateFilterConfigurations = (value: FilterConfigurationsData) => {
    updateSetting('filter_configurations', value)
  }
  
  const updateKeyBindings = (value: Partial<Record<keyof KeyBindings, string>>) => {
    updateSetting('key_bindings', value)
  }

  return {
    settings,
    loading,
    saving,
    initialized,
    initialize,
    fetchSettings,
    saveSettings,
    // Individual accessors
    hideCompletedTasks,
    hideInactiveProjects,
    defaultSortField,
    defaultSortOrder,
    tooltipsDisabled,
    filterConfigurations,
    keyBindings,
    // Updaters
    updateHideCompletedTasks,
    updateHideInactiveProjects,
    updateDefaultSortField,
    updateDefaultSortOrder,
    updateTooltipsDisabled,
    updateFilterConfigurations,
    updateKeyBindings
  }
}
