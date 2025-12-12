import { usePollingRun, type BaseRun } from './usePollingRun'

export interface FileLinkingRun extends BaseRun {
  created_count?: number
  linked_count?: number
  skipped_count?: number
}

const initialState = (id: string): FileLinkingRun => ({
  id,
  status: 'running',
  processed_count: 0,
  created_count: 0,
  linked_count: 0,
  skipped_count: 0,
  started_at: new Date().toISOString()
})

const { run, isRunning, startRun, fetchLatestRun } = usePollingRun<FileLinkingRun>(
  'rerun_all_file_linking',
  'get_file_linking_run_status',
  'get_latest_file_linking_run',
  initialState
)

export function useFiles() {
  return {
    fileLinkingRun: run,
    isLinking: isRunning,
    rerunFileLinking: startRun,
    fetchLatestFileLinkingRun: fetchLatestRun
  }
}

