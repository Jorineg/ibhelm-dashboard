import { usePollingRun, type BaseRun } from './usePollingRun'

export interface PersonLinkingRun extends BaseRun {
  created_count?: number
  linked_count?: number
  skipped_count?: number
}

const initialState = (id: string): PersonLinkingRun => ({
  id,
  status: 'running',
  processed_count: 0,
  created_count: 0,
  linked_count: 0,
  skipped_count: 0,
  started_at: new Date().toISOString()
})

const { run, isRunning, startRun, fetchLatestRun } = usePollingRun<PersonLinkingRun>(
  'rerun_all_person_linking',
  'get_person_linking_run_status',
  'get_latest_person_linking_run',
  initialState
)

export function usePeople() {
  return {
    personLinkingRun: run,
    isLinking: isRunning,
    rerunPersonLinking: startRun,
    fetchLatestPersonLinkingRun: fetchLatestRun
  }
}
