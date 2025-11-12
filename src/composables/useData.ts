import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { DataItem, FilterConfiguration } from '@/types'

const PAGE_SIZE = 50

export function useData() {
  const items = ref<DataItem[]>([])
  const loading = ref(false)
  const hasMore = ref(true)
  const currentPage = ref(0)
  const searchQuery = ref('')
  const totalCount = ref<number | null>(null)

  // Fetch unified items from the database view
  const fetchUnifiedItems = async (
    page = 0,
    search = '',
    showTasks = true,
    showEmails = true,
    includeCount = false,
    filterConfig: FilterConfiguration | null = null
  ) => {
    try {
      let query = supabase
        .from('unified_items')
        .select('*', { count: includeCount ? 'exact' : undefined })
        .order('sort_date', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Filter by item type
      if (!showTasks && showEmails) {
        query = query.eq('type', 'email')
      } else if (showTasks && !showEmails) {
        query = query.eq('type', 'task')
      }
      // If both are true or both are false, fetch all

      // Apply search if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

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

      const { data, error, count } = await query

      if (error) throw error
      return { data: data || [], count }
    } catch (error) {
      console.error('Error fetching unified items:', error)
      return { data: [], count: null }
    }
  }

  // Data items are now directly from the view
  const dataItems = computed<DataItem[]>(() => items.value)

  // Load initial data
  const loadData = async (showTasks = true, showEmails = true, search = '', filterConfig: FilterConfiguration | null = null) => {
    loading.value = true
    currentPage.value = 0
    items.value = []
    hasMore.value = true

    try {
      // Include count on initial load to show total
      const result = await fetchUnifiedItems(0, search, showTasks, showEmails, true, filterConfig)
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
  const loadMore = async (showTasks = true, showEmails = true, search = '', filterConfig: FilterConfiguration | null = null) => {
    if (loading.value || !hasMore.value) return

    loading.value = true
    currentPage.value++

    try {
      // Don't include count on subsequent loads for better performance
      const result = await fetchUnifiedItems(currentPage.value, search, showTasks, showEmails, false, filterConfig)
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
    loadData,
    loadMore,
    applyFilters,
    applySearch
  }
}

