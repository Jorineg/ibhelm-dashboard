import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { AppSettings } from '@/types'

const settings = ref<AppSettings>({ email_color: '#3b82f6', craft_color: '#8b5cf6' })
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
      settings.value = { ...settings.value, ...data.body }
    } catch (error) {
      console.error('Error fetching app settings:', error)
    } finally {
      loading.value = false
    }
  }

  const initialize = async () => {
    if (initialized.value) return
    initialized.value = true
    await fetchSettings()
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

  const emailColor = computed(() => settings.value.email_color)
  const craftColor = computed(() => settings.value.craft_color)

  return {
    settings,
    loading,
    saving,
    emailColor,
    craftColor,
    initialize,
    fetchSettings,
    updateEmailColor,
    updateCraftColor
  }
}

