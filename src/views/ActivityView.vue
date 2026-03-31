<template>
  <div class="activity-view">
    <PageHeader
      title="ibhelm Dashboard"
      :user-email="user?.email"
      :show-sign-out="true"
      @sign-out="handleSignOut"
    >
      <template #after-title>
        <NavigationTabs />
      </template>
      <template #actions>
        <DashboardHeaderActions />
      </template>
    </PageHeader>

    <div class="activity-layout">
      <!-- Project sidebar -->
      <aside class="project-sidebar">
        <div v-if="projectsLoading" class="sidebar-loading">
          <i class="pi pi-spin pi-spinner"></i>
        </div>
        <div v-else class="project-list thin-scrollbar">
          <div
            v-for="p in projects"
            :key="p.id"
            :class="['project-item', { active: p.id === selectedProjectId }]"
            @click="selectedProjectId = p.id"
          >
            <span class="project-name">{{ displayName(p.name) }}</span>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <main class="activity-main">
        <div v-if="!selectedProjectId" class="empty-state">
          <p>Select a project to view activity</p>
        </div>
        <template v-else>
          <!-- Tier selector -->
          <div class="tier-tabs-row">
            <div class="tier-tabs">
              <button
                v-for="t in tiers"
                :key="t.id"
                :class="['tier-tab', { active: selectedTier === t.id }]"
                @click="selectedTier = t.id"
              >
                {{ t.label }}
              </button>
            </div>
            <template v-if="selectedTier === 'activity'">
              <div class="source-filters">
                <button
                  v-for="f in categoryFilterDefs"
                  :key="f.key"
                  class="source-filter-btn"
                  :style="{
                    '--sf-color': f.color,
                    opacity: noCategoryFilters || activeCategoryFilters.has(f.key) ? 1 : 0.3,
                  }"
                  @click="toggleCategoryFilter(f.key)"
                >{{ f.label }}</button>
                <button v-if="!noCategoryFilters" class="source-filter-clear" @click="clearCategoryFilters">
                  <i class="pi pi-times"></i>
                </button>
              </div>
              <div class="tier-search">
                <i class="pi pi-search tier-search-icon"></i>
                <input v-model="activitySearch" type="text" class="tier-search-input" placeholder="Search activity...">
              </div>
            </template>
            <template v-if="selectedTier === 'changelog'">
              <div class="source-filters">
                <button
                  v-for="f in sourceFilterDefs"
                  :key="f.key"
                  class="source-filter-btn"
                  :style="{
                    '--sf-color': f.color(),
                    opacity: noFilters || isFilterActive(f.key) ? 1 : 0.3,
                  }"
                  @click="toggleSourceFilter(f.key)"
                >{{ f.label }}</button>
                <button v-if="!noFilters" class="source-filter-clear" @click="clearSourceFilters">
                  <i class="pi pi-times"></i>
                </button>
              </div>
              <div class="tier-search">
                <i class="pi pi-search tier-search-icon"></i>
                <input v-model="eventSearch" type="text" class="tier-search-input" placeholder="Search events...">
              </div>
            </template>
            <span v-if="generatedAt" class="generated-at">
              Updated {{ formatRelativeTime(generatedAt) }}
            </span>
          </div>

          <!-- Content -->
          <div class="tier-content thin-scrollbar">
            <div class="tier-content-inner">
              <div v-if="contentLoading" class="content-loading">
                <i class="pi pi-spin pi-spinner"></i>
              </div>

              <!-- Tier 1: Overview -->
              <template v-else-if="selectedTier === 'overview'">
                <div v-if="profileMarkdown" class="markdown-content" v-html="renderMarkdown(profileMarkdown)" />
                <div v-else class="empty-tier">No project profile generated yet.</div>
              </template>

              <!-- Tier 2: Status -->
              <template v-else-if="selectedTier === 'status'">
                <div v-if="statusMarkdown" class="markdown-content" v-html="renderMarkdown(statusMarkdown)" />
                <div v-else class="empty-tier">No status snapshot generated yet.</div>
              </template>

              <!-- Tier 3: Activity Timeline -->
              <template v-else-if="selectedTier === 'activity'">
                <div v-if="activityEntries.length" class="timeline">
                  <div v-for="week in groupedByWeek" :key="week.key" class="timeline-week">
                    <div class="week-label-col">
                      <div class="week-label">
                        <span class="week-number">{{ week.label }}</span>
                        <span class="week-range">{{ week.range }}</span>
                      </div>
                    </div>
                    <div class="week-entries">
                      <div v-for="entry in week.entries" :key="entry.id" class="timeline-entry">
                        <div :class="['timeline-dot', `dot-${entry.category}`]"></div>
                        <div class="activity-entry">
                          <div class="entry-header">
                            <span :class="['category-badge', `cat-${entry.category}`]">{{ categoryLabels[entry.category] || entry.category }}</span>
                            <span class="entry-date">{{ formatDate(entry.logged_at) }}</span>
                          </div>
                          <div class="markdown-content entry-summary" v-html="renderMarkdown(entry.summary)" />
                          <div v-if="entry.kgr_codes?.length || entry.involved_persons?.length" class="entry-meta">
                            <span v-for="code in entry.kgr_codes" :key="code" class="meta-tag kgr">{{ code }}</span>
                            <span v-for="person in entry.involved_persons" :key="person" class="meta-tag person">{{ person }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="activityLoading" class="scroll-loading"><i class="pi pi-spin pi-spinner"></i></div>
                  <div v-if="activityHasMore" ref="activitySentinel" class="scroll-sentinel"></div>
                </div>
                <div v-else class="empty-tier">No activity entries yet.</div>
              </template>

              <!-- Tier 4: Change Log -->
              <template v-else-if="selectedTier === 'changelog'">
                <div v-if="eventEntries.length" class="timeline">
                  <div v-for="week in groupedEventsByWeek" :key="week.key" class="timeline-week">
                    <div class="week-label-col">
                      <div class="week-label">
                        <span class="week-number">{{ week.label }}</span>
                        <span class="week-range">{{ week.range }}</span>
                      </div>
                    </div>
                    <div class="week-entries">
                      <div v-for="entry in week.entries" :key="entry.id" class="timeline-entry">
                        <div class="timeline-dot" :style="{ background: getSourceBadgeStyle(entry).color }"></div>
                        <div class="event-entry">
                          <div class="entry-header">
                            <a
                              v-if="getEventUrl(entry)"
                              :href="getEventUrl(entry)!"
                              :target="getEventLinkTarget(entry)"
                              rel="noopener noreferrer"
                              class="source-badge clickable"
                              :style="getSourceBadgeStyle(entry)"
                            >{{ sourceLabels[entry.source_table] || entry.source_table }}</a>
                            <span v-else class="source-badge" :style="getSourceBadgeStyle(entry)">{{ sourceLabels[entry.source_table] || entry.source_table }}</span>
                            <span :class="['event-type-badge', `evt-${entry.event_type}`]">{{ entry.event_type }}</span>
                            <span class="entry-date">{{ formatDate(entry.occurred_at) }}</span>
                          </div>
                          <div class="event-details">
                            <span v-if="nameChange(entry)" class="event-name change-inline-diff" v-html="inlineDiffHtml(String(nameChange(entry)!.old), String(nameChange(entry)!.new))"></span>
                            <span v-else class="event-name">{{ eventTitle(entry) }}</span>
                            <template v-if="entry.event_type === 'changed' && entry.details?.changes">
                              <div v-for="change in entry.details.changes.filter((c: any) => c.field !== 'name')" :key="change.field" class="change-row">
                                <span class="change-field">{{ change.field }}</span>
                                <template v-if="change.diff">
                                  <span class="change-diff-label">diff</span>
                                </template>
                                <template v-else-if="change.field === 'description' && change.old && change.new">
                                  <span class="change-inline-diff" v-html="inlineDiffHtml(String(change.old), String(change.new))"></span>
                                </template>
                                <template v-else>
                                  <span class="change-old">{{ change.old ?? '—' }}</span>
                                  <i class="pi pi-arrow-right change-arrow"></i>
                                  <span class="change-new">{{ change.new ?? '—' }}</span>
                                </template>
                              </div>
                            </template>
                          </div>
                          <div v-if="entry.content_diff" class="diff-block" v-html="renderDiffBlock(entry.content_diff)"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="eventLoading" class="scroll-loading"><i class="pi pi-spin pi-spinner"></i></div>
                  <div v-if="eventHasMore" ref="eventSentinel" class="scroll-sentinel"></div>
                </div>
                <div v-else class="empty-tier">No events logged yet.</div>
              </template>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PageHeader, NavigationTabs, DashboardHeaderActions } from '@/components/common'
import { useAuth } from '@/composables/useAuth'
import { useActivity, type ActivityTier, type EventEntry, type SourceFilterKey } from '@/composables/useActivity'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { useLinkTransform } from '@/composables/useLinkTransform'
import { renderMarkdown } from '@/composables/useMarkdown'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const { user, signOut } = useAuth()
const { excludedCompanyIds, excludedProjectIds, emailColor, craftColor, fileColor, teamworkBaseUrl } = useAppearanceSettings()
const { transformCraftUrl, transformMissiveUrl, openCraftInBrowser, openMissiveInBrowser } = useLinkTransform()
const {
  projects, selectedProjectId, selectedTier,
  projectsLoading, contentLoading,
  profileMarkdown, profileGeneratedAt,
  statusMarkdown, statusGeneratedAt,
  activityEntries, activityHasMore, activityLoading,
  eventEntries, eventHasMore, eventLoading,
  activeSourceFilters, activeCategoryFilters,
  activitySearch, eventSearch,
  fetchProjects, loadMoreActivity, loadMoreEvents,
} = useActivity()

// Infinite scroll
const activitySentinel = ref<HTMLElement | null>(null)
const eventSentinel = ref<HTMLElement | null>(null)
let activityObserver: IntersectionObserver | null = null
let eventObserver: IntersectionObserver | null = null

onMounted(() => {
  activityObserver = new IntersectionObserver(entries => {
    if (entries[0]?.isIntersecting && activityHasMore.value && !activityLoading.value) loadMoreActivity()
  }, { rootMargin: '200px' })
  eventObserver = new IntersectionObserver(entries => {
    if (entries[0]?.isIntersecting && eventHasMore.value && !eventLoading.value) loadMoreEvents()
  }, { rootMargin: '200px' })

  watch(activitySentinel, (el, _, onCleanup) => {
    if (!el) return
    activityObserver!.observe(el)
    onCleanup(() => activityObserver!.unobserve(el))
  }, { immediate: true })

  watch(eventSentinel, (el, _, onCleanup) => {
    if (!el) return
    eventObserver!.observe(el)
    onCleanup(() => eventObserver!.unobserve(el))
  }, { immediate: true })
})

onUnmounted(() => {
  activityObserver?.disconnect()
  eventObserver?.disconnect()
})

// Source type filter
const PROFILE_COLOR = '#a78bfa'

const sourceFilterDefs: { key: SourceFilterKey; label: string; color: () => string }[] = [
  { key: 'task', label: 'Task', color: () => TASK_COLOR },
  { key: 'email', label: 'Email', color: () => emailColor.value },
  { key: 'craft', label: 'Craft', color: () => craftColor.value },
  { key: 'file', label: 'File', color: () => fileColor.value },
  { key: 'profile', label: 'Profile', color: () => PROFILE_COLOR },
]

const isFilterActive = (key: SourceFilterKey) => activeSourceFilters.value.has(key)
const noFilters = computed(() => activeSourceFilters.value.size === 0)

const toggleSourceFilter = (key: SourceFilterKey) => {
  const s = activeSourceFilters.value
  if (s.has(key)) {
    s.delete(key)
  } else {
    s.add(key)
  }
  activeSourceFilters.value = new Set(s)
}

const clearSourceFilters = () => {
  activeSourceFilters.value = new Set()
}

// Category filter (Tier 3)
const CATEGORY_COLORS: Record<string, string> = {
  decision: '#6bb3ff',
  blocker: '#f87171',
  resolution: '#4ade80',
  progress: '#22d3ee',
  milestone: '#fbbf24',
  risk: '#fb923c',
  scope_change: '#c084fc',
  communication: '#9ca3af',
}

const categoryFilterDefs = computed(() =>
  Object.entries(categoryLabels).map(([key, label]) => ({
    key,
    label,
    color: CATEGORY_COLORS[key] ?? '#9ca3af',
  }))
)

const noCategoryFilters = computed(() => activeCategoryFilters.value.size === 0)

const toggleCategoryFilter = (key: string) => {
  const s = activeCategoryFilters.value
  if (s.has(key)) {
    s.delete(key)
  } else {
    s.add(key)
  }
  activeCategoryFilters.value = new Set(s)
}

const clearCategoryFilters = () => {
  activeCategoryFilters.value = new Set()
}

const tiers: { id: ActivityTier; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'status', label: 'Status' },
  { id: 'activity', label: 'Activity' },
  { id: 'changelog', label: 'Change Log' },
]

const categoryLabels: Record<string, string> = {
  decision: 'Decision',
  blocker: 'Blocker',
  resolution: 'Resolution',
  progress: 'Progress',
  milestone: 'Milestone',
  risk: 'Risk',
  scope_change: 'Scope Change',
  communication: 'Communication',
}

const sourceLabels: Record<string, string> = {
  'teamwork.tasks': 'Task',
  'teamwork.task_assignees': 'Task',
  'teamwork.task_tags': 'Task',
  'project_conversations': 'Email',
  'project_craft_documents': 'Craft',
  'craft_documents': 'Craft',
  'files': 'File',
  'project_extensions': 'Profile',
}

const sourceKey = (table: string): string => {
  if (table.includes('task')) return 'task'
  if (table.includes('conversation') || table.includes('message')) return 'email'
  if (table.includes('craft')) return 'craft'
  if (table.includes('file')) return 'file'
  if (table === 'project_extensions') return 'profile'
  return 'other'
}

const TASK_COLOR = '#4ade80'

const sourceColor = (key: string): string =>
  key === 'email' ? emailColor.value
  : key === 'craft' ? craftColor.value
  : key === 'file' ? fileColor.value
  : key === 'profile' ? PROFILE_COLOR
  : TASK_COLOR

const getSourceBadgeStyle = (entry: EventEntry) => {
  const color = sourceColor(sourceKey(entry.source_table))
  return { background: `${color}20`, color, borderColor: `${color}40` }
}

const getEventUrl = (entry: EventEntry): string | null => {
  const key = sourceKey(entry.source_table)
  if (key === 'task' && teamworkBaseUrl.value) {
    return `${teamworkBaseUrl.value.replace(/\/$/, '')}/app/tasks/${entry.source_id}`
  }
  if (key === 'email') {
    return transformMissiveUrl(`missive://mail.missiveapp.com/#/conversations/${entry.source_id}`)
  }
  if (key === 'craft') {
    return transformCraftUrl(`craftdocs://open?blockId=${entry.source_id}`)
  }
  return null
}

const getEventLinkTarget = (entry: EventEntry): string => {
  const key = sourceKey(entry.source_table)
  if (key === 'email') return openMissiveInBrowser.value ? '_blank' : '_self'
  if (key === 'craft') return openCraftInBrowser.value ? '_blank' : '_self'
  return '_blank'
}

const displayName = (name: string) => name.replaceAll('-', ' ')

// Week grouping helpers
const getISOWeek = (d: Date): { week: number; year: number } => {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const jan4 = new Date(date.getFullYear(), 0, 4)
  return {
    week: 1 + Math.round(((date.getTime() - jan4.getTime()) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7),
    year: date.getFullYear()
  }
}

const getWeekMonday = (d: Date): Date => {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return date
}

const shortMonth = (d: Date) =>
  d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')

const formatWeekRange = (d: Date): string => {
  const mon = getWeekMonday(d)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  if (mon.getMonth() === sun.getMonth()) {
    return `${mon.getDate()}. – ${sun.getDate()}. ${shortMonth(mon)}`
  }
  return `${mon.getDate()}. ${shortMonth(mon)} – ${sun.getDate()}. ${shortMonth(sun)}`
}

const groupByWeek = <T>(entries: T[], dateKey: keyof T) => {
  const groups: { key: string; label: string; range: string; entries: T[] }[] = []
  let currentKey = ''
  for (const entry of entries) {
    const d = new Date(entry[dateKey] as string)
    const { week, year } = getISOWeek(d)
    const key = `${year}-W${week}`
    if (key !== currentKey) {
      currentKey = key
      groups.push({ key, label: `KW ${week}`, range: formatWeekRange(d), entries: [] })
    }
    groups[groups.length - 1].entries.push(entry)
  }
  return groups
}

const groupedByWeek = computed(() => groupByWeek(activityEntries.value, 'logged_at'))
const groupedEventsByWeek = computed(() => groupByWeek(eventEntries.value, 'occurred_at'))

const generatedAt = computed(() => {
  if (selectedTier.value === 'overview') return profileGeneratedAt.value
  if (selectedTier.value === 'status') return statusGeneratedAt.value
  return null
})

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

const formatRelativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const eventTitle = (entry: EventEntry): string => {
  const d = entry.details
  const name = d?.name || d?.title || d?.subject || d?.filename || `${entry.source_table}#${entry.source_id}`
  return d?.parent_name ? `${name} (${d.parent_name})` : name
}

const nameChange = (entry: EventEntry) =>
  entry.event_type === 'changed' && entry.details?.changes?.find((c: any) => c.field === 'name' && c.old && c.new) || null

// Inline diff renderer
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type DiffSeg = { t: 'same' | 'del' | 'ins'; s: string }

const tokenize = (s: string): string[] => s.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]/gu) || []

const lcs = (a: string[], b: string[]): DiffSeg[] => {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  const stack: DiffSeg[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ t: 'same', s: a[--i] }); j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ t: 'ins', s: b[--j] })
    } else {
      stack.push({ t: 'del', s: a[--i] })
    }
  }

  const segs: DiffSeg[] = []
  while (stack.length) {
    const seg = stack.pop()!
    if (segs.length && segs[segs.length - 1].t === seg.t) segs[segs.length - 1].s += seg.s
    else segs.push({ ...seg })
  }
  return segs
}

const segHtml = (segs: DiffSeg[]): string => segs.map(s =>
  s.t === 'del' ? `<span class="diff-del">${esc(s.s)}</span>`
  : s.t === 'ins' ? `<span class="diff-ins">${esc(s.s)}</span>`
  : esc(s.s)
).join('')

const inlineDiffHtml = (oldStr: string, newStr: string): string => {
  if (oldStr === newStr) return esc(oldStr)
  if (!oldStr) return `<span class="diff-ins">${esc(newStr)}</span>`
  if (!newStr) return `<span class="diff-del">${esc(oldStr)}</span>`
  const a = tokenize(oldStr), b = tokenize(newStr)
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++
  const midSegs = lcs(a.slice(pre, a.length - suf), b.slice(pre, b.length - suf))
  const segs: DiffSeg[] = []
  if (pre) segs.push({ t: 'same', s: a.slice(0, pre).join('') })
  segs.push(...midSegs)
  if (suf) segs.push({ t: 'same', s: a.slice(a.length - suf).join('') })
  return segHtml(segs)
}

const renderDiffBlock = (raw: string): string => {
  if (!raw || raw === '(no changes)' || raw === '(diff error)') return ''
  const lines = raw.split('\n')
  const html: string[] = []
  let hasOutput = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('\\')) { i++; continue }
    if (line.startsWith('@@')) {
      if (hasOutput) html.push('<div class="diff-sep">···</div>')
      i++; continue
    }
    if (line.startsWith(' ') || line === '') { i++; continue }

    if (line.startsWith('-')) {
      const removed: string[] = []
      while (i < lines.length && lines[i].startsWith('-')) removed.push(lines[i++].substring(1))
      const added: string[] = []
      while (i < lines.length && lines[i].startsWith('+')) added.push(lines[i++].substring(1))

      const pairs = Math.max(removed.length, added.length)
      for (let j = 0; j < pairs; j++) {
        if (j < removed.length && j < added.length) {
          html.push(`<div class="diff-line">${inlineDiffHtml(removed[j], added[j])}</div>`)
        } else if (j < removed.length) {
          html.push(`<div class="diff-line"><span class="diff-del">${esc(removed[j])}</span></div>`)
        } else {
          html.push(`<div class="diff-line"><span class="diff-ins">${esc(added[j])}</span></div>`)
        }
      }
      hasOutput = true
      continue
    }

    if (line.startsWith('+')) {
      html.push(`<div class="diff-line"><span class="diff-ins">${esc(line.substring(1))}</span></div>`)
      i++; hasOutput = true; continue
    }
    i++
  }
  return html.join('')
}

const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

onMounted(async () => {
  let excludedCompanyNames: string[] = []
  if (excludedCompanyIds.value.length) {
    const { data } = await supabase.rpc('get_companies_by_ids', { p_ids: excludedCompanyIds.value })
    excludedCompanyNames = (data || []).map((c: { name: string }) => c.name)
  }
  await fetchProjects(excludedProjectIds.value, excludedCompanyNames)
})
</script>

<style scoped>
.activity-view {
  position: fixed;
  inset: 0;
  background: var(--bg-primary);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* Layout */
.activity-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0.75rem;
}

/* Project sidebar */
.project-sidebar {
  width: 21rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-primary);
  padding-right: 0.75rem;
}

.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

.project-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-item {
  display: flex;
  align-items: center;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s ease;
}

.project-item:hover { background: var(--bg-secondary); }
.project-item.active { background: var(--bg-tertiary); }

.project-name {
  flex: 1;
  font-size: 1rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-item.active .project-name { color: var(--text-primary); }

/* Main content */
.activity-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 1.1rem;
}

/* Tier tabs */
.tier-tabs-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
  margin-bottom: 1rem;
}

.tier-tabs {
  display: inline-flex;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 2px;
}

.tier-tab {
  padding: 0.45rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: calc(var(--radius-md) - 2px);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tier-tab:hover:not(.active) {
  color: var(--text-secondary);
}

.tier-tab.active {
  background: var(--bg-hover);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.generated-at {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-left: auto;
}

/* Tier content — scrollable, centered */
.tier-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  font-size: 1.15rem;
}

.tier-content::-webkit-scrollbar { width: 8px; }
.tier-content::-webkit-scrollbar-track { background: var(--bg-primary); }
.tier-content::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

/* Scaled heading sizes to stay proportional at the larger base font */
.tier-content :deep(h1) { font-size: 1.75rem; }
.tier-content :deep(h2) { font-size: 1.5rem; }
.tier-content :deep(h3) { font-size: 1.3rem; }
.tier-content :deep(h4) { font-size: 1.2rem; }

.tier-content-inner {
  width: 100%;
  max-width: 800px;
  padding: 0 1rem 2rem;
}

.content-loading {
  display: flex;
  justify-content: center;
  padding: 3rem;
  color: var(--text-muted);
  font-size: 1.2rem;
}

.empty-tier {
  color: var(--text-muted);
  padding: 2rem 0;
  font-size: 1rem;
}

/* Activity timeline (Tier 3) */
.timeline {
  display: flex;
  flex-direction: column;
}

.timeline-week {
  display: flex;
  gap: 1.5rem;
}

.week-label-col {
  width: 7rem;
  flex-shrink: 0;
}

.week-label {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  padding: 0.6rem 0;
  z-index: 2;
}

.week-number {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.week-range {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
  white-space: nowrap;
}

.week-entries {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  border-left: 2px solid var(--border-primary);
  padding-left: 1.5rem;
  padding-bottom: 1.5rem;
  min-width: 0;
}

.timeline-entry {
  position: relative;
}

.timeline-dot {
  position: absolute;
  left: -1.5rem;
  top: 1.1rem;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent-primary);
  transform: translateX(calc(-50% - 1px));
  border: 2px solid var(--bg-primary);
  z-index: 1;
}

.dot-decision     { background: #6bb3ff; }
.dot-blocker      { background: #f87171; }
.dot-resolution   { background: #4ade80; }
.dot-progress     { background: #22d3ee; }
.dot-milestone    { background: #fbbf24; }
.dot-risk         { background: #fb923c; }
.dot-scope_change { background: #c084fc; }
.dot-communication { background: #9ca3af; }


.activity-entry {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-primary);
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.entry-date {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-left: auto;
}

.entry-summary {
  color: var(--text-secondary);
  line-height: 1.5;
}

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.meta-tag {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}

.meta-tag.kgr { border-left: 2px solid #a855f7; }
.meta-tag.person { border-left: 2px solid #06b6d4; }

/* Category badges (Tier 3) */
.category-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cat-decision     { background: rgba(74, 158, 255, 0.15); color: #6bb3ff; }
.cat-blocker      { background: rgba(239, 68, 68, 0.15);  color: #f87171; }
.cat-resolution   { background: rgba(34, 197, 94, 0.15);  color: #4ade80; }
.cat-progress     { background: rgba(6, 182, 212, 0.15);  color: #22d3ee; }
.cat-milestone    { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.cat-risk         { background: rgba(249, 115, 22, 0.15); color: #fb923c; }
.cat-scope_change { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
.cat-communication { background: rgba(107, 114, 128, 0.15); color: var(--text-tertiary); }

/* Event entries (Tier 4) */
.event-entry {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 0.85rem 1.25rem;
  border: 1px solid var(--border-primary);
}

.source-badge {
  display: inline-block;
  padding: 0.3rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
  width: 58px;
  text-align: center;
  text-transform: uppercase;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.source-badge.clickable {
  cursor: pointer;
}

.source-badge.clickable:hover {
  transform: scale(1.08);
  filter: brightness(1.15);
}

.event-type-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.evt-created { background: rgba(34, 197, 94, 0.12); color: #4ade80; }
.evt-changed { background: rgba(74, 158, 255, 0.12); color: #6bb3ff; }
.evt-deleted { background: rgba(239, 68, 68, 0.12); color: #f87171; }

.event-details {
  margin-top: 0.4rem;
}

.event-name {
  font-size: 0.95rem;
  color: var(--text-primary);
  font-weight: 500;
}

.change-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
  font-size: 0.85rem;
}

.change-field {
  color: var(--text-muted);
  min-width: 5rem;
  font-weight: 500;
}

.change-old {
  color: #f87171;
  text-decoration: line-through;
}

.change-arrow {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.change-new {
  color: #4ade80;
}

.change-diff-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.change-inline-diff {
  color: var(--text-primary);
  line-height: 1.5;
}

.change-inline-diff :deep(.diff-del) {
  background: rgba(239, 68, 68, 0.18);
  color: #f87171;
  text-decoration: line-through;
  border-radius: 2px;
  padding: 0.05rem 0.15rem;
}

.change-inline-diff :deep(.diff-ins) {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
  border-radius: 2px;
  padding: 0.05rem 0.15rem;
}

.diff-block {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #1a1a2e;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-family: 'Fira Code', 'Consolas', monospace;
  color: var(--text-secondary);
  max-height: 20rem;
  overflow-y: auto;
  overflow-x: auto;
}

.diff-block :deep(.diff-line) {
  padding: 0.1rem 0.25rem;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.diff-block :deep(.diff-sep) {
  padding: 0.2rem 0;
  color: var(--text-muted);
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.5;
}

.diff-block :deep(.diff-del) {
  background: rgba(239, 68, 68, 0.18);
  color: #f87171;
  text-decoration: line-through;
  border-radius: 2px;
  padding: 0.05rem 0.15rem;
}

.diff-block :deep(.diff-ins) {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
  border-radius: 2px;
  padding: 0.05rem 0.15rem;
}

/* Source filter buttons */
.source-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 0.5rem;
}

.source-filter-btn {
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--sf-color);
  background: color-mix(in srgb, var(--sf-color) 15%, transparent);
  color: var(--sf-color);
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.source-filter-btn:hover {
  filter: brightness(1.2);
}

.source-filter-clear {
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-muted);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
  transition: all 0.15s ease;
}

.source-filter-clear:hover {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
}

/* Search bar */
.tier-search {
  position: relative;
  margin-left: auto;
}

.tier-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--text-muted);
  pointer-events: none;
}

.tier-search-input {
  padding: 0.3rem 0.5rem 0.3rem 1.7rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.8rem;
  width: 180px;
  outline: none;
  transition: border-color 0.15s ease;
}

.tier-search-input::placeholder {
  color: var(--text-muted);
}

.tier-search-input:focus {
  border-color: var(--accent-primary);
}

/* Infinite scroll */
.scroll-sentinel {
  height: 1px;
}

.scroll-loading {
  display: flex;
  justify-content: center;
  padding: 1rem;
  color: var(--text-muted);
}
</style>
