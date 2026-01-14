import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/formatDate'

interface SyncStatusRow {
  source: string
  last_event_time: string | null
  checkpoint_updated_at: string | null
  pending_count: number
  processing_count: number
  failed_count: number
  last_processed_at: string | null
  last_failed_at: string | null
  oldest_processing_started_at: string | null
}

export interface SyncSourceStatus {
  lastScanned: Date | null
  lastChange: Date | null
  pendingCount: number
  processingCount: number
  oldestProcessingStarted: Date | null
}

export interface FilesStatus {
  lastProcessed: Date | null
  pendingCount: number
  processingCount: number
  failedCount: number
  lastFailed: Date | null
  oldestProcessingStarted: Date | null
}

export interface ThumbnailsStatus {
  lastProcessed: Date | null
  pendingCount: number
  processingCount: number
  failedCount: number
  lastFailed: Date | null
  oldestProcessingStarted: Date | null
}

export interface AttachmentsStatus {
  lastProcessed: Date | null
  pendingCount: number
  processingCount: number
  failedCount: number
  lastFailed: Date | null
  oldestProcessingStarted: Date | null
}

export interface SyncStatus {
  teamwork: SyncSourceStatus
  missive: SyncSourceStatus
  craft: SyncSourceStatus
  files: FilesStatus
  thumbnails: ThumbnailsStatus
  attachments: AttachmentsStatus
}

export type OverallStatus = 'synced' | 'importing' | 'outdated' | 'error'

const OUTDATED_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const FILES_OUTDATED_THRESHOLD_MS = 60 * 1000 // 1 minute
const THUMBNAILS_OUTDATED_THRESHOLD_MS = 60 * 1000 // 1 minute
const ATTACHMENTS_OUTDATED_THRESHOLD_MS = 60 * 1000 // 1 minute
const ERROR_RECENCY_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

export function useSyncStatus() {
  const syncStatus = ref<SyncStatus>({
    teamwork: { lastScanned: null, lastChange: null, pendingCount: 0, processingCount: 0, oldestProcessingStarted: null },
    missive: { lastScanned: null, lastChange: null, pendingCount: 0, processingCount: 0, oldestProcessingStarted: null },
    craft: { lastScanned: null, lastChange: null, pendingCount: 0, processingCount: 0, oldestProcessingStarted: null },
    files: { lastProcessed: null, pendingCount: 0, processingCount: 0, failedCount: 0, lastFailed: null, oldestProcessingStarted: null },
    thumbnails: { lastProcessed: null, pendingCount: 0, processingCount: 0, failedCount: 0, lastFailed: null, oldestProcessingStarted: null },
    attachments: { lastProcessed: null, pendingCount: 0, processingCount: 0, failedCount: 0, lastFailed: null, oldestProcessingStarted: null }
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  let pollInterval: number | null = null

  // Computed: check if any source has pending items
  const hasAnyPending = computed(() =>
    syncStatus.value.teamwork.pendingCount > 0 ||
    syncStatus.value.missive.pendingCount > 0 ||
    syncStatus.value.craft.pendingCount > 0 ||
    syncStatus.value.files.pendingCount > 0 ||
    syncStatus.value.files.processingCount > 0 ||
    syncStatus.value.thumbnails.pendingCount > 0 ||
    syncStatus.value.thumbnails.processingCount > 0 ||
    syncStatus.value.attachments.pendingCount > 0 ||
    syncStatus.value.attachments.processingCount > 0
  )

  // Computed: check if any sync is outdated
  const isAnyOutdated = computed(() => {
    const now = Date.now()
    const sources = [syncStatus.value.teamwork, syncStatus.value.missive, syncStatus.value.craft]
    const connectorsOutdated = sources.some(s => s.lastScanned && (now - s.lastScanned.getTime()) > OUTDATED_THRESHOLD_MS)

    return connectorsOutdated || isFilesOutdated.value || isThumbnailsOutdated.value || isAttachmentsOutdated.value
  })

  // Computed: check if a specific connector source is outdated
  const isSourceOutdated = (source: SyncSourceStatus): boolean => {
    if (!source.lastScanned) return false
    return (Date.now() - source.lastScanned.getTime()) > OUTDATED_THRESHOLD_MS
  }

  // Check if files (S3 upload) is outdated
  const isFilesOutdated = computed((): boolean => {
    const f = syncStatus.value.files
    if (f.pendingCount === 0 && f.processingCount === 0) return false
    if (!f.lastProcessed) return true
    return (Date.now() - f.lastProcessed.getTime()) > FILES_OUTDATED_THRESHOLD_MS
  })

  // Check if thumbnails is outdated (queue not empty AND last processed >1 min ago)
  const isThumbnailsOutdated = computed((): boolean => {
    const t = syncStatus.value.thumbnails
    if (t.pendingCount === 0) return false
    if (!t.lastProcessed) return true
    return (Date.now() - t.lastProcessed.getTime()) > THUMBNAILS_OUTDATED_THRESHOLD_MS
  })

  // Check if attachments download is outdated (queue not empty AND last processed >1 min ago)
  const isAttachmentsOutdated = computed((): boolean => {
    const a = syncStatus.value.attachments
    if (a.pendingCount === 0 && a.processingCount === 0) return false
    if (!a.lastProcessed) return true
    return (Date.now() - a.lastProcessed.getTime()) > ATTACHMENTS_OUTDATED_THRESHOLD_MS
  })

  // Check if failure is recent (within 24 hours)
  const isRecentFailure = (lastFailed: Date | null): boolean => {
    if (!lastFailed) return false
    return (Date.now() - lastFailed.getTime()) < ERROR_RECENCY_THRESHOLD_MS
  }

  // Computed: check if any source has recent failures (within 24h)
  const hasRecentFailures = computed(() =>
    isRecentFailure(syncStatus.value.files.lastFailed) ||
    isRecentFailure(syncStatus.value.thumbnails.lastFailed) ||
    isRecentFailure(syncStatus.value.attachments.lastFailed)
  )

  // Computed: total recent error count
  const recentErrorCount = computed(() => {
    let count = 0
    if (isRecentFailure(syncStatus.value.files.lastFailed)) count += syncStatus.value.files.failedCount
    if (isRecentFailure(syncStatus.value.thumbnails.lastFailed)) count += syncStatus.value.thumbnails.failedCount
    if (isRecentFailure(syncStatus.value.attachments.lastFailed)) count += syncStatus.value.attachments.failedCount
    return count
  })

  // Computed: overall status for header indicator
  const overallStatus = computed<OverallStatus>(() => {
    if (hasRecentFailures.value) return 'error'
    if (hasAnyPending.value) return 'importing'
    if (isAnyOutdated.value) return 'outdated'
    return 'synced'
  })

  // Get tooltip text for header status
  const headerTooltip = computed((): string => {
    const status = overallStatus.value
    const lastProcessedTimes = [
      syncStatus.value.teamwork.lastChange,
      syncStatus.value.missive.lastChange,
      syncStatus.value.craft.lastChange,
      syncStatus.value.files.lastProcessed,
      syncStatus.value.thumbnails.lastProcessed,
      syncStatus.value.attachments.lastProcessed
    ].filter(Boolean) as Date[]
    
    const mostRecentUpdate = lastProcessedTimes.length > 0 
      ? new Date(Math.max(...lastProcessedTimes.map(d => d.getTime())))
      : null

    switch (status) {
      case 'synced':
        return `All up to date, no errors within last 24h${mostRecentUpdate ? `\nLast data update: ${formatRelativeTime(mostRecentUpdate)}` : ''}`
      case 'importing': {
        const pending = getTotalPendingCount()
        return `Syncing/importing data (${pending} items in queue)${mostRecentUpdate ? `\nLast update: ${formatRelativeTime(mostRecentUpdate)}` : ''}\nNo errors within last 24h`
      }
      case 'outdated':
        return `Some sync processes may be stalled${mostRecentUpdate ? `\nLast successful update: ${formatRelativeTime(mostRecentUpdate)}` : ''}\nNo errors within last 24h`
      case 'error':
        return `${recentErrorCount.value} errors within last 24h${mostRecentUpdate ? `\nLast successful update: ${formatRelativeTime(mostRecentUpdate)}` : ''}`
      default:
        return ''
    }
  })

  const getTotalPendingCount = (): number => {
    return (
      syncStatus.value.teamwork.pendingCount +
      syncStatus.value.missive.pendingCount +
      syncStatus.value.craft.pendingCount +
      syncStatus.value.files.pendingCount + syncStatus.value.files.processingCount +
      syncStatus.value.thumbnails.pendingCount + syncStatus.value.thumbnails.processingCount +
      syncStatus.value.attachments.pendingCount + syncStatus.value.attachments.processingCount
    )
  }

  // Get tooltip for queue status (ok state)
  const getQueueOkTooltip = (lastProcessed: Date | null, action: string): string => {
    if (!lastProcessed) return `All items ${action}`
    return `All items ${action}\nLast: ${formatRelativeTime(lastProcessed)}`
  }

  // Get tooltip for queue status (pending/processing state)
  const getQueuePendingTooltip = (
    pendingCount: number,
    processingCount: number,
    oldestProcessingStarted: Date | null
  ): string => {
    const parts: string[] = []
    if (pendingCount > 0) parts.push(`${pendingCount} waiting in queue`)
    if (processingCount > 0) {
      if (oldestProcessingStarted) {
        const elapsed = Math.round((Date.now() - oldestProcessingStarted.getTime()) / 1000)
        parts.push(`${processingCount} processing (oldest: ${elapsed}s)`)
      } else {
        parts.push(`${processingCount} processing`)
      }
    }
    return parts.join('\n')
  }

  // Get tooltip for failed items
  const getFailedTooltip = (failedCount: number, lastFailed: Date | null): string => {
    if (!lastFailed) return `${failedCount} items failed`
    return `${failedCount} items failed\nMost recent: ${formatRelativeTime(lastFailed)}`
  }

  const fetchSyncStatus = async () => {
    try {
      loading.value = true
      error.value = null

      const { data, error: rpcError } = await supabase.rpc('get_sync_status')

      if (rpcError) {
        console.warn('Could not fetch sync status:', rpcError)
        error.value = rpcError.message
        return
      }

      if (data) {
        processSyncStatus(data as SyncStatusRow[])
      }

    } catch (err) {
      console.error('Error fetching sync status:', err)
      error.value = 'Failed to fetch sync status'
    } finally {
      loading.value = false
    }
  }

  // Parse timestamp from database as UTC
  const parseUtcTimestamp = (timestamp: string | null): Date | null => {
    if (!timestamp) return null
    const utcTimestamp = timestamp.endsWith('Z') || timestamp.includes('+') || timestamp.includes('-', 10)
      ? timestamp
      : timestamp + 'Z'
    return new Date(utcTimestamp)
  }

  const processSyncStatus = (rows: SyncStatusRow[]) => {
    rows.forEach(row => {
      if (row.source === 'files') {
        syncStatus.value.files = {
          lastProcessed: parseUtcTimestamp(row.last_processed_at),
          pendingCount: row.pending_count || 0,
          processingCount: row.processing_count || 0,
          failedCount: row.failed_count || 0,
          lastFailed: parseUtcTimestamp(row.last_failed_at),
          oldestProcessingStarted: parseUtcTimestamp(row.oldest_processing_started_at)
        }
      } else if (row.source === 'thumbnails') {
        syncStatus.value.thumbnails = {
          lastProcessed: parseUtcTimestamp(row.last_processed_at),
          pendingCount: row.pending_count || 0,
          processingCount: row.processing_count || 0,
          failedCount: row.failed_count || 0,
          lastFailed: parseUtcTimestamp(row.last_failed_at),
          oldestProcessingStarted: parseUtcTimestamp(row.oldest_processing_started_at)
        }
      } else if (row.source === 'attachments') {
        syncStatus.value.attachments = {
          lastProcessed: parseUtcTimestamp(row.last_processed_at),
          pendingCount: row.pending_count || 0,
          processingCount: row.processing_count || 0,
          failedCount: row.failed_count || 0,
          lastFailed: parseUtcTimestamp(row.last_failed_at),
          oldestProcessingStarted: parseUtcTimestamp(row.oldest_processing_started_at)
        }
      } else {
        const status: SyncSourceStatus = {
          lastScanned: parseUtcTimestamp(row.last_event_time),
          lastChange: parseUtcTimestamp(row.last_processed_at),
          pendingCount: row.pending_count || 0,
          processingCount: row.processing_count || 0,
          oldestProcessingStarted: parseUtcTimestamp(row.oldest_processing_started_at)
        }

        if (row.source === 'teamwork') syncStatus.value.teamwork = status
        else if (row.source === 'missive') syncStatus.value.missive = status
        else if (row.source === 'craft') syncStatus.value.craft = status
      }
    })
  }

  const startPolling = (intervalMs = 5000) => {
    fetchSyncStatus()
    pollInterval = window.setInterval(fetchSyncStatus, intervalMs)
  }

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  onMounted(() => {
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    syncStatus,
    loading,
    error,
    overallStatus,
    hasAnyPending,
    hasRecentFailures,
    recentErrorCount,
    isAnyOutdated,
    isSourceOutdated,
    isFilesOutdated,
    isThumbnailsOutdated,
    isAttachmentsOutdated,
    headerTooltip,
    getQueueOkTooltip,
    getQueuePendingTooltip,
    getFailedTooltip,
    fetchSyncStatus,
    startPolling,
    stopPolling
  }
}
