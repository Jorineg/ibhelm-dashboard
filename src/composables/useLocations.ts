import { usePollingRun, type BaseRun } from './usePollingRun'

export interface LocationLinkingRun extends BaseRun {
  created_count?: number
  linked_count?: number
  skipped_count?: number
}

const initialState = (id: string): LocationLinkingRun => ({
  id,
  status: 'running',
  processed_count: 0,
  created_count: 0,
  linked_count: 0,
  skipped_count: 0,
  started_at: new Date().toISOString()
})

const { run, isRunning, startRun, fetchLatestRun } = usePollingRun<LocationLinkingRun>(
  'rerun_all_location_linking',
  'get_location_linking_run_status',
  'get_latest_location_linking_run',
  initialState
)

export function useLocations() {
  return {
    locationLinkingRun: run,
    isLinking: isRunning,
    rerunLocationLinking: startRun,
    fetchLatestLocationLinkingRun: fetchLatestRun
  }
}

