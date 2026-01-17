import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

// Context filters for autocomplete - matches DB function parameters
export interface AutocompleteContext {
  types?: string[]        // p_ctx_types: item types to filter by
  project?: string        // p_ctx_project: project name filter
  person?: string         // p_ctx_person: involved person filter  
  location?: string       // p_ctx_location: location filter
  costGroup?: string      // p_ctx_cost_group: cost group code filter
  tags?: string           // p_ctx_tags: tag filter
}

export interface CompanySuggestion {
  id: number
  name: string
  project_count: number
}

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

export interface CostGroupSuggestion {
  id: string
  code: number
  name: string | null
  path: string | null
}

export interface TagSuggestion {
  id: string
  name: string
  color: string | null
  source: 'teamwork' | 'missive'
}

export interface LocationSuggestion {
  id: string
  name: string
  type: 'building' | 'level' | 'room'
  path: string | null
  depth: number
}

export function useCompanyAutocomplete() {
  const suggestions = ref<CompanySuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_companies_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit
      })
      
      if (rpcError) throw rpcError
      suggestions.value = data || []
    } catch (err) {
      console.error('Error searching companies:', err)
      error.value = err instanceof Error ? err.message : 'Failed to search companies'
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    suggestions.value = []
    error.value = null
  }

  return { suggestions, loading, error, search, clear }
}

export function useProjectAutocomplete() {
  const suggestions = ref<ProjectSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10, context?: AutocompleteContext) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_projects_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit,
        p_ctx_types: context?.types ?? null,
        p_ctx_person: context?.person ?? null,
        p_ctx_location: context?.location ?? null,
        p_ctx_cost_group: context?.costGroup ?? null,
        p_ctx_tags: context?.tags ?? null
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

  return { suggestions, loading, error, search, clear }
}

export function usePersonAutocomplete() {
  const suggestions = ref<PersonSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10, context?: AutocompleteContext) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_persons_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit,
        p_ctx_types: context?.types ?? null,
        p_ctx_project: context?.project ?? null,
        p_ctx_location: context?.location ?? null,
        p_ctx_cost_group: context?.costGroup ?? null,
        p_ctx_tags: context?.tags ?? null
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

  return { suggestions, loading, error, search, clear }
}

export function useCostGroupAutocomplete() {
  const suggestions = ref<CostGroupSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10, context?: AutocompleteContext) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_cost_groups_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit,
        p_ctx_types: context?.types ?? null,
        p_ctx_project: context?.project ?? null,
        p_ctx_person: context?.person ?? null,
        p_ctx_location: context?.location ?? null,
        p_ctx_tags: context?.tags ?? null
      })
      
      if (rpcError) throw rpcError
      suggestions.value = data || []
    } catch (err) {
      console.error('Error searching cost groups:', err)
      error.value = err instanceof Error ? err.message : 'Failed to search cost groups'
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    suggestions.value = []
    error.value = null
  }

  return { suggestions, loading, error, search, clear }
}

export function useLocationAutocomplete() {
  const suggestions = ref<LocationSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10, context?: AutocompleteContext) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_locations_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit,
        p_ctx_types: context?.types ?? null,
        p_ctx_project: context?.project ?? null,
        p_ctx_person: context?.person ?? null,
        p_ctx_cost_group: context?.costGroup ?? null,
        p_ctx_tags: context?.tags ?? null
      })
      
      if (rpcError) throw rpcError
      suggestions.value = data || []
    } catch (err) {
      console.error('Error searching locations:', err)
      error.value = err instanceof Error ? err.message : 'Failed to search locations'
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    suggestions.value = []
    error.value = null
  }

  return { suggestions, loading, error, search, clear }
}

export function useTagAutocomplete() {
  const suggestions = ref<TagSuggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const search = async (searchText: string, limit = 10, context?: AutocompleteContext) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: rpcError } = await supabase.rpc('search_tags_autocomplete', {
        p_search_text: searchText || '',
        p_limit: limit,
        p_ctx_types: context?.types ?? null,
        p_ctx_project: context?.project ?? null,
        p_ctx_person: context?.person ?? null,
        p_ctx_location: context?.location ?? null,
        p_ctx_cost_group: context?.costGroup ?? null
      })
      
      if (rpcError) throw rpcError
      suggestions.value = data || []
    } catch (err) {
      console.error('Error searching tags:', err)
      error.value = err instanceof Error ? err.message : 'Failed to search tags'
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  const clear = () => {
    suggestions.value = []
    error.value = null
  }

  return { suggestions, loading, error, search, clear }
}
