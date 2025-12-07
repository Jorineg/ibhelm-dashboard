import { usePollingRun, type BaseRun } from './usePollingRun'

export interface ProjectLinkingRun extends BaseRun {
  linked_count?: number
  skipped_count?: number
}

const initialState = (id: string): ProjectLinkingRun => ({
  id,
  status: 'running',
  processed_count: 0,
  linked_count: 0,
  skipped_count: 0,
  started_at: new Date().toISOString()
})

const { run, isRunning, startRun, fetchLatestRun } = usePollingRun<ProjectLinkingRun>(
  'rerun_all_project_conversation_linking',
  'get_project_linking_run_status',
  'get_latest_project_linking_run',
  initialState
)

export function useEmails() {
  return {
    projectLinkingRun: run,
    isLinking: isRunning,
    rerunProjectLinking: startRun,
    fetchLatestProjectLinkingRun: fetchLatestRun
  }
}
