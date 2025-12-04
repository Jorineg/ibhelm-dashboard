import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { TaskType, TaskTypeRule, ExtractionRun } from '@/types'

// Shared state across all composable instances
const taskTypes = ref<TaskType[]>([])
const taskTypeRules = ref<TaskTypeRule[]>([])
const loading = ref(false)
const saving = ref(false)
const extractionRun = ref<ExtractionRun | null>(null)
const initialized = ref(false)

export function useTaskTypes() {
  // Fetch all task types
  const fetchTaskTypes = async () => {
    try {
      loading.value = true
      const { data, error } = await supabase
        .from('task_types')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error
      taskTypes.value = data || []
    } catch (error) {
      console.error('Error fetching task types:', error)
    } finally {
      loading.value = false
    }
  }

  // Fetch all task type rules
  const fetchTaskTypeRules = async () => {
    try {
      const { data, error } = await supabase
        .from('task_type_rules')
        .select('*')
        .order('db_created_at', { ascending: true })

      if (error) throw error
      taskTypeRules.value = data || []
    } catch (error) {
      console.error('Error fetching task type rules:', error)
    }
  }

  // Initialize data (only once)
  const initialize = async () => {
    if (initialized.value) return
    initialized.value = true
    await Promise.all([fetchTaskTypes(), fetchTaskTypeRules()])
  }

  // Create a new task type
  const createTaskType = async (taskType: Partial<TaskType>): Promise<TaskType | null> => {
    try {
      saving.value = true
      
      // Generate slug from name if not provided
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
      return data
    } catch (error) {
      console.error('Error creating task type:', error)
      return null
    } finally {
      saving.value = false
    }
  }

  // Update a task type
  const updateTaskType = async (id: string, updates: Partial<TaskType>): Promise<boolean> => {
    try {
      saving.value = true
      
      const { error } = await supabase
        .from('task_types')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      
      // Update local state
      const index = taskTypes.value.findIndex(t => t.id === id)
      if (index !== -1) {
        taskTypes.value[index] = { ...taskTypes.value[index], ...updates }
      }
      
      return true
    } catch (error) {
      console.error('Error updating task type:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  // Delete a task type
  const deleteTaskType = async (id: string): Promise<boolean> => {
    try {
      saving.value = true
      
      const { error } = await supabase
        .from('task_types')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      // Update local state
      taskTypes.value = taskTypes.value.filter(t => t.id !== id)
      // Also remove associated rules
      taskTypeRules.value = taskTypeRules.value.filter(r => r.task_type_id !== id)
      
      return true
    } catch (error) {
      console.error('Error deleting task type:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  // Add a rule to a task type
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
      return data
    } catch (error) {
      console.error('Error adding task type rule:', error)
      return null
    } finally {
      saving.value = false
    }
  }

  // Remove a rule
  const removeTaskTypeRule = async (ruleId: string): Promise<boolean> => {
    try {
      saving.value = true
      
      const { error } = await supabase
        .from('task_type_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error
      
      taskTypeRules.value = taskTypeRules.value.filter(r => r.id !== ruleId)
      return true
    } catch (error) {
      console.error('Error removing task type rule:', error)
      return false
    } finally {
      saving.value = false
    }
  }

  // Get rules for a specific task type
  const getRulesForTaskType = (taskTypeId: string): TaskTypeRule[] => {
    return taskTypeRules.value.filter(r => r.task_type_id === taskTypeId)
  }

  // Trigger re-extraction of all task types
  const rerunExtraction = async (): Promise<string | null> => {
    try {
      saving.value = true
      
      const { data, error } = await supabase
        .rpc('rerun_all_task_type_extractions')

      if (error) throw error
      
      // Start polling for status
      if (data) {
        pollExtractionStatus(data)
      }
      
      return data
    } catch (error) {
      console.error('Error starting extraction:', error)
      return null
    } finally {
      saving.value = false
    }
  }

  // Poll extraction run status
  const pollExtractionStatus = async (runId: string) => {
    const poll = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_extraction_run_status', { p_run_id: runId })

        if (error) throw error
        
        if (data && data.length > 0) {
          extractionRun.value = data[0]
          
          // Continue polling if still running
          if (extractionRun.value?.status === 'running') {
            setTimeout(poll, 1000)
          }
        }
      } catch (error) {
        console.error('Error polling extraction status:', error)
      }
    }
    
    poll()
  }

  // Get latest extraction run on load
  const fetchLatestExtractionRun = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_latest_extraction_run')

      if (error) throw error
      
      if (data && data.length > 0) {
        extractionRun.value = data[0]
      }
    } catch (error) {
      console.error('Error fetching latest extraction run:', error)
    }
  }

  // Computed: non-default task types (for filtering)
  const filterableTaskTypes = computed(() => {
    return taskTypes.value.filter(t => !t.is_default)
  })

  // Computed: default task type
  const defaultTaskType = computed(() => {
    return taskTypes.value.find(t => t.is_default)
  })

  return {
    taskTypes,
    taskTypeRules,
    loading,
    saving,
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

