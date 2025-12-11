import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { ViewDataItem, FilterConfiguration, SortConfig, ViewType } from '@/types'

const PAGE_SIZE = 50

// Request versioning to handle race conditions when switching configs
let requestVersion = 0

// Build RPC params from filter configuration
function buildUnifiedItemsParams(
  filterConfig: FilterConfiguration | null,
  search: string,
  showTasks: boolean,
  showEmails: boolean,
  showCraft: boolean,
  showFiles: boolean,
  selectedTaskTypes: string[] | null,
  sortConfig: SortConfig,
  page: number
) {
  const quick = filterConfig?.quickFilters || {}
  const col = filterConfig?.columnFilters || {}
  
  // Build types array
  const types: string[] = []
  if (showTasks && !(selectedTaskTypes && selectedTaskTypes.length === 0)) types.push('task')
  if (showEmails) types.push('email')
  if (showCraft) types.push('craft')
  if (showFiles) types.push('file')
  
  return {
    // Type filters
    p_types: types.length > 0 ? types : null,
    p_task_types: selectedTaskTypes && selectedTaskTypes.length > 0 ? selectedTaskTypes : null,
    
    // Global text search
    p_text_search: search || null,
    
    // Special filters (quick filters)
    p_involved_person: quick.involved_person || null,
    p_tag_search: quick.tags || null,
    p_cost_group_code: quick.kostengruppe || null,
    
    // Simple text contains (quick + column filters)
    p_project_search: quick.project || null,
    p_location_search: quick.location || null,
    p_name_contains: col.name_contains || null,
    p_description_contains: col.description_contains || null,
    p_customer_contains: col.customer_contains || null,
    p_tasklist_contains: col.tasklist_contains || null,
    p_from_name_contains: col.from_name_contains || null,
    p_from_email_contains: col.from_email_contains || null,
    
    // Enum filters
    p_status_in: col.status_in && col.status_in.length > 0 ? col.status_in : null,
    p_status_not_in: col.status_not_in && col.status_not_in.length > 0 ? col.status_not_in : null,
    p_priority_in: col.priority_in && col.priority_in.length > 0 ? col.priority_in : null,
    p_priority_not_in: col.priority_not_in && col.priority_not_in.length > 0 ? col.priority_not_in : null,
    
    // Date range filters
    p_due_date_min: col.due_date_min || null,
    p_due_date_max: col.due_date_max || null,
    p_due_date_is_null: col.due_date_is_null ?? null,
    p_created_at_min: col.created_at_min || null,
    p_created_at_max: col.created_at_max || null,
    p_updated_at_min: col.updated_at_min || null,
    p_updated_at_max: col.updated_at_max || null,
    
    // Number range filters
    p_progress_min: col.progress_min ?? null,
    p_progress_max: col.progress_max ?? null,
    p_attachment_count_min: col.attachment_count_min ?? null,
    p_attachment_count_max: col.attachment_count_max ?? null,
    
    // Pagination & sorting
    p_sort_field: sortConfig.field,
    p_sort_order: sortConfig.order,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  }
}

export function useData() {
  const items = ref<ViewDataItem[]>([])
  const loading = ref(false)
  const hasMore = ref(true)
  const currentPage = ref(0)
  const searchQuery = ref('')
  const totalCount = ref<number | null>(null)
  const currentSort = ref<SortConfig>({ field: 'sort_date', order: 'desc' })
  const currentViewType = ref<ViewType>('items')
  const error = ref<string | null>(null)

  // Fetch unified items using the single RPC function
  const fetchUnifiedItems = async (
    page = 0,
    search = '',
    showTasks = true,
    showEmails = true,
    showCraft = true,
    showFiles = true,
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    selectedTaskTypes: string[] | null = null
  ) => {
    const sort = sortConfig || currentSort.value
    
    // Check if any type is selected
    const hasTypes = showTasks || showEmails || showCraft || showFiles || 
      (selectedTaskTypes && selectedTaskTypes.length > 0)
    if (!hasTypes) {
      return { data: [], count: 0 }
    }
    
    const params = buildUnifiedItemsParams(
      filterConfig, search, showTasks, showEmails, showCraft, showFiles,
      selectedTaskTypes, sort, page
    )
    
    // Query data
    const { data, error: queryError } = await supabase.rpc('query_unified_items', params)
    if (queryError) throw queryError
    
    // Get count if needed
    let count: number | null = null
    if (includeCount) {
      // Remove pagination params for count
      const { p_sort_field, p_sort_order, p_limit, p_offset, ...countParams } = params
      const { data: countResult, error: countError } = await supabase.rpc('count_unified_items', countParams)
      if (!countError) count = countResult
    }
    
    return { data: data || [], count }
  }

  // Fetch projects from project_overview view
  const fetchProjects = async (
    page = 0,
    search = '',
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null
  ) => {
    const sort = sortConfig || { field: 'name', order: 'asc' }
    const col = filterConfig?.columnFilters || {}
    
    let query = supabase
      .from('project_overview')
      .select('*', { count: includeCount ? 'exact' : undefined })
      .order(sort.field, { ascending: sort.order === 'asc' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    // Apply search
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,company_name.ilike.%${search}%,client_name.ilike.%${search}%`)
    }

    // Apply column filters
    if (col.name_contains) query = query.ilike('name', `%${col.name_contains}%`)
    if (col.status_in?.length) query = query.in('status', col.status_in)
    if (col.status_not_in?.length) {
      col.status_not_in.forEach(s => { query = query.neq('status', s) })
    }

    const { data, error: queryError, count } = await query
    if (queryError) throw queryError
    return { data: data || [], count }
  }

  // Fetch people using RPC function
  const fetchPeople = async (
    page = 0,
    search = '',
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null
  ) => {
    const sort = sortConfig || { field: 'display_name', order: 'asc' }
    const quick = filterConfig?.quickFilters || {}
    
    const params = {
      p_text_search: search || null,
      p_project_search: quick.project || null,
      p_is_internal: null,
      p_is_company: null,
      p_sort_field: sort.field,
      p_sort_order: sort.order,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    }
    
    const { data, error: queryError } = await supabase.rpc('query_unified_persons', params)
    if (queryError) throw queryError
    
    let count: number | null = null
    if (includeCount) {
      const { data: countResult, error: countError } = await supabase.rpc('count_unified_persons', {
        p_text_search: params.p_text_search,
        p_project_search: params.p_project_search,
        p_is_internal: params.p_is_internal,
        p_is_company: params.p_is_company,
      })
      if (!countError) count = countResult
    }
    
    return { data: data || [], count }
  }

  // Data items are now directly from the view
  const dataItems = computed<ViewDataItem[]>(() => items.value)

  // Load initial data
  const loadData = async (
    showTasks = true,
    showEmails = true,
    showCraft = true,
    showFiles = true,
    search = '',
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    viewType: ViewType = 'items',
    selectedTaskTypes: string[] | null = null
  ) => {
    // Increment version and capture it for this request
    const thisRequestVersion = ++requestVersion
    
    loading.value = true
    currentPage.value = 0
    items.value = []
    hasMore.value = true
    currentViewType.value = viewType
    error.value = null

    // Update current sort if provided
    if (sortConfig) {
      currentSort.value = sortConfig
    }

    try {
      let result: { data: any[]; count: number | null }
      
      switch (viewType) {
        case 'projects':
          result = await fetchProjects(0, search, true, filterConfig, currentSort.value)
          break
        case 'people':
          result = await fetchPeople(0, search, true, filterConfig, currentSort.value)
          break
        case 'items':
        default:
          result = await fetchUnifiedItems(0, search, showTasks, showEmails, showCraft, showFiles, true, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      // Only update state if this is still the current request
      if (thisRequestVersion !== requestVersion) return
      
      items.value = result.data
      totalCount.value = result.count
      hasMore.value = result.data.length === PAGE_SIZE
    } catch (err) {
      // Only update error if this is still the current request
      if (thisRequestVersion === requestVersion) {
        console.error('Error loading data:', err)
        error.value = err instanceof Error ? err.message : 'Failed to load data. Please try again.'
      }
    } finally {
      // Only update loading state if this is still the current request
      if (thisRequestVersion === requestVersion) {
        loading.value = false
      }
    }
  }

  // Load more data (for infinite scroll)
  const loadMore = async (
    showTasks = true,
    showEmails = true,
    showCraft = true,
    showFiles = true,
    search = '',
    filterConfig: FilterConfiguration | null = null,
    viewType: ViewType = 'items',
    selectedTaskTypes: string[] | null = null
  ) => {
    if (loading.value || !hasMore.value) return

    // Capture current version - loadMore should not bump version, but should respect it
    const thisRequestVersion = requestVersion
    
    loading.value = true
    currentPage.value++

    try {
      let result: { data: any[]; count: number | null }
      
      switch (viewType) {
        case 'projects':
          result = await fetchProjects(currentPage.value, search, false, filterConfig, currentSort.value)
          break
        case 'people':
          result = await fetchPeople(currentPage.value, search, false, filterConfig, currentSort.value)
          break
        case 'items':
        default:
          result = await fetchUnifiedItems(currentPage.value, search, showTasks, showEmails, showCraft, showFiles, false, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      // Only update state if no new loadData has started (version unchanged)
      if (thisRequestVersion !== requestVersion) return
      
      items.value.push(...result.data)
      hasMore.value = result.data.length === PAGE_SIZE
    } catch (err) {
      if (thisRequestVersion === requestVersion) {
        console.error('Error loading more data:', err)
        error.value = err instanceof Error ? err.message : 'Failed to load more data. Please try again.'
      }
    } finally {
      if (thisRequestVersion === requestVersion) {
        loading.value = false
      }
    }
  }

  // Fetch ALL data for export (no pagination)
  const fetchAllForExport = async (
    showTasks = true,
    showEmails = true,
    showCraft = true,
    showFiles = true,
    search = '',
    filterConfig: FilterConfiguration | null = null,
    viewType: ViewType = 'items',
    selectedTaskTypes: string[] | null = null
  ): Promise<ViewDataItem[]> => {
    const sort = currentSort.value
    
    switch (viewType) {
      case 'projects': {
        let query = supabase
          .from('project_overview')
          .select('*')
          .order(sort.field, { ascending: sort.order === 'asc' })
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,company_name.ilike.%${search}%,client_name.ilike.%${search}%`)
        }
        const { data } = await query
        return data || []
      }
      case 'people': {
        const quick = filterConfig?.quickFilters || {}
        const allPeople: ViewDataItem[] = []
        let page = 0
        
        while (true) {
          const { data } = await supabase.rpc('query_unified_persons', {
            p_text_search: search || null,
            p_project_search: quick.project || null,
            p_is_internal: null,
            p_is_company: null,
            p_sort_field: sort.field,
            p_sort_order: sort.order,
            p_limit: 1000,
            p_offset: page * 1000,
          })
          if (!data || data.length === 0) break
          allPeople.push(...data)
          if (data.length < 1000) break
          page++
        }
        return allPeople
      }
      default: {
        // Items view - fetch all in batches using RPC
        const allData: ViewDataItem[] = []
        let page = 0
        
        while (true) {
          const params = buildUnifiedItemsParams(
            filterConfig, search, showTasks, showEmails, showCraft, showFiles,
            selectedTaskTypes, sort, page
          )
          // Use larger batch for export
          params.p_limit = 1000
          params.p_offset = page * 1000
          
          const { data } = await supabase.rpc('query_unified_items', params)
          if (!data || data.length === 0) break
          allData.push(...data)
          if (data.length < 1000) break
          page++
        }
        return allData
      }
    }
  }

  // Immediately clear items and show loading (used when switching configs to prevent flicker)
  const clearAndStartLoading = () => {
    requestVersion++ // Cancel any pending requests
    items.value = []
    loading.value = true
    hasMore.value = true
    totalCount.value = null
    error.value = null
  }

  // Clear error (for retry functionality)
  const clearError = () => {
    error.value = null
  }

  return {
    dataItems,
    loading,
    hasMore,
    searchQuery,
    totalCount,
    currentSort,
    currentViewType,
    error,
    loadData,
    loadMore,
    fetchAllForExport,
    clearAndStartLoading,
    clearError
  }
}
