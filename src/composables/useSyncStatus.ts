import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'

interface SyncStatusRow {
  source: string
  last_event_time: string | null
  checkpoint_updated_at: string | null
  pending_count: number
  processing_count: number
  failed_count: number
  last_processed_at: string | null
}

export interface SyncSourceStatus {
  lastScanned: Date | null
  lastChange: Date | null
  pendingCount: number
  processingCount: number
}

export interface FilesStatus {
  lastEventTime: Date | null
  lastUpdated: Date | null
}

export interface ThumbnailsStatus {
  lastProcessed: Date | null
  pendingCount: number
}

export interface SyncStatus {
  teamwork: SyncSourceStatus
  missive: SyncSourceStatus
  craft: SyncSourceStatus
  files: FilesStatus
  thumbnails: ThumbnailsStatus
}

export type OverallStatus = 'synced' | 'importing' | 'outdated'

const OUTDATED_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const FILES_OUTDATED_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes
const THUMBNAILS_OUTDATED_THRESHOLD_MS = 60 * 1000 // 1 minute

export function useSyncStatus() {
  const syncStatus = ref<SyncStatus>({
    teamwork: { lastScanned: null, lastChange: null, pendingCount: 0, processingCount: 0 },
    missive: { lastScanned: null, lastChange: null, pendingCount: 0, processingCount: 0 },
    craft: { lastScanned: null, lastChange: null, pendingCount: 0, processingCount: 0 },
    files: { lastEventTime: null, lastUpdated: null },
    thumbnails: { lastProcessed: null, pendingCount: 0 }
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  let pollInterval: number | null = null

  // Computed: check if any connector source has pending items
  const hasAnyPending = computed(() => 
    syncStatus.value.teamwork.pendingCount > 0 ||
    syncStatus.value.missive.pendingCount > 0 ||
    syncStatus.value.craft.pendingCount > 0
  )

  // Computed: check if any connector last sync is outdated (>5 min)
  const isAnyOutdated = computed(() => {
    const now = Date.now()
    const sources = [syncStatus.value.teamwork, syncStatus.value.missive, syncStatus.value.craft]
    return sources.some(s => s.lastScanned && (now - s.lastScanned.getTime()) > OUTDATED_THRESHOLD_MS)
  })

  // Computed: check if a specific connector source is outdated
  const isSourceOutdated = (source: SyncSourceStatus): boolean => {
    if (!source.lastScanned) return false
    return (Date.now() - source.lastScanned.getTime()) > OUTDATED_THRESHOLD_MS
  }

  // Check if files lastUpdated is outdated (>30 min)
  const isFilesOutdated = computed((): boolean => {
    if (!syncStatus.value.files.lastUpdated) return false
    return (Date.now() - syncStatus.value.files.lastUpdated.getTime()) > FILES_OUTDATED_THRESHOLD_MS
  })

  // Check if thumbnails is outdated (queue not empty AND last processed >1 min ago)
  const isThumbnailsOutdated = computed((): boolean => {
    const t = syncStatus.value.thumbnails
    if (t.pendingCount === 0) return false
    if (!t.lastProcessed) return true
    return (Date.now() - t.lastProcessed.getTime()) > THUMBNAILS_OUTDATED_THRESHOLD_MS
  })

  // Computed: overall status for header indicator
  const overallStatus = computed<OverallStatus>(() => {
    if (hasAnyPending.value) return 'importing'
    if (isAnyOutdated.value) return 'outdated'
    return 'synced'
  })

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
          lastEventTime: parseUtcTimestamp(row.last_event_time),
          lastUpdated: parseUtcTimestamp(row.checkpoint_updated_at)
        }
      } else if (row.source === 'thumbnails') {
        syncStatus.value.thumbnails = {
          lastProcessed: parseUtcTimestamp(row.last_processed_at),
          pendingCount: row.pending_count || 0
        }
      } else {
        const status: SyncSourceStatus = {
          lastScanned: parseUtcTimestamp(row.last_event_time),
          lastChange: parseUtcTimestamp(row.last_processed_at),
          pendingCount: row.pending_count || 0,
          processingCount: row.processing_count || 0
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
    isAnyOutdated,
    isSourceOutdated,
    isFilesOutdated,
    isThumbnailsOutdated,
    fetchSyncStatus,
    startPolling,
    stopPolling
  }
}

