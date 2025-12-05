import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { ProjectLinkingRun } from '@/types'

// Shared state across all composable instances
const projectLinkingRun = ref<ProjectLinkingRun | null>(null)
const isLinking = ref(false)

export function useEmails() {
  // Trigger linking of all conversations to projects based on labels
  const rerunProjectLinking = async (): Promise<string | null> => {
    try {
      isLinking.value = true
      console.log('Starting project linking...')
      
      const { data, error } = await supabase
        .rpc('rerun_all_project_conversation_linking')

      console.log('RPC response:', { data, error })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }
      
      // Start polling for status
      if (data) {
        console.log('Project linking started with run ID:', data)
        // Set initial running state
        projectLinkingRun.value = {
          id: data,
          status: 'running',
          processed_count: 0,
          linked_count: 0,
          skipped_count: 0,
          started_at: new Date().toISOString()
        }
        pollProjectLinkingStatus(data)
      } else {
        console.warn('No run ID returned from project linking')
      }
      
      return data
    } catch (error) {
      console.error('Error starting project linking:', error)
      return null
    } finally {
      isLinking.value = false
    }
  }

  // Poll project linking run status
  const pollProjectLinkingStatus = async (runId: string) => {
    const poll = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_project_linking_run_status', { p_run_id: runId })

        if (error) throw error
        
        if (data && data.length > 0) {
          projectLinkingRun.value = data[0]
          
          // Continue polling if still running
          if (projectLinkingRun.value?.status === 'running') {
            setTimeout(poll, 1000)
          }
        }
      } catch (error) {
        console.error('Error polling project linking status:', error)
      }
    }
    
    poll()
  }

  // Get latest project linking run on load
  const fetchLatestProjectLinkingRun = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_latest_project_linking_run')

      if (error) throw error
      
      if (data && data.length > 0) {
        projectLinkingRun.value = data[0]
      }
    } catch (error) {
      console.error('Error fetching latest project linking run:', error)
    }
  }

  return {
    projectLinkingRun,
    isLinking,
    rerunProjectLinking,
    fetchLatestProjectLinkingRun
  }
}

