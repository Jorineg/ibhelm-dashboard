import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { DataItem, ProjectItem, PersonItem, ViewDataItem, FilterConfiguration, SortConfig, ViewType } from '@/types'

const PAGE_SIZE = 50

// Columns needed for list view - excludes large text fields like body, conversation_comments_text
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
  preview,
  from_name,
  from_email,
  conversation_subject,
  attachment_count,
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

  // Helper to apply dynamic filters to a query
  const applyDynamicFiltersToQuery = (query: any, filterConfig: FilterConfiguration | null) => {
    // Apply always-visible filters at database level
    if (filterConfig?.alwaysVisibleFilters) {
      Object.entries(filterConfig.alwaysVisibleFilters).forEach(([key, value]) => {
        if (value) {
          query = query.ilike(key, `%${value}%`)
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
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    selectedTaskTypes: string[] | null = null
  ) => {
    try {
      const sort = sortConfig || currentSort.value
      const involvedPersonSearch = filterConfig?.alwaysVisibleFilters?.involved_person || ''
      
      // Call the RPC function for involved person search
      const { data, error } = await supabase.rpc('get_unified_items_by_involved_person', {
        p_search_text: involvedPersonSearch,
        p_show_tasks: showTasks,
        p_show_emails: showEmails,
        p_text_search: search || null,
        p_sort_field: sort.field,
        p_sort_order: sort.order,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE
      })

      if (error) throw error

      let filteredData = data || []

      // Apply task type filtering client-side (RPC doesn't handle this)
      if (selectedTaskTypes && selectedTaskTypes.length > 0) {
        filteredData = filteredData.filter((item: any) => {
          if (item.type === 'email') return showEmails
          if (item.type === 'task') {
            return item.task_type_id && selectedTaskTypes.includes(item.task_type_id)
          }
          return true
        })
      } else if (selectedTaskTypes && selectedTaskTypes.length === 0) {
        // Empty array = user deselected all task types - filter out all tasks
        filteredData = filteredData.filter((item: any) => item.type !== 'task')
      }

      // Apply other always-visible filters (except involved_person which is handled by RPC)
      if (filterConfig?.alwaysVisibleFilters) {
        Object.entries(filterConfig.alwaysVisibleFilters).forEach(([key, value]) => {
          if (value && key !== 'involved_person') {
            filteredData = filteredData.filter((item: any) => {
              const itemValue = item[key]
              if (!itemValue) return false
              return String(itemValue).toLowerCase().includes(String(value).toLowerCase())
            })
          }
        })
      }

      // Get count if needed
      let count: number | null = null
      if (includeCount) {
        const { data: countResult, error: countError } = await supabase.rpc('count_unified_items_by_involved_person', {
          p_search_text: involvedPersonSearch,
          p_show_tasks: showTasks,
          p_show_emails: showEmails,
          p_text_search: search || null
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
    includeCount = false,
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    selectedTaskTypes: string[] | null = null
  ) => {
    // Check if involved_person filter is set - if so, use the RPC function
    const involvedPersonSearch = filterConfig?.alwaysVisibleFilters?.involved_person
    if (involvedPersonSearch) {
      return fetchUnifiedItemsWithInvolvedPerson(
        page, search, showTasks, showEmails, includeCount, filterConfig, sortConfig, selectedTaskTypes
      )
    }

    try {
      const sort = sortConfig || currentSort.value
      
      // Use selected columns instead of * for better performance
      // This avoids fetching large text fields like body, conversation_comments_text
      let query = supabase
        .from('unified_items')
        .select(UNIFIED_ITEMS_LIST_COLUMNS, { count: includeCount ? 'estimated' : undefined })
        .order(sort.field, { ascending: sort.order === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Build type filters based on showEmails and selectedTaskTypes
      const typeFilters: string[] = []
      
      if (showEmails) {
        typeFilters.push('type.eq.email')
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
        // Neither emails nor tasks selected - return empty
        return { data: [], count: 0 }
      }

      // Apply search if provided (searches name, description, preview only for performance)
      // Full-text search in body moved to detail view
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,preview.ilike.%${search}%`)
      }

      query = applyDynamicFiltersToQuery(query, filterConfig)

      const { data, error, count } = await query

      if (error) throw error
      return { data: data || [], count }
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
    search = '',
    filterConfig: FilterConfiguration | null = null,
    sortConfig: SortConfig | null = null,
    viewType: ViewType = 'items',
    selectedTaskTypes: string[] | null = null
  ) => {
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
          result = await fetchUnifiedItems(0, search, showTasks, showEmails, true, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      items.value = result.data
      totalCount.value = result.count
      hasMore.value = result.data.length === PAGE_SIZE
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      loading.value = false
    }
  }

  // Load more data (for infinite scroll)
  const loadMore = async (
    showTasks = true,
    showEmails = true,
    search = '',
    filterConfig: FilterConfiguration | null = null,
    viewType: ViewType = 'items',
    selectedTaskTypes: string[] | null = null
  ) => {
    if (loading.value || !hasMore.value) return

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
          result = await fetchUnifiedItems(currentPage.value, search, showTasks, showEmails, false, filterConfig, currentSort.value, selectedTaskTypes)
          break
      }
      
      items.value.push(...result.data)
      hasMore.value = result.data.length === PAGE_SIZE
    } catch (error) {
      console.error('Error loading more data:', error)
    } finally {
      loading.value = false
    }
  }

  // Apply filters to data items
  const applyFilters = (items: DataItem[], config: FilterConfiguration | null): DataItem[] => {
    if (!config) return items

    let filtered = items

    // Filter by item type
    filtered = filtered.filter(item => {
      if (item.type === 'task' && !config.showTasks) return false
      if (item.type === 'email' && !config.showEmails) return false
      return true
    })

    // Apply always-visible filters
    Object.entries(config.alwaysVisibleFilters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(item => {
          const itemValue = item[key]
          if (!itemValue) return false
          return itemValue.toLowerCase().includes(value.toLowerCase())
        })
      }
    })

    // Apply dynamic filters
    config.dynamicFilters.forEach(filter => {
      filtered = filtered.filter(item => {
        const itemValue = item[filter.column]

        // Helper function to check if value contains search term
        // Handles both strings and arrays (like tags, assignees)
        const containsValue = (value: any, searchTerm: string): boolean => {
          if (!value) return false

          // Handle arrays (tags, assignees, etc.)
          if (Array.isArray(value)) {
            return value.some(arrayItem => {
              if (typeof arrayItem === 'object' && arrayItem !== null) {
                // For objects with 'name' property (tags, users, etc.)
                if (arrayItem.name) {
                  return String(arrayItem.name).toLowerCase().includes(searchTerm.toLowerCase())
                }
                // For objects with 'first_name' and 'last_name' (users)
                if (arrayItem.first_name || arrayItem.last_name) {
                  const fullName = `${arrayItem.first_name || ''} ${arrayItem.last_name || ''}`.trim()
                  return fullName.toLowerCase().includes(searchTerm.toLowerCase())
                }
                // For any other object properties, search through all string values
                return Object.values(arrayItem).some(v =>
                  typeof v === 'string' && v.toLowerCase().includes(searchTerm.toLowerCase())
                )
              }
              // For primitive values in array
              return String(arrayItem).toLowerCase().includes(searchTerm.toLowerCase())
            })
          }

          // Handle regular string values
          return String(value).toLowerCase().includes(searchTerm.toLowerCase())
        }

        switch (filter.operator) {
          case 'eq':
            return itemValue === filter.value
          case 'neq':
            return itemValue !== filter.value
          case 'contains':
            return containsValue(itemValue, filter.value)
          case 'not_contains':
            return !containsValue(itemValue, filter.value)
          case 'is_empty':
            return !itemValue || itemValue === '' || (Array.isArray(itemValue) && itemValue.length === 0)
          case 'is_not_empty':
            return itemValue && itemValue !== '' && (!Array.isArray(itemValue) || itemValue.length > 0)
          case 'before':
            return itemValue && new Date(itemValue) < new Date(filter.value)
          case 'after':
            return itemValue && new Date(itemValue) > new Date(filter.value)
          default:
            return true
        }
      })
    })

    return filtered
  }

  // Apply search to filtered items
  const applySearch = (items: DataItem[], search: string): DataItem[] => {
    if (!search) return items

    const lowerSearch = search.toLowerCase()
    return items.filter(item => {
      // Search across all string fields
      return Object.values(item).some(value => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowerSearch)
        }
        return false
      })
    })
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
    applyFilters,
    applySearch
  }
}

