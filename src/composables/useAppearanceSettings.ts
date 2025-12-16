import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { getCached, setCache, isEqual } from '@/lib/cache'
import type { AppSettings } from '@/types'

const defaults: AppSettings = {
  email_color: '#3b82f6',
  craft_color: '#8b5cf6',
  file_color: '#ef4444',
  craft_space_id: '',
  person_color: '#10b981',
  project_color: '#f59e0b',
  teamwork_base_url: '',
  cost_group_prefixes: ['KGR'],
  location_prefix: 'O-',
  files_bucket: 'files',
  hide_completed_tasks: false
}
const cached = getCached<AppSettings>('app_settings')
const settings = ref<AppSettings>(cached ? { ...defaults, ...cached } : { ...defaults })
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
    // Fire off background refresh (don't await if we have cached data)
    const hasCached = cached !== null
    const refreshPromise = fetchSettings()
    if (!hasCached) await refreshPromise
  }

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<boolean> => {
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

  const updateEmailColor = (color: string) => updateSetting('email_color', color)
  const updateCraftColor = (color: string) => updateSetting('craft_color', color)
  const updateFileColor = (color: string) => updateSetting('file_color', color)
  const updateCraftSpaceId = (id: string) => updateSetting('craft_space_id', id)
  const updatePersonColor = (color: string) => updateSetting('person_color', color)
  const updateProjectColor = (color: string) => updateSetting('project_color', color)
  const updateTeamworkBaseUrl = (url: string) => updateSetting('teamwork_base_url', url)
  const updateCostGroupPrefixes = (prefixes: string[]) => updateSetting('cost_group_prefixes', prefixes)
  const updateLocationPrefix = (prefix: string) => updateSetting('location_prefix', prefix)
  const updateHideCompletedTasks = (hide: boolean) => updateSetting('hide_completed_tasks', hide)

  const emailColor = computed(() => settings.value.email_color)
  const craftColor = computed(() => settings.value.craft_color)
  const fileColor = computed(() => settings.value.file_color)
  const craftSpaceId = computed(() => settings.value.craft_space_id || '')
  const personColor = computed(() => settings.value.person_color)
  const projectColor = computed(() => settings.value.project_color)
  const teamworkBaseUrl = computed(() => settings.value.teamwork_base_url || '')
  const costGroupPrefixes = computed(() => settings.value.cost_group_prefixes || ['KGR'])
  const locationPrefix = computed(() => settings.value.location_prefix || 'O-')
  const filesBucket = computed(() => settings.value.files_bucket || 'files')
  const hideCompletedTasks = computed(() => settings.value.hide_completed_tasks ?? false)

  return {
    settings,
    loading,
    saving,
    emailColor,
    craftColor,
    fileColor,
    craftSpaceId,
    personColor,
    projectColor,
    teamworkBaseUrl,
    costGroupPrefixes,
    locationPrefix,
    filesBucket,
    hideCompletedTasks,
    initialize,
    fetchSettings,
    updateEmailColor,
    updateCraftColor,
    updateFileColor,
    updateCraftSpaceId,
    updatePersonColor,
    updateProjectColor,
    updateTeamworkBaseUrl,
    updateCostGroupPrefixes,
    updateLocationPrefix,
    updateHideCompletedTasks
  }
}

