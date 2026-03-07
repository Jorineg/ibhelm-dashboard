import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'

export type ActivityTier = 'overview' | 'status' | 'activity' | 'changelog'

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

  const eventEntries = ref<EventEntry[]>([])
  const eventHasMore = ref(false)

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

  const fetchActivityLog = async (projectId: number, offset = 0) => {
    const { data, error } = await supabase
      .from('project_activity_log')
      .select('*')
      .eq('tw_project_id', projectId)
      .order('logged_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const entries = data || []
    if (offset === 0) {
      activityEntries.value = entries
    } else {
      activityEntries.value = [...activityEntries.value, ...entries]
    }
    activityHasMore.value = entries.length === PAGE_SIZE
  }

  const fetchEventLog = async (projectId: number, offset = 0) => {
    const { data, error } = await supabase
      .from('project_event_log')
      .select('id, tw_project_id, occurred_at, source_table, source_id, event_type, details, content_diff, db_created_at')
      .eq('tw_project_id', projectId)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const entries = data || []
    if (offset === 0) {
      eventEntries.value = entries
    } else {
      eventEntries.value = [...eventEntries.value, ...entries]
    }
    eventHasMore.value = entries.length === PAGE_SIZE
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
    if (!selectedProjectId.value || !activityHasMore.value) return
    return fetchActivityLog(selectedProjectId.value, activityEntries.value.length)
  }

  const loadMoreEvents = () => {
    if (!selectedProjectId.value || !eventHasMore.value) return
    return fetchEventLog(selectedProjectId.value, eventEntries.value.length)
  }

  watch(selectedProjectId, (newId) => {
    if (newId) {
      loadProjectData(newId)
    } else {
      clearData()
    }
  })

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
    eventEntries,
    eventHasMore,
    fetchProjects,
    loadMoreActivity,
    loadMoreEvents,
  }
}
