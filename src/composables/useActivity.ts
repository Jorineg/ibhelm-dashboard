import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'

export type ActivityTier = 'overview' | 'status' | 'activity' | 'changelog'

export type SourceFilterKey = 'task' | 'email' | 'craft' | 'file' | 'profile'

export const SOURCE_FILTER_TABLES: Record<SourceFilterKey, string[]> = {
  task: ['teamwork.tasks', 'teamwork.task_assignees', 'teamwork.task_tags'],
  email: ['project_conversations'],
  craft: ['project_craft_documents', 'craft_documents'],
  file: ['files'],
  profile: ['project_extensions'],
}

export interface ActiveProject {
  id: number
  name: string
  company_name: string | null
}

export interface ActivityEntry {
  id: string
  tw_project_id: number
  logged_at: string
  category: string
  summary: string
  kgr_codes: string[] | null
  involved_persons: string[] | null
  generated_at: string
}

export interface EventEntry {
  id: number
  tw_project_id: number
  occurred_at: string
  source_table: string
  source_id: string
  event_type: string
  details: Record<string, any>
  content_diff: string | null
  db_created_at: string
}

const PAGE_SIZE = 50

export function useActivity() {
  const projects = ref<ActiveProject[]>([])
  const selectedProjectId = ref<number | null>(null)
  const selectedTier = ref<ActivityTier>('overview')
  const projectsLoading = ref(false)
  const contentLoading = ref(false)

  const profileMarkdown = ref<string | null>(null)
  const profileGeneratedAt = ref<string | null>(null)
  const statusMarkdown = ref<string | null>(null)
  const statusGeneratedAt = ref<string | null>(null)

  const activityEntries = ref<ActivityEntry[]>([])
  const activityHasMore = ref(false)
  const activityLoading = ref(false)

  const eventEntries = ref<EventEntry[]>([])
  const eventHasMore = ref(false)
  const eventLoading = ref(false)

  const activeSourceFilters = ref<Set<SourceFilterKey>>(new Set())
  const activeCategoryFilters = ref<Set<string>>(new Set())
  const activitySearch = ref('')
  const eventSearch = ref('')

  const fetchProjects = async (excludeProjectIds: number[] = [], excludeCompanyNames: string[] = []) => {
    projectsLoading.value = true
    try {
      const { data, error } = await supabase
        .from('project_overview')
        .select('id, name, company_name')
        .eq('status', 'active')
        .order('name')
      if (error) throw error

      const excludeIds = new Set(excludeProjectIds)
      const excludeNames = new Set(excludeCompanyNames)
      projects.value = (data || []).filter(p =>
        !excludeIds.has(p.id) &&
        (!p.company_name || !excludeNames.has(p.company_name))
      )

      if (projects.value.length && !selectedProjectId.value) {
        selectedProjectId.value = projects.value[0].id
      }
    } finally {
      projectsLoading.value = false
    }
  }

  const fetchExtensions = async (projectId: number) => {
    const { data, error } = await supabase
      .from('project_extensions')
      .select('profile_markdown, profile_generated_at, status_markdown, status_generated_at')
      .eq('tw_project_id', projectId)
      .maybeSingle()
    if (error) throw error
    profileMarkdown.value = data?.profile_markdown ?? null
    profileGeneratedAt.value = data?.profile_generated_at ?? null
    statusMarkdown.value = data?.status_markdown ?? null
    statusGeneratedAt.value = data?.status_generated_at ?? null
  }

  const getFilteredSourceTables = (): string[] | null => {
    if (activeSourceFilters.value.size === 0) return null
    const tables: string[] = []
    for (const key of activeSourceFilters.value) {
      tables.push(...SOURCE_FILTER_TABLES[key])
    }
    return tables
  }

  const fetchActivityLog = async (projectId: number, offset = 0) => {
    activityLoading.value = true
    try {
      const categories = activeCategoryFilters.value.size > 0 ? [...activeCategoryFilters.value] : null
      const search = activitySearch.value.trim() || null

      const { data, error } = await supabase.rpc('search_activity_log', {
        p_project_id: projectId,
        p_search: search,
        p_categories: categories,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      })
      if (error) throw error
      const entries = data || []
      if (offset === 0) {
        activityEntries.value = entries
      } else {
        activityEntries.value = [...activityEntries.value, ...entries]
      }
      activityHasMore.value = entries.length === PAGE_SIZE
    } finally {
      activityLoading.value = false
    }
  }

  const fetchEventLog = async (projectId: number, offset = 0) => {
    eventLoading.value = true
    try {
      const tables = getFilteredSourceTables()
      const search = eventSearch.value.trim() || null

      const { data, error } = await supabase.rpc('search_event_log', {
        p_project_id: projectId,
        p_search: search,
        p_source_tables: tables,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      })
      if (error) throw error
      const entries = data || []
      if (offset === 0) {
        eventEntries.value = entries
      } else {
        eventEntries.value = [...eventEntries.value, ...entries]
      }
      eventHasMore.value = entries.length === PAGE_SIZE
    } finally {
      eventLoading.value = false
    }
  }

  const loadProjectData = async (projectId: number) => {
    contentLoading.value = true
    try {
      await Promise.all([
        fetchExtensions(projectId),
        fetchActivityLog(projectId),
        fetchEventLog(projectId),
      ])
    } finally {
      contentLoading.value = false
    }
  }

  const clearData = () => {
    profileMarkdown.value = null
    profileGeneratedAt.value = null
    statusMarkdown.value = null
    statusGeneratedAt.value = null
    activityEntries.value = []
    activityHasMore.value = false
    eventEntries.value = []
    eventHasMore.value = false
  }

  const loadMoreActivity = () => {
    if (!selectedProjectId.value || !activityHasMore.value || activityLoading.value) return
    return fetchActivityLog(selectedProjectId.value, activityEntries.value.length)
  }

  const loadMoreEvents = () => {
    if (!selectedProjectId.value || !eventHasMore.value || eventLoading.value) return
    return fetchEventLog(selectedProjectId.value, eventEntries.value.length)
  }

  const reloadEvents = () => {
    if (!selectedProjectId.value) return
    return fetchEventLog(selectedProjectId.value, 0)
  }

  const reloadActivity = () => {
    if (!selectedProjectId.value) return
    return fetchActivityLog(selectedProjectId.value, 0)
  }

  watch(selectedProjectId, (newId) => {
    if (newId) {
      loadProjectData(newId)
    } else {
      clearData()
    }
  })

  watch(activeSourceFilters, () => reloadEvents(), { deep: true })
  watch(activeCategoryFilters, () => reloadActivity(), { deep: true })
  watch(activitySearch, () => reloadActivity())
  watch(eventSearch, () => reloadEvents())

  return {
    projects,
    selectedProjectId,
    selectedTier,
    projectsLoading,
    contentLoading,
    profileMarkdown,
    profileGeneratedAt,
    statusMarkdown,
    statusGeneratedAt,
    activityEntries,
    activityHasMore,
    activityLoading,
    eventEntries,
    eventHasMore,
    eventLoading,
    activeSourceFilters,
    activeCategoryFilters,
    activitySearch,
    eventSearch,
    fetchProjects,
    loadMoreActivity,
    loadMoreEvents,
  }
}
