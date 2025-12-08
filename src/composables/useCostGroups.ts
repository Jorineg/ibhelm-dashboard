import { usePollingRun, type BaseRun } from './usePollingRun'

export interface CostGroupLinkingRun extends BaseRun {
  created_count?: number
  linked_count?: number
  skipped_count?: number
}

const initialState = (id: string): CostGroupLinkingRun => ({
  id,
  status: 'running',
  processed_count: 0,
  created_count: 0,
  linked_count: 0,
  skipped_count: 0,
  started_at: new Date().toISOString()
})

const { run, isRunning, startRun, fetchLatestRun } = usePollingRun<CostGroupLinkingRun>(
  'rerun_all_cost_group_linking',
  'get_cost_group_linking_run_status',
  'get_latest_cost_group_linking_run',
  initialState
)

export function useCostGroups() {
  return {
    costGroupLinkingRun: run,
    isLinking: isRunning,
    rerunCostGroupLinking: startRun,
    fetchLatestCostGroupLinkingRun: fetchLatestRun
  }
}

