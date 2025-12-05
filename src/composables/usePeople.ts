import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { PersonLinkingRun } from '@/types'

// Shared state across all composable instances
const personLinkingRun = ref<PersonLinkingRun | null>(null)
const isLinking = ref(false)

export function usePeople() {
  // Trigger linking of all contacts and users to unified persons
  const rerunPersonLinking = async (): Promise<string | null> => {
    try {
      isLinking.value = true
      console.log('Starting person linking...')
      
      const { data, error } = await supabase
        .rpc('rerun_all_person_linking')

      console.log('RPC response:', { data, error })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }
      
      // Start polling for status
      if (data) {
        console.log('Person linking started with run ID:', data)
        // Set initial running state
        personLinkingRun.value = {
          id: data,
          status: 'running',
          processed_count: 0,
          created_count: 0,
          linked_count: 0,
          skipped_count: 0,
          started_at: new Date().toISOString()
        }
        pollPersonLinkingStatus(data)
      } else {
        console.warn('No run ID returned from person linking')
      }
      
      return data
    } catch (error) {
      console.error('Error starting person linking:', error)
      return null
    } finally {
      isLinking.value = false
    }
  }

  // Poll person linking run status
  const pollPersonLinkingStatus = async (runId: string) => {
    const poll = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_person_linking_run_status', { p_run_id: runId })

        if (error) throw error
        
        if (data && data.length > 0) {
          personLinkingRun.value = data[0]
          
          // Continue polling if still running
          if (personLinkingRun.value?.status === 'running') {
            setTimeout(poll, 1000)
          }
        }
      } catch (error) {
        console.error('Error polling person linking status:', error)
      }
    }
    
    poll()
  }

  // Get latest person linking run on load
  const fetchLatestPersonLinkingRun = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_latest_person_linking_run')

      if (error) throw error
      
      if (data && data.length > 0) {
        personLinkingRun.value = data[0]
      }
    } catch (error) {
      console.error('Error fetching latest person linking run:', error)
    }
  }

  return {
    personLinkingRun,
    isLinking,
    rerunPersonLinking,
    fetchLatestPersonLinkingRun
  }
}

