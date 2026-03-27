import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { getCached, setCache, isEqual } from '@/lib/cache'
import type { FileIgnorePattern } from '@/types'

// ===== ADMIN SETTINGS (app_settings table) =====
// These settings affect all users and can only be changed by admins

export interface ChatModelConfig {
  id: string
  provider: 'anthropic' | 'openai_compat'
  name: string
  base_url?: string
  context_window?: number
  supports_vision?: boolean
  input_price?: number
  output_price?: number
  cache_read_price?: number
  cache_write_price?: number
  hidden?: boolean
  system_prompt_addition?: string
  auto_execute_code_blocks?: boolean
}

export interface AdminSettings {
  // Colors (shared across all users)
  email_color: string
  craft_color: string
  file_color: string
  person_color: string
  project_color: string
  // Integration config
  craft_space_id: string
  teamwork_base_url: string
  // Extraction prefixes
  cost_group_prefixes: string[]
  location_prefix: string
  // File handling
  files_bucket: string
  file_ignore_patterns: FileIgnorePattern[]
  // Sync filters (exclude from Teamwork import)
  excluded_tw_company_ids: number[]
  excluded_tw_project_ids: number[]
  // Email visibility (RLS)
  public_email_addresses: string[]
  // AI Models
  chat_models: ChatModelConfig[]
  default_chat_model_id: string
  agent_model_id: string
  vision_fallback_model_id: string
  title_model_id: string
}

// Built-in file ignore patterns (can be disabled but not deleted)
export const BUILTIN_FILE_IGNORE_PATTERNS: FileIgnorePattern[] = [
  { pattern: '%~$%', label: 'Office Lock Files (~$...)', enabled: true, builtin: true },
  { pattern: '%.nosync', label: 'iCloud Sync Markers (.nosync)', enabled: true, builtin: true },
  { pattern: '%.mproject/%.sql', label: 'Merlin Project Internals (.mproject/*.sql)', enabled: true, builtin: true },
  { pattern: '%.dwl', label: 'AutoCAD Lock Files (.dwl)', enabled: true, builtin: true },
  { pattern: '%.dwl2', label: 'AutoCAD Lock Files (.dwl2)', enabled: true, builtin: true },
  { pattern: '%.dgraph/%.plist', label: 'DataGraph Internals (.dgraph/*.plist)', enabled: true, builtin: true },
  { pattern: '%#recycle%', label: 'NAS Recycle Bin (#recycle)', enabled: true, builtin: true },
  { pattern: '%.sb-%', label: 'macOS Sandbox Temp (.sb-*)', enabled: true, builtin: true },
  { pattern: '%desktop.ini', label: 'Windows Folder Config (desktop.ini)', enabled: true, builtin: true },
  { pattern: '%.bak', label: 'AutoCAD Backup Files (.bak)', enabled: true, builtin: true },
  { pattern: '%.log', label: 'Log Files (.log)', enabled: true, builtin: true },
]

const defaults: AdminSettings = {
  email_color: '#3b82f6',
  craft_color: '#8b5cf6',
  file_color: '#ef4444',
  person_color: '#10b981',
  project_color: '#f59e0b',
  craft_space_id: '',
  teamwork_base_url: '',
  cost_group_prefixes: ['KGR'],
  location_prefix: 'O-',
  files_bucket: 'files',
  file_ignore_patterns: BUILTIN_FILE_IGNORE_PATTERNS,
  excluded_tw_company_ids: [],
  excluded_tw_project_ids: [],
  public_email_addresses: [],
  chat_models: [],
  default_chat_model_id: '',
  agent_model_id: '',
  vision_fallback_model_id: '',
  title_model_id: '',
}

const cached = getCached<AdminSettings>('app_settings')
const settings = ref<AdminSettings>(cached ? { ...defaults, ...cached } : { ...defaults })
const loading = ref(false)
const saving = ref(false)
const initialized = ref(false)

export function useAppearanceSettings() {
  const fetchSettings = async () => {
    try {
      loading.value = true
      const { data, error } = await supabase
        .from('app_settings')
        .select('body')
        .single()

      if (error) throw error
      const fresh = { ...defaults, ...data.body }
      if (!isEqual(fresh, settings.value)) {
        settings.value = fresh
      }
      setCache('app_settings', data.body)
    } catch (error) {
      console.error('Error fetching app settings:', error)
    } finally {
      loading.value = false
    }
  }

  const initialize = async () => {
    if (initialized.value) return
    initialized.value = true
    const hasCached = cached !== null
    const refreshPromise = fetchSettings()
    if (!hasCached) await refreshPromise
  }

  const updateSetting = async <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]): Promise<boolean> => {
    try {
      saving.value = true
      const newBody = { ...settings.value, [key]: value }
      const { error } = await supabase
        .from('app_settings')
        .update({ body: newBody })
        .eq('lock', 'X')

      if (error) throw error
      settings.value = newBody
      setCache('app_settings', newBody)
      return true
    } catch (error) {
      console.error(`Error updating ${key}:`, error)
      return false
    } finally {
      saving.value = false
    }
  }

  // Color updaters
  const updateEmailColor = (color: string) => updateSetting('email_color', color)
  const updateCraftColor = (color: string) => updateSetting('craft_color', color)
  const updateFileColor = (color: string) => updateSetting('file_color', color)
  const updatePersonColor = (color: string) => updateSetting('person_color', color)
  const updateProjectColor = (color: string) => updateSetting('project_color', color)

  // Integration config updaters
  const updateCraftSpaceId = (id: string) => updateSetting('craft_space_id', id)
  const updateTeamworkBaseUrl = (url: string) => updateSetting('teamwork_base_url', url)

  // Extraction prefix updaters
  const updateCostGroupPrefixes = (prefixes: string[]) => updateSetting('cost_group_prefixes', prefixes)
  const updateLocationPrefix = (prefix: string) => updateSetting('location_prefix', prefix)

  // File pattern updaters
  const updateFileIgnorePatterns = (patterns: FileIgnorePattern[]) => updateSetting('file_ignore_patterns', patterns)

  // Sync filter updaters
  const updateExcludedCompanyIds = (ids: number[]) => updateSetting('excluded_tw_company_ids', ids)
  const updateExcludedProjectIds = (ids: number[]) => updateSetting('excluded_tw_project_ids', ids)

  // Public email addresses updater
  const updatePublicEmailAddresses = (emails: string[]) => updateSetting('public_email_addresses', emails)

  // Computed accessors
  const emailColor = computed(() => settings.value.email_color)
  const craftColor = computed(() => settings.value.craft_color)
  const fileColor = computed(() => settings.value.file_color)
  const personColor = computed(() => settings.value.person_color)
  const projectColor = computed(() => settings.value.project_color)
  const craftSpaceId = computed(() => settings.value.craft_space_id || '')
  const teamworkBaseUrl = computed(() => settings.value.teamwork_base_url || '')
  const costGroupPrefixes = computed(() => settings.value.cost_group_prefixes || ['KGR'])
  const locationPrefix = computed(() => settings.value.location_prefix || 'O-')
  const filesBucket = computed(() => settings.value.files_bucket || 'files')

  // Merge builtin patterns with stored patterns, preserving user's enabled state
  const fileIgnorePatterns = computed(() => {
    const stored = settings.value.file_ignore_patterns || []
    const storedMap = new Map(stored.map(p => [p.pattern, p]))
    
    const merged: FileIgnorePattern[] = BUILTIN_FILE_IGNORE_PATTERNS.map(builtin => {
      const storedPattern = storedMap.get(builtin.pattern)
      return storedPattern ? { ...builtin, enabled: storedPattern.enabled } : { ...builtin }
    })
    
    stored.filter(p => !p.builtin).forEach(p => merged.push(p))
    return merged
  })

  const enabledFileIgnorePatterns = computed(() => 
    fileIgnorePatterns.value.filter(p => p.enabled).map(p => p.pattern)
  )

  // Sync filter accessors
  const excludedCompanyIds = computed(() => settings.value.excluded_tw_company_ids || [])
  const excludedProjectIds = computed(() => settings.value.excluded_tw_project_ids || [])

  // Public email addresses accessor
  const publicEmailAddresses = computed(() => settings.value.public_email_addresses || [])

  return {
    settings,
    loading,
    saving,
    // Colors
    emailColor,
    craftColor,
    fileColor,
    personColor,
    projectColor,
    updateEmailColor,
    updateCraftColor,
    updateFileColor,
    updatePersonColor,
    updateProjectColor,
    // Integration
    craftSpaceId,
    teamworkBaseUrl,
    updateCraftSpaceId,
    updateTeamworkBaseUrl,
    // Extraction
    costGroupPrefixes,
    locationPrefix,
    updateCostGroupPrefixes,
    updateLocationPrefix,
    // Files
    filesBucket,
    fileIgnorePatterns,
    enabledFileIgnorePatterns,
    updateFileIgnorePatterns,
    // Sync filters
    excludedCompanyIds,
    excludedProjectIds,
    updateExcludedCompanyIds,
    updateExcludedProjectIds,
    // Email visibility
    publicEmailAddresses,
    updatePublicEmailAddresses,
    // Generic
    updateSetting,
    // Init
    initialize,
    fetchSettings
  }
}
