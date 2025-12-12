import { ref, shallowRef, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { generateQueryKey, getCachedQuery, setCachedQuery, formatCacheAge } from '@/lib/queryCache'
import type { ViewDataItem, FilterConfiguration, SortConfig, ViewType } from '@/types'

const PAGE_SIZE = 50

// Request versioning to handle race conditions when switching configs
let requestVersion = 0

// Build cache key for a query
function buildCacheKey(
  viewType: ViewType,
  showTasks: boolean,
  showEmails: boolean,
  showCraft: boolean,
  showFiles: boolean,
  search: string,
  filterConfig: FilterConfiguration | null,
  sortConfig: SortConfig,
  selectedTaskTypes: string[] | null
): string {
  return generateQueryKey({
    viewType,
    showTasks,
    showEmails,
    showCraft,
    showFiles,
    search,
    quickFilters: filterConfig?.quickFilters,
    columnFilters: filterConfig?.columnFilters,
    sortField: sortConfig.field,
    sortOrder: sortConfig.order,
    selectedTaskTypes
  })
}

// Static mapping: columns potentially filled per item type (based on mv_unified_items view)
// Union of these sets gives visible columns for selected checkboxes
export const COLUMNS_BY_TYPE: Record<string, string[]> = {
  task: [
    'name', 'description', 'status', 'project', 'customer', 'location', 'location_path',
    'cost_group', 'cost_group_code', 'due_date', 'priority', 'progress', 'tasklist',
    'task_type_name', 'assigned_to', 'tags', 'creator', 'created_at', 'updated_at', 'teamwork_url'
  ],
  email: [
    'name', 'description', 'preview', 'project', 'location', 'location_path',
    'cost_group', 'cost_group_code', 'body', 'creator', 'conversation_subject',
    'recipients', 'attachments', 'attachment_count', 'assigned_to', 'tags',
    'created_at', 'updated_at', 'missive_url'
  ],
  craft: [
    'name', 'body', 'created_at', 'updated_at', 'craft_url'
  ],
  file: [
    'name', 'description', 'project', 'location', 'location_path',
    'cost_group', 'cost_group_code', 'creator', 'created_at', 'updated_at',
    'storage_path', 'thumbnail_path'
  ]
}

// Compute visible columns based on selected item types
export function getVisibleColumnsForTypes(
  showTasks: boolean,
  showEmails: boolean,
  showCraft: boolean,
  showFiles: boolean,
  selectedTaskTypes: string[] | null
): string[] {
  const columns = new Set<string>()
  
  // Task checkbox: only add if any task types are selected (or selectedTaskTypes is null = all)
  if (showTasks && (selectedTaskTypes === null || selectedTaskTypes.length > 0)) {
    COLUMNS_BY_TYPE.task.forEach(c => columns.add(c))
  }
  if (showEmails) {
    COLUMNS_BY_TYPE.email.forEach(c => columns.add(c))
  }
  if (showCraft) {
    COLUMNS_BY_TYPE.craft.forEach(c => columns.add(c))
  }
  if (showFiles) {
    COLUMNS_BY_TYPE.file.forEach(c => columns.add(c))
  }
  
  return Array.from(columns)
}

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
    p_creator_contains: col.creator_contains || null,
    p_assigned_to_contains: col.assigned_to_contains || null,
    
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
  // shallowRef: only track array reference changes, not deep property changes
  // This dramatically reduces Vue's reactivity overhead for large data arrays
  const items = shallowRef<ViewDataItem[]>([])
  const loading = ref(false)
  const countLoading = ref(false)
  const revalidating = ref(false) // True when showing cached data while fetching fresh
  const cacheTimestamp = ref<number | null>(null) // When cached data was fetched
  const hasMore = ref(true)
  const currentPage = ref(0)
  const searchQuery = ref('')
  const totalCount = ref<number | null>(null)
  const currentSort = ref<SortConfig>({ field: 'sort_date', order: 'desc' })
  const currentViewType = ref<ViewType>('items')
  const error = ref<string | null>(null)
  
  // Formatted cache age for display
  const cacheAge = computed(() => cacheTimestamp.value ? formatCacheAge(cacheTimestamp.value) : null)

  // Fetch unified items - data only, no count
  const fetchUnifiedItems = async (
    page = 0,
    search = '',
    showTasks = true,
    showEmails = true,
    showCraft = true,
    showFiles = true,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    selectedTaskTypes: string[] | null = null
  ) => {
    const sort = sortConfig || currentSort.value
    
    // Check if any type is selected
    const hasTypes = showTasks || showEmails || showCraft || showFiles || 
      (selectedTaskTypes && selectedTaskTypes.length > 0)
    if (!hasTypes) {
      return { data: [] }
    }
    
    const params = buildUnifiedItemsParams(
      filterConfig, search, showTasks, showEmails, showCraft, showFiles,
      selectedTaskTypes, sort, page
    )
    
    const t0 = performance.now()
    const { data, error: queryError } = await supabase.rpc('query_unified_items', params)
    console.log(`[TIMING] query_unified_items: ${(performance.now()-t0).toFixed(0)}ms, rows: ${data?.length ?? 0}`)
    
    if (queryError) throw queryError
    return { data: data || [] }
  }
  
  // Fetch count separately (runs after data is displayed)
  const fetchUnifiedItemsCount = async (
    search = '',
    showTasks = true,
    showEmails = true,
    showCraft = true,
    showFiles = true,
    filterConfig: FilterConfiguration | null = null,
    selectedTaskTypes: string[] | null = null
  ): Promise<number> => {
    // Check if any type is selected
    const hasTypes = showTasks || showEmails || showCraft || showFiles || 
      (selectedTaskTypes && selectedTaskTypes.length > 0)
    if (!hasTypes) return 0
    
    const params = buildUnifiedItemsParams(
      filterConfig, search, showTasks, showEmails, showCraft, showFiles,
      selectedTaskTypes, { field: 'sort_date', order: 'desc' }, 0
    )
    
    // Remove pagination/sort params - count doesn't need them
    const { p_sort_field, p_sort_order, p_limit, p_offset, ...countParams } = params
    
    const t0 = performance.now()
    const { data, error: queryError } = await supabase.rpc('count_unified_items', countParams)
    console.log(`[TIMING] count_unified_items: ${(performance.now()-t0).toFixed(0)}ms, count: ${data}`)
    
    if (queryError) throw queryError
    return data ?? 0
  }

  // Fetch projects from project_overview view
  const fetchProjects = async (
    page = 0,
    search = '',
    _includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null
  ) => {
    const sort = sortConfig || { field: 'name', order: 'asc' }
    const col = filterConfig?.columnFilters || {}
    
    let query = supabase
      .from('project_overview')
      .select('*')
      .order(sort.field, { ascending: sort.order === 'asc' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,company_name.ilike.%${search}%,client_name.ilike.%${search}%`)
    }
    if (col.name_contains) query = query.ilike('name', `%${col.name_contains}%`)
    if (col.status_in?.length) query = query.in('status', col.status_in)
    if (col.status_not_in?.length) {
      col.status_not_in.forEach(s => { query = query.neq('status', s) })
    }

    const { data, error: queryError } = await query
    if (queryError) throw queryError
    return { data: data || [] }
  }

  // Fetch people using RPC function
  const fetchPeople = async (
    page = 0,
    search = '',
    _includeCount = false,
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
    return { data: data || [] }
  }

  // Data items are now directly from the view
  const dataItems = computed<ViewDataItem[]>(() => items.value)

  // Load initial data - uses stale-while-revalidate: shows cache immediately, fetches fresh in background
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
    
    currentPage.value = 0
    hasMore.value = true
    currentViewType.value = viewType
    error.value = null

    // Update current sort if provided
    if (sortConfig) {
      currentSort.value = sortConfig
    }
    
    // Build cache key for this query
    const cacheKey = buildCacheKey(
      viewType, showTasks, showEmails, showCraft, showFiles,
      search, filterConfig, currentSort.value, selectedTaskTypes
    )
    
    // Check cache first
    const cached = getCachedQuery<ViewDataItem[]>(cacheKey)
    if (cached) {
      // Show cached data immediately
      items.value = cached.data
      totalCount.value = cached.count
      cacheTimestamp.value = cached.timestamp
      hasMore.value = cached.data.length === PAGE_SIZE
      loading.value = false
      countLoading.value = false
      revalidating.value = true // Indicate we're refreshing in background
      console.log(`[CACHE] Hit for query, showing ${cached.data.length} items from ${formatCacheAge(cached.timestamp)}`)
    } else {
      // No cache - show loading state
      items.value = []
      totalCount.value = null
      cacheTimestamp.value = null
      loading.value = true
      countLoading.value = true
      revalidating.value = false
    }

    // Always fetch fresh data
    try {
      let result: { data: any[]; count?: number | null }
      
      switch (viewType) {
        case 'projects':
          result = await fetchProjects(0, search, false, filterConfig, currentSort.value)
          break
        case 'people':
          result = await fetchPeople(0, search, false, filterConfig, currentSort.value)
          break
        case 'items':
        default:
          result = await fetchUnifiedItems(0, search, showTasks, showEmails, showCraft, showFiles, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      // Only update state if this is still the current request
      if (thisRequestVersion !== requestVersion) {
        console.log('[TIMING] Request superseded, skipping state update')
        return
      }
      
      const stateStart = performance.now()
      items.value = result.data
      hasMore.value = result.data.length === PAGE_SIZE
      cacheTimestamp.value = Date.now() // Fresh data
      loading.value = false
      revalidating.value = false
      console.log(`[TIMING] State update: ${(performance.now() - stateStart).toFixed(0)}ms`)
      
      // Fetch count in background (after data is displayed)
      try {
        let count: number
        switch (viewType) {
          case 'projects':
            count = await fetchProjectsCount(search, filterConfig)
            break
          case 'people':
            count = await fetchPeopleCount(search, filterConfig)
            break
          case 'items':
          default:
            count = await fetchUnifiedItemsCount(search, showTasks, showEmails, showCraft, showFiles, filterConfig, selectedTaskTypes)
            break
        }
        
        if (thisRequestVersion === requestVersion) {
          totalCount.value = count
          // Update cache with fresh data and count
          setCachedQuery(cacheKey, result.data, count)
        }
      } catch (countErr) {
        console.error('Error loading count:', countErr)
        // Still cache data even if count fails
        if (thisRequestVersion === requestVersion) {
          setCachedQuery(cacheKey, result.data, null)
        }
      } finally {
        if (thisRequestVersion === requestVersion) {
          countLoading.value = false
        }
      }
    } catch (err) {
      // Only update error if this is still the current request
      if (thisRequestVersion === requestVersion) {
        console.error('Error loading data:', err)
        // If we had cached data, keep showing it but indicate error
        if (items.value.length === 0) {
          error.value = err instanceof Error ? err.message : 'Failed to load data. Please try again.'
        }
        loading.value = false
        countLoading.value = false
        revalidating.value = false
      }
    }
  }
  
  // Fetch project count
  const fetchProjectsCount = async (search = '', filterConfig: FilterConfiguration | null = null): Promise<number> => {
    const col = filterConfig?.columnFilters || {}
    
    let query = supabase
      .from('project_overview')
      .select('*', { count: 'exact', head: true })
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,company_name.ilike.%${search}%,client_name.ilike.%${search}%`)
    }
    if (col.name_contains) query = query.ilike('name', `%${col.name_contains}%`)
    if (col.status_in?.length) query = query.in('status', col.status_in)
    if (col.status_not_in?.length) {
      col.status_not_in.forEach(s => { query = query.neq('status', s) })
    }
    
    const { count, error: queryError } = await query
    if (queryError) throw queryError
    return count ?? 0
  }
  
  // Fetch people count
  const fetchPeopleCount = async (search = '', filterConfig: FilterConfiguration | null = null): Promise<number> => {
    const quick = filterConfig?.quickFilters || {}
    const { data, error: queryError } = await supabase.rpc('count_unified_persons', {
      p_text_search: search || null,
      p_project_search: quick.project || null,
      p_is_internal: null,
      p_is_company: null,
    })
    if (queryError) throw queryError
    return data ?? 0
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
      let result: { data: any[] }
      
      switch (viewType) {
        case 'projects':
          result = await fetchProjects(currentPage.value, search, false, filterConfig, currentSort.value)
          break
        case 'people':
          result = await fetchPeople(currentPage.value, search, false, filterConfig, currentSort.value)
          break
        case 'items':
        default:
          result = await fetchUnifiedItems(currentPage.value, search, showTasks, showEmails, showCraft, showFiles, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      // Only update state if no new loadData has started (version unchanged)
      if (thisRequestVersion !== requestVersion) return
      
      // Create new array for shallowRef reactivity (can't use push with shallowRef)
      items.value = [...items.value, ...result.data]
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
    countLoading.value = true
    revalidating.value = false
    cacheTimestamp.value = null
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
    countLoading,
    revalidating,
    cacheAge,
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
