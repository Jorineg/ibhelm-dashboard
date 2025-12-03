import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'

interface SyncStatusRow {
  source: string
  last_event_time: string | null
  checkpoint_updated_at: string | null
  pending_count: number
  processing_count: number
  failed_count: number
}

interface SyncStatus {
  teamwork: {
    lastScanned: Date | null
    pendingCount: number
    processingCount: number
  }
  missive: {
    lastScanned: Date | null
    pendingCount: number
    processingCount: number
  }
}

export function useSyncStatus() {
  const syncStatus = ref<SyncStatus>({
    teamwork: { lastScanned: null, pendingCount: 0, processingCount: 0 },
    missive: { lastScanned: null, pendingCount: 0, processingCount: 0 }
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  let pollInterval: number | null = null

  const fetchSyncStatus = async () => {
    try {
      loading.value = true
      error.value = null

      // Use the combined RPC function for efficient single-call fetch
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

  const processSyncStatus = (rows: SyncStatusRow[]) => {
    rows.forEach(row => {
      if (row.source === 'teamwork') {
        syncStatus.value.teamwork.lastScanned = row.last_event_time ? new Date(row.last_event_time) : null
        syncStatus.value.teamwork.pendingCount = row.pending_count || 0
        syncStatus.value.teamwork.processingCount = row.processing_count || 0
      } else if (row.source === 'missive') {
        syncStatus.value.missive.lastScanned = row.last_event_time ? new Date(row.last_event_time) : null
        syncStatus.value.missive.pendingCount = row.pending_count || 0
        syncStatus.value.missive.processingCount = row.processing_count || 0
      }
    })
  }

  const startPolling = (intervalMs = 30000) => {
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
    fetchSyncStatus,
    startPolling,
    stopPolling
  }
}

