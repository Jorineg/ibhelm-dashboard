import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { AppearanceSettings } from '@/types'

// Shared state across all composable instances
const settings = ref<AppearanceSettings | null>(null)
const loading = ref(false)
const saving = ref(false)
const initialized = ref(false)

// Default email color
const DEFAULT_EMAIL_COLOR = '#3b82f6'

export function useAppearanceSettings() {
  // Fetch appearance settings (singleton)
  const fetchSettings = async () => {
    try {
      loading.value = true
      const { data, error } = await supabase
        .from('appearance_settings')
        .select('*')
        .limit(1)
        .single()

      if (error) {
        // If no row exists, use defaults
        if (error.code === 'PGRST116') {
          settings.value = {
            id: '',
            email_color: DEFAULT_EMAIL_COLOR
          }
          return
        }
        throw error
      }
      settings.value = data
    } catch (error) {
      console.error('Error fetching appearance settings:', error)
      // Use defaults on error
      settings.value = {
        id: '',
        email_color: DEFAULT_EMAIL_COLOR
      }
    } finally {
      loading.value = false
    }
  }

  // Initialize (only once)
  const initialize = async () => {
    if (initialized.value) return
    initialized.value = true
    await fetchSettings()
  }

  // Update email color
  const updateEmailColor = async (color: string): Promise<boolean> => {
    try {
      saving.value = true
      
      if (settings.value?.id) {
        // Update existing row
        const { error } = await supabase
          .from('appearance_settings')
          .update({ email_color: color })
          .eq('id', settings.value.id)

        if (error) throw error
      } else {
        // Insert new row (shouldn't happen normally due to migration)
        const { data, error } = await supabase
          .from('appearance_settings')
          .insert({ email_color: color })
          .select()
          .single()

        if (error) throw error
        settings.value = data
      }
      
      // Update local state
      if (settings.value) {
        settings.value.email_color = color
      }
      
      return true
    } catch (error) {
      console.error('Error updating email color:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  // Computed: email color (with fallback)
  const emailColor = computed(() => {
    return settings.value?.email_color || DEFAULT_EMAIL_COLOR
  })

  return {
    settings,
    loading,
    saving,
    emailColor,
    initialize,
    fetchSettings,
    updateEmailColor
  }
}

