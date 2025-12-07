import { ref, type Ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface BaseRun {
  id: string
  status: 'running' | 'completed' | 'failed'
  total_count?: number
  processed_count: number
  progress_percent?: number
  started_at: string
  completed_at?: string
  error_message?: string
}

export function usePollingRun<T extends BaseRun>(
  startRpcName: string,
  statusRpcName: string,
  latestRpcName: string,
  initialRunState: (id: string) => T
) {
  const run = ref<T | null>(null) as Ref<T | null>
  const isRunning = ref(false)

  const startRun = async (): Promise<string | null> => {
    try {
      isRunning.value = true
      const { data, error } = await supabase.rpc(startRpcName)

      if (error) {
        console.error(`RPC error (${startRpcName}):`, error)
        throw error
      }

      if (data) {
        run.value = initialRunState(data)
        pollStatus(data)
      }

      return data
    } catch (error) {
      console.error(`Error starting ${startRpcName}:`, error)
      return null
    } finally {
      isRunning.value = false
    }
  }

  const pollStatus = async (runId: string) => {
    const poll = async () => {
      try {
        const { data, error } = await supabase.rpc(statusRpcName, { p_run_id: runId })

        if (error) throw error

        if (data && data.length > 0) {
          run.value = data[0]
          if (run.value?.status === 'running') {
            setTimeout(poll, 1000)
          }
        }
      } catch (error) {
        console.error(`Error polling ${statusRpcName}:`, error)
      }
    }
    poll()
  }

  const fetchLatestRun = async () => {
    try {
      const { data, error } = await supabase.rpc(latestRpcName)

      if (error) throw error

      if (data && data.length > 0) {
        run.value = data[0]
      }
    } catch (error) {
      console.error(`Error fetching ${latestRpcName}:`, error)
    }
  }

  return {
    run,
    isRunning,
    startRun,
    fetchLatestRun
  }
}

