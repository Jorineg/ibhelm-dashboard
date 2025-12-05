import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface ProjectSuggestion {
  id: number
  name: string
  company_name: string | null
  status: string | null
}

export interface PersonSuggestion {
  id: string
  display_name: string
  primary_email: string | null
  source_type: string
  is_internal: boolean
}

export function useProjectAutocomplete() {
  const suggestions = ref<ProjectSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_projects_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit
      })
      
      if (rpcError) throw rpcError
      
      suggestions.value = data || []
    } catch (err) {
      console.error('Error searching projects:', err)
      error.value = err instanceof Error ? err.message : 'Failed to search projects'
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    suggestions.value = []
    error.value = null
  }

  return {
    suggestions,
    loading,
    error,
    search,
    clear
  }
}

export function usePersonAutocomplete() {
  const suggestions = ref<PersonSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_persons_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit
      })
      
      if (rpcError) throw rpcError
      
      suggestions.value = data || []
    } catch (err) {
      console.error('Error searching persons:', err)
      error.value = err instanceof Error ? err.message : 'Failed to search persons'
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    suggestions.value = []
    error.value = null
  }

  return {
    suggestions,
    loading,
    error,
    search,
    clear
  }
}

