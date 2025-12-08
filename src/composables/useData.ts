import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { ViewDataItem, FilterConfiguration, SortConfig, ViewType } from '@/types'

const PAGE_SIZE = 50

// Request versioning to handle race conditions when switching configs
let requestVersion = 0

// Columns needed for list view - excludes conversation_comments_text (used only for search)
const UNIFIED_ITEMS_LIST_COLUMNS = `
  id,
  type,
  name,
  description,
  status,
  project,
  customer,
  location,
  location_path,
  cost_group,
  cost_group_code,
  due_date,
  created_at,
  updated_at,
  priority,
  progress,
  tasklist,
  task_type_id,
  task_type_name,
  task_type_slug,
  task_type_color,
  assignees,
  tags,
  body,
  preview,
  from_name,
  from_email,
  recipients,
  conversation_subject,
  attachment_count,
  craft_url,
  teamwork_url,
  missive_url,
  sort_date
`

export function useData() {
  const items = ref<ViewDataItem[]>([])
  const loading = ref(false)
  const hasMore = ref(true)
  const currentPage = ref(0)
  const searchQuery = ref('')
  const totalCount = ref<number | null>(null)
  const currentSort = ref<SortConfig>({ field: 'sort_date', order: 'desc' })
  const currentViewType = ref<ViewType>('items')

  // Helper to check if any tag in the tags array contains the search string
  const itemMatchesTagFilter = (item: any, tagSearch: string): boolean => {
    if (!item.tags || !Array.isArray(item.tags)) return false
    const searchLower = tagSearch.toLowerCase()
    return item.tags.some((tag: any) => 
      tag.name && String(tag.name).toLowerCase().includes(searchLower)
    )
  }

  // Helper to apply hierarchical cost group filter (400 -> 400-499, 45 -> 450-459, 456 -> exact)
  const applyCostGroupFilter = (query: any, value: string): any => {
    const trimmed = value.trim()
    const num = parseInt(trimmed, 10)
    if (isNaN(num)) return query
    
    if (num >= 100 && num <= 999) {
      // Full 3-digit code - exact match
      return query.eq('cost_group_code', String(num))
    } else if (num >= 10 && num <= 99) {
      // 2-digit code - match range (45 -> 450-459)
      return query.gte('cost_group_code', String(num * 10)).lte('cost_group_code', String(num * 10 + 9))
    } else if (num >= 1 && num <= 9) {
      // 1-digit code - match range (4 -> 400-499)
      return query.gte('cost_group_code', String(num * 100)).lte('cost_group_code', String(num * 100 + 99))
    }
    return query
  }

  // Helper to apply dynamic filters to a query
  const applyDynamicFiltersToQuery = (query: any, filterConfig: FilterConfiguration | null) => {
    // Apply always-visible filters at database level
    if (filterConfig?.alwaysVisibleFilters) {
      Object.entries(filterConfig.alwaysVisibleFilters).forEach(([key, value]) => {
        if (value) {
          // Special handling for kostengruppe (hierarchical cost group filter)
          if (key === 'kostengruppe') {
            query = applyCostGroupFilter(query, value)
          // Skip tags filter - handled client-side (JSONB array filtering not supported in supabase-js)
          } else if (key === 'tags') {
            // Tags are filtered client-side after the query
          } else {
            query = query.ilike(key, `%${value}%`)
          }
        }
      })
    }

    // Apply dynamic filters at database level
    if (filterConfig?.dynamicFilters) {
      filterConfig.dynamicFilters.forEach(filter => {
        if (!filter.column || !filter.operator) return

        switch (filter.operator) {
          case 'eq':
            query = query.eq(filter.column, filter.value)
            break
          case 'neq':
            query = query.neq(filter.column, filter.value)
            break
          case 'contains':
            query = query.ilike(filter.column, `%${filter.value}%`)
            break
          case 'not_contains':
            query = query.not(filter.column, 'ilike', `%${filter.value}%`)
            break
          case 'is_empty':
            query = query.or(`${filter.column}.is.null,${filter.column}.eq.`)
            break
          case 'is_not_empty':
            query = query.not(filter.column, 'is', null).neq(filter.column, '')
            break
          case 'before':
            if (filter.value) {
              query = query.lt(filter.column, filter.value)
            }
            break
          case 'after':
            if (filter.value) {
              query = query.gt(filter.column, filter.value)
            }
            break
        }
      })
    }
    return query
  }

  // Fetch unified items using the involved_person RPC function when that filter is set
  const fetchUnifiedItemsWithInvolvedPerson = async (
    page = 0,
    search = '',
    showTasks = true,
    showEmails = true,
    showCraft = true,
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    selectedTaskTypes: string[] | null = null
  ) => {
    try {
      const sort = sortConfig || currentSort.value
      const involvedPersonSearch = filterConfig?.alwaysVisibleFilters?.involved_person || ''
      
      // Determine effective task type filter
      // null = show all tasks, empty array = show no tasks, array with values = show only those
      const taskTypeFilter = selectedTaskTypes && selectedTaskTypes.length === 0 
        ? [] // User deselected all - will set showTasks to false
        : selectedTaskTypes
      
      const effectiveShowTasks = showTasks && !(selectedTaskTypes && selectedTaskTypes.length === 0)
      
      // Call the RPC function - now handles all filtering server-side
      const { data, error } = await supabase.rpc('get_unified_items_by_involved_person', {
        p_involved_person_search: involvedPersonSearch,
        p_show_tasks: effectiveShowTasks,
        p_show_emails: showEmails,
        p_show_craft: showCraft,
        p_text_search: search || null,
        p_sort_field: sort.field,
        p_sort_order: sort.order,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_selected_task_types: taskTypeFilter && taskTypeFilter.length > 0 ? taskTypeFilter : null
      })

      if (error) throw error

      let filteredData = data || []

      // Apply other always-visible filters client-side (except involved_person which is handled by RPC)
      if (filterConfig?.alwaysVisibleFilters) {
        Object.entries(filterConfig.alwaysVisibleFilters).forEach(([key, value]) => {
          if (value && key !== 'involved_person') {
            // Special handling for kostengruppe (hierarchical cost group filter)
            if (key === 'kostengruppe') {
              const trimmed = value.trim()
              const searchNum = parseInt(trimmed, 10)
              if (!isNaN(searchNum)) {
                filteredData = filteredData.filter((item: any) => {
                  const code = parseInt(item.cost_group_code, 10)
                  if (isNaN(code)) return false
                  if (searchNum >= 100 && searchNum <= 999) {
                    return code === searchNum
                  } else if (searchNum >= 10 && searchNum <= 99) {
                    return code >= searchNum * 10 && code <= searchNum * 10 + 9
                  } else if (searchNum >= 1 && searchNum <= 9) {
                    return code >= searchNum * 100 && code <= searchNum * 100 + 99
                  }
                  return false
                })
              }
            // Special handling for tags (JSONB array filter)
            } else if (key === 'tags') {
              filteredData = filteredData.filter((item: any) => itemMatchesTagFilter(item, value))
            } else {
              filteredData = filteredData.filter((item: any) => {
                const itemValue = item[key]
                if (!itemValue) return false
                return String(itemValue).toLowerCase().includes(String(value).toLowerCase())
              })
            }
          }
        })
      }

      // Get count if needed
      let count: number | null = null
      if (includeCount) {
        const { data: countResult, error: countError } = await supabase.rpc('count_unified_items_by_involved_person', {
          p_involved_person_search: involvedPersonSearch,
          p_show_tasks: effectiveShowTasks,
          p_show_emails: showEmails,
          p_show_craft: showCraft,
          p_text_search: search || null,
          p_selected_task_types: taskTypeFilter && taskTypeFilter.length > 0 ? taskTypeFilter : null
        })
        if (!countError) {
          count = countResult
        }
      }

      return { data: filteredData, count }
    } catch (error) {
      console.error('Error fetching unified items with involved person:', error)
      return { data: [], count: null }
    }
  }

  // Fetch unified items from the database view (original method, used when no involved_person filter)
  const fetchUnifiedItems = async (
    page = 0,
    search = '',
    showTasks = true,
    showEmails = true,
    showCraft = true,
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    selectedTaskTypes: string[] | null = null
  ) => {
    // Check if involved_person filter is set - if so, use the RPC function
    const involvedPersonSearch = filterConfig?.alwaysVisibleFilters?.involved_person
    if (involvedPersonSearch) {
      return fetchUnifiedItemsWithInvolvedPerson(
        page, search, showTasks, showEmails, showCraft, includeCount, filterConfig, sortConfig, selectedTaskTypes
      )
    }

    try {
      const sort = sortConfig || currentSort.value
      
      // Use selected columns instead of * for better performance
      // This avoids fetching large text fields like body, conversation_comments_text
      let query = supabase
        .from('unified_items')
        .select(UNIFIED_ITEMS_LIST_COLUMNS, { count: includeCount ? 'exact' : undefined })
        .order(sort.field, { ascending: sort.order === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Build type filters based on showEmails, showCraft and selectedTaskTypes
      const typeFilters: string[] = []
      
      if (showEmails) {
        typeFilters.push('type.eq.email')
      }
      
      if (showCraft) {
        typeFilters.push('type.eq.craft')
      }
      
      // For tasks, filter by selected task types
      if (selectedTaskTypes && selectedTaskTypes.length > 0) {
        // Filter tasks by task_type_id
        typeFilters.push(`and(type.eq.task,task_type_id.in.(${selectedTaskTypes.join(',')}))`)
      } else if (showTasks && selectedTaskTypes == null) {
        // Legacy behavior: only if selectedTaskTypes is not provided (null/undefined)
        // If selectedTaskTypes is an empty array, user explicitly deselected all - show no tasks
        typeFilters.push('type.eq.task')
      }
      
      // Apply combined type filter
      if (typeFilters.length > 0) {
        query = query.or(typeFilters.join(','))
      } else {
        // Neither emails, craft docs, nor tasks selected - return empty
        return { data: [], count: 0 }
      }

      // Apply search if provided (searches name, description, body, preview, and conversation comments)
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,body.ilike.%${search}%,preview.ilike.%${search}%,conversation_comments_text.ilike.%${search}%`)
      }

      query = applyDynamicFiltersToQuery(query, filterConfig)

      const { data, error, count } = await query

      if (error) throw error
      
      // Apply client-side tags filter (JSONB array filtering not supported in supabase-js)
      let filteredData = data || []
      const tagsFilter = filterConfig?.alwaysVisibleFilters?.tags
      if (tagsFilter) {
        filteredData = filteredData.filter((item: any) => itemMatchesTagFilter(item, tagsFilter))
      }
      
      return { data: filteredData, count }
    } catch (error) {
      console.error('Error fetching unified items:', error)
      return { data: [], count: null }
    }
  }

  // Fetch projects from project_overview view
  const fetchProjects = async (
    page = 0,
    search = '',
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null
  ) => {
    try {
      const sort = sortConfig || { field: 'name', order: 'asc' }
      let query = supabase
        .from('project_overview')
        .select('*', { count: includeCount ? 'exact' : undefined })
        .order(sort.field, { ascending: sort.order === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Apply search if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,company_name.ilike.%${search}%,client_name.ilike.%${search}%`)
      }

      query = applyDynamicFiltersToQuery(query, filterConfig)

      const { data, error, count } = await query

      if (error) throw error
      return { data: data || [], count }
    } catch (error) {
      console.error('Error fetching projects:', error)
      return { data: [], count: null }
    }
  }

  // Fetch people from unified_person_details view
  const fetchPeople = async (
    page = 0,
    search = '',
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null
  ) => {
    try {
      const sort = sortConfig || { field: 'display_name', order: 'asc' }
      let query = supabase
        .from('unified_person_details')
        .select('*', { count: includeCount ? 'exact' : undefined })
        .order(sort.field, { ascending: sort.order === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Apply search if provided
      if (search) {
        query = query.or(`display_name.ilike.%${search}%,primary_email.ilike.%${search}%,tw_company_name.ilike.%${search}%`)
      }

      query = applyDynamicFiltersToQuery(query, filterConfig)

      const { data, error, count } = await query

      if (error) throw error
      return { data: data || [], count }
    } catch (error) {
      console.error('Error fetching people:', error)
      return { data: [], count: null }
    }
  }

  // Data items are now directly from the view
  const dataItems = computed<ViewDataItem[]>(() => items.value)

  // Load initial data
  const loadData = async (
    showTasks = true,
    showEmails = true,
    showCraft = true,
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
          result = await fetchUnifiedItems(0, search, showTasks, showEmails, showCraft, true, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      // Only update state if this is still the current request
      if (thisRequestVersion !== requestVersion) return
      
      items.value = result.data
      totalCount.value = result.count
      hasMore.value = result.data.length === PAGE_SIZE
    } catch (error) {
      // Only log error if this is still the current request
      if (thisRequestVersion === requestVersion) {
        console.error('Error loading data:', error)
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
          result = await fetchUnifiedItems(currentPage.value, search, showTasks, showEmails, showCraft, false, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      // Only update state if no new loadData has started (version unchanged)
      if (thisRequestVersion !== requestVersion) return
      
      items.value.push(...result.data)
      hasMore.value = result.data.length === PAGE_SIZE
    } catch (error) {
      if (thisRequestVersion === requestVersion) {
        console.error('Error loading more data:', error)
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
        query = applyDynamicFiltersToQuery(query, filterConfig)
        const { data } = await query
        return data || []
      }
      case 'people': {
        let query = supabase
          .from('unified_person_details')
          .select('*')
          .order(sort.field, { ascending: sort.order === 'asc' })
        if (search) {
          query = query.or(`display_name.ilike.%${search}%,primary_email.ilike.%${search}%,tw_company_name.ilike.%${search}%`)
        }
        query = applyDynamicFiltersToQuery(query, filterConfig)
        const { data } = await query
        return data || []
      }
      default: {
        // Items view - need to handle involved_person filter
        const involvedPersonSearch = filterConfig?.alwaysVisibleFilters?.involved_person
        if (involvedPersonSearch) {
          // Use RPC for involved person - fetch in batches since RPC has limit
          const allData: ViewDataItem[] = []
          let page = 0
          const effectiveShowTasks = showTasks && !(selectedTaskTypes && selectedTaskTypes.length === 0)
          const taskTypeFilter = selectedTaskTypes && selectedTaskTypes.length > 0 ? selectedTaskTypes : null
          
          while (true) {
            const { data } = await supabase.rpc('get_unified_items_by_involved_person', {
              p_involved_person_search: involvedPersonSearch,
              p_show_tasks: effectiveShowTasks,
              p_show_emails: showEmails,
              p_show_craft: showCraft,
              p_text_search: search || null,
              p_sort_field: sort.field,
              p_sort_order: sort.order,
              p_limit: 1000,
              p_offset: page * 1000,
              p_selected_task_types: taskTypeFilter
            })
            if (!data || data.length === 0) break
            allData.push(...data)
            if (data.length < 1000) break
            page++
          }
          return allData
        }
        
        // Standard unified_items query
        let query = supabase
          .from('unified_items')
          .select('*')
          .order(sort.field, { ascending: sort.order === 'asc' })
        
        const typeFilters: string[] = []
        if (showEmails) typeFilters.push('type.eq.email')
        if (showCraft) typeFilters.push('type.eq.craft')
        if (selectedTaskTypes && selectedTaskTypes.length > 0) {
          typeFilters.push(`and(type.eq.task,task_type_id.in.(${selectedTaskTypes.join(',')}))`)
        } else if (showTasks && selectedTaskTypes == null) {
          typeFilters.push('type.eq.task')
        }
        
        if (typeFilters.length === 0) return []
        query = query.or(typeFilters.join(','))
        
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,body.ilike.%${search}%,preview.ilike.%${search}%,conversation_comments_text.ilike.%${search}%`)
        }
        
        query = applyDynamicFiltersToQuery(query, filterConfig)
        const { data } = await query
        
        // Apply client-side tags filter
        let filteredData = data || []
        const tagsFilter = filterConfig?.alwaysVisibleFilters?.tags
        if (tagsFilter) {
          filteredData = filteredData.filter((item: any) => itemMatchesTagFilter(item, tagsFilter))
        }
        
        return filteredData
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
  }

  return {
    dataItems,
    loading,
    hasMore,
    searchQuery,
    totalCount,
    currentSort,
    currentViewType,
    loadData,
    loadMore,
    fetchAllForExport,
    clearAndStartLoading
  }
}

