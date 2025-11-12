import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Task, Email, DataItem, FilterConfiguration } from '@/types'

const PAGE_SIZE = 50

export function useData() {
  const tasks = ref<Task[]>([])
  const emails = ref<Email[]>([])
  const loading = ref(false)
  const hasMore = ref(true)
  const currentPage = ref(0)
  const searchQuery = ref('')

  // Fetch tasks from database with relations
  const fetchTasks = async (page = 0, search = '') => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          project:tw_projects(id, name, company_id, tw_companies(id, name)),
          tasklist:tw_tasklists(id, name),
          assignees:task_assignees(tw_users(id, first_name, last_name, email)),
          tags:task_tags(tw_tags(id, name, color))
        `)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Apply search if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching tasks:', error)
      return []
    }
  }

  // Fetch emails from database with relations
  const fetchEmails = async (page = 0, search = '') => {
    try {
      let query = supabase
        .from('m_messages')
        .select(`
          *,
          conversation:m_conversations(id, subject, team_id),
          from_contact:m_contacts!m_messages_from_contact_id_fkey(id, name, email),
          recipients:m_message_recipients(id, recipient_type, contact:m_contacts(id, name, email)),
          attachments:m_attachments(id, filename, extension, size)
        `)
        .order('delivered_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Apply search if provided
      if (search) {
        query = query.or(`subject.ilike.%${search}%,body.ilike.%${search}%,preview.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching emails:', error)
      return []
    }
  }

  // Transform database records to unified DataItem format
  const transformTaskToDataItem = (task: Task): DataItem => {
    return {
      id: task.task_id,
      type: 'task',
      name: task.name || 'Untitled Task',
      description: task.description || '',
      status: task.status || '',
      project: task.project?.name || '',
      customer: task.project?.company?.name || '',
      building: '', // TODO: Add when available in schema
      floor: '', // TODO: Add when available in schema
      room: '', // TODO: Add when available in schema
      kostengruppe: '', // TODO: Add when available in schema
      due_date: task.due_date || '',
      created_at: task.created_at || '',
      updated_at: task.updated_at || '',
      priority: task.priority || '',
      progress: task.progress,
      tasklist: task.tasklist?.name || '',
      assignees: task.assignees?.map((a: any) => a.tw_users).filter(Boolean) || [],
      tags: task.tags?.map((t: any) => t.tw_tags).filter(Boolean) || [],
      _raw: task
    }
  }

  const transformEmailToDataItem = (email: Email): DataItem => {
    return {
      id: email.id,
      type: 'email',
      name: email.subject || 'No Subject',
      description: email.preview || email.body || '',
      status: '', // Emails don't have status
      project: '', // TODO: Link emails to projects if available
      customer: '', // TODO: Link emails to customers if available
      building: '',
      floor: '',
      room: '',
      kostengruppe: '',
      due_date: '',
      created_at: email.delivered_at || email.created_at || '',
      updated_at: email.updated_at || '',
      from: email.from_contact?.name || email.from_contact?.email || '',
      from_email: email.from_contact?.email || '',
      conversation_subject: email.conversation?.subject || '',
      recipients: email.recipients || [],
      attachments: email.attachments || [],
      attachment_count: email.attachments?.length || 0,
      _raw: email
    }
  }

  // Unified data items
  const dataItems = computed<DataItem[]>(() => {
    const items: DataItem[] = []
    
    items.push(...tasks.value.map(transformTaskToDataItem))
    items.push(...emails.value.map(transformEmailToDataItem))
    
    // Sort by updated_at or created_at
    items.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
      return dateB - dateA
    })
    
    return items
  })

  // Load initial data
  const loadData = async (showTasks = true, showEmails = true, search = '') => {
    loading.value = true
    currentPage.value = 0
    tasks.value = []
    emails.value = []
    hasMore.value = true

    try {
      const promises = []
      if (showTasks) promises.push(fetchTasks(0, search))
      if (showEmails) promises.push(fetchEmails(0, search))

      const results = await Promise.all(promises)
      
      let index = 0
      if (showTasks) {
        tasks.value = results[index] as Task[]
        index++
      }
      if (showEmails) {
        emails.value = results[index] as Email[]
      }

      hasMore.value = (tasks.value.length + emails.value.length) === PAGE_SIZE
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      loading.value = false
    }
  }

  // Load more data (for infinite scroll)
  const loadMore = async (showTasks = true, showEmails = true, search = '') => {
    if (loading.value || !hasMore.value) return

    loading.value = true
    currentPage.value++

    try {
      const promises = []
      if (showTasks) promises.push(fetchTasks(currentPage.value, search))
      if (showEmails) promises.push(fetchEmails(currentPage.value, search))

      const results = await Promise.all(promises)
      
      let index = 0
      if (showTasks) {
        const newTasks = results[index] as Task[]
        tasks.value.push(...newTasks)
        index++
      }
      if (showEmails) {
        const newEmails = results[index] as Email[]
        emails.value.push(...newEmails)
      }

      const newItemsCount = (results[0]?.length || 0) + (results[1]?.length || 0)
      hasMore.value = newItemsCount === PAGE_SIZE
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
        
        switch (filter.operator) {
          case 'eq':
            return itemValue === filter.value
          case 'neq':
            return itemValue !== filter.value
          case 'contains':
            return itemValue && String(itemValue).toLowerCase().includes(filter.value.toLowerCase())
          case 'not_contains':
            return !itemValue || !String(itemValue).toLowerCase().includes(filter.value.toLowerCase())
          case 'is_empty':
            return !itemValue || itemValue === ''
          case 'is_not_empty':
            return itemValue && itemValue !== ''
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
    tasks,
    emails,
    dataItems,
    loading,
    hasMore,
    searchQuery,
    loadData,
    loadMore,
    applyFilters,
    applySearch,
    transformTaskToDataItem,
    transformEmailToDataItem
  }
}

