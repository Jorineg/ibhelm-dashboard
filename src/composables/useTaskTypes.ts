import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { getCached, setCache, isEqual } from '@/lib/cache'
import { usePollingRun, type BaseRun } from './usePollingRun'
import type { TaskType, TaskTypeRule } from '@/types'

export type ExtractionRun = BaseRun

const initialExtractionState = (id: string): ExtractionRun => ({
  id,
  status: 'running',
  processed_count: 0,
  started_at: new Date().toISOString()
})

// Polling run for extraction
const { run: extractionRun, isRunning: extractionRunning, startRun: rerunExtraction, fetchLatestRun: fetchLatestExtractionRun } = usePollingRun<ExtractionRun>(
  'rerun_all_task_type_extractions',
  'get_extraction_run_status',
  'get_latest_extraction_run',
  initialExtractionState
)

// Shared state across all composable instances
const taskTypes = ref<TaskType[]>(getCached<TaskType[]>('task_types') || [])
const taskTypeRules = ref<TaskTypeRule[]>(getCached<TaskTypeRule[]>('task_type_rules') || [])
const loading = ref(false)
const saving = ref(false)
const initialized = ref(false)

export function useTaskTypes() {
  const fetchTaskTypes = async () => {
    try {
      loading.value = true
      const { data, error } = await supabase
        .from('task_types')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error
      const fresh = data || []
      if (!isEqual(fresh, taskTypes.value)) {
        taskTypes.value = fresh
      }
      setCache('task_types', fresh)
    } catch (error) {
      console.error('Error fetching task types:', error)
    } finally {
      loading.value = false
    }
  }

  const fetchTaskTypeRules = async () => {
    try {
      const { data, error } = await supabase
        .from('task_type_rules')
        .select('*')
        .order('db_created_at', { ascending: true })

      if (error) throw error
      const fresh = data || []
      if (!isEqual(fresh, taskTypeRules.value)) {
        taskTypeRules.value = fresh
      }
      setCache('task_type_rules', fresh)
    } catch (error) {
      console.error('Error fetching task type rules:', error)
    }
  }

  const initialize = async () => {
    if (initialized.value) return
    initialized.value = true
    // Fire off background refresh (don't await if we have cached data)
    const hasCached = taskTypes.value.length > 0 || taskTypeRules.value.length > 0
    const refreshPromise = Promise.all([fetchTaskTypes(), fetchTaskTypeRules()])
    if (!hasCached) await refreshPromise
  }

  const createTaskType = async (taskType: Partial<TaskType>): Promise<TaskType | null> => {
    try {
      saving.value = true
      const slug = taskType.slug || taskType.name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || ''

      const { data, error } = await supabase
        .from('task_types')
        .insert({
          name: taskType.name,
          slug,
          description: taskType.description,
          color: taskType.color,
          icon: taskType.icon,
          is_default: taskType.is_default || false,
          display_order: taskType.display_order || taskTypes.value.length
        })
        .select()
        .single()

      if (error) throw error

      taskTypes.value.push(data)
      setCache('task_types', taskTypes.value)
      return data
    } catch (error) {
      console.error('Error creating task type:', error)
      return null
    } finally {
      saving.value = false
    }
  }

  const updateTaskType = async (id: string, updates: Partial<TaskType>): Promise<boolean> => {
    try {
      saving.value = true

      const { error } = await supabase
        .from('task_types')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      const index = taskTypes.value.findIndex(t => t.id === id)
      if (index !== -1) {
        taskTypes.value[index] = { ...taskTypes.value[index], ...updates }
      }
      setCache('task_types', taskTypes.value)

      return true
    } catch (error) {
      console.error('Error updating task type:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  const deleteTaskType = async (id: string): Promise<boolean> => {
    try {
      saving.value = true

      const { error } = await supabase
        .from('task_types')
        .delete()
        .eq('id', id)

      if (error) throw error

      taskTypes.value = taskTypes.value.filter(t => t.id !== id)
      taskTypeRules.value = taskTypeRules.value.filter(r => r.task_type_id !== id)
      setCache('task_types', taskTypes.value)
      setCache('task_type_rules', taskTypeRules.value)

      return true
    } catch (error) {
      console.error('Error deleting task type:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  const addTaskTypeRule = async (taskTypeId: string, tagName: string): Promise<TaskTypeRule | null> => {
    try {
      saving.value = true

      const { data, error } = await supabase
        .from('task_type_rules')
        .insert({
          task_type_id: taskTypeId,
          teamwork_tag_name: tagName
        })
        .select()
        .single()

      if (error) throw error

      taskTypeRules.value.push(data)
      setCache('task_type_rules', taskTypeRules.value)
      return data
    } catch (error) {
      console.error('Error adding task type rule:', error)
      return null
    } finally {
      saving.value = false
    }
  }

  const removeTaskTypeRule = async (ruleId: string): Promise<boolean> => {
    try {
      saving.value = true

      const { error } = await supabase
        .from('task_type_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error

      taskTypeRules.value = taskTypeRules.value.filter(r => r.id !== ruleId)
      setCache('task_type_rules', taskTypeRules.value)
      return true
    } catch (error) {
      console.error('Error removing task type rule:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  const getRulesForTaskType = (taskTypeId: string): TaskTypeRule[] => {
    return taskTypeRules.value.filter(r => r.task_type_id === taskTypeId)
  }

  const filterableTaskTypes = computed(() => taskTypes.value.filter(t => !t.is_default))
  const defaultTaskType = computed(() => taskTypes.value.find(t => t.is_default))

  return {
    taskTypes,
    taskTypeRules,
    loading,
    saving: computed(() => saving.value || extractionRunning.value),
    extractionRun,
    filterableTaskTypes,
    defaultTaskType,
    initialize,
    fetchTaskTypes,
    fetchTaskTypeRules,
    createTaskType,
    updateTaskType,
    deleteTaskType,
    addTaskTypeRule,
    removeTaskTypeRule,
    getRulesForTaskType,
    rerunExtraction,
    fetchLatestExtractionRun
  }
}
