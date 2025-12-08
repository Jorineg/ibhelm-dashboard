<template>
  <SectionCard
    title="Task Types"
    description="Configure how Teamwork tasks are categorized based on their tags. Tasks with a matching tag will be assigned to that task type."
  >
    <template #header-info>
      <InfoBox title="How rules are applied:">
        These rules are automatically applied to newly created tasks and tasks that are updated in Teamwork. 
        To apply rules to all existing tasks in the database, use the "Re-run All Extractions" button below.
      </InfoBox>
    </template>

    <!-- Extraction Status & Re-run Button -->
    <div class="run-controls">
      <div class="run-info">
        <div class="run-status" v-if="extractionRun">
          <span class="run-status-label">Last extraction:</span>
          <StatusBadge :status="extractionRun.status" />
          <span v-if="extractionRun.status === 'running'" class="run-progress-info">
            {{ extractionRun.processed_count }} / {{ extractionRun.total_count }}
            ({{ extractionRun.progress_percent }}%)
          </span>
          <span v-else-if="extractionRun.completed_at" class="run-time-info">
            {{ formatDate(extractionRun.completed_at) }}
          </span>
        </div>
        <div v-else class="run-status">
          <span class="run-status-label">No extraction runs yet</span>
        </div>
      </div>
      
      <Button
        label="Re-run All Extractions"
        icon="pi pi-refresh"
        :loading="isExtracting"
        @click="$emit('rerun-extraction')"
        severity="secondary"
      />
    </div>

    <!-- Task Types List -->
    <div class="task-types-list">
      <TaskTypeCard
        v-for="taskType in taskTypes"
        :key="taskType.id"
        :task-type="taskType"
        :rules="getRulesForType(taskType.id)"
        :is-editing="editingTypeId === taskType.id"
        v-model:editing-name="editingTypeName"
        @start-edit="startEditType"
        @save-name="saveTypeName"
        @cancel-edit="cancelEditType"
        @delete="confirmDeleteType"
        @color-change="handleColorChange"
        @add-rule="handleAddRule"
        @remove-rule="handleRemoveRule"
        v-model:new-rule-tag="newRuleTags[taskType.id]"
      />
    </div>

    <!-- Add New Task Type -->
    <div class="add-task-type">
      <h4>Add New Task Type</h4>
      <div class="add-type-form">
        <div class="form-row">
          <div class="form-group">
            <label>Name</label>
            <InputText
              v-model="newTypeName"
              placeholder="e.g., 'Urgent', 'Maintenance'"
              class="new-type-input"
            />
          </div>
          <div class="form-group">
            <label>Description (optional)</label>
            <InputText
              v-model="newTypeDescription"
              placeholder="Brief description..."
              class="new-type-description"
            />
          </div>
          <div class="form-group color-group">
            <label>Color</label>
            <input 
              type="color" 
              v-model="newTypeColor"
              class="color-input"
            />
          </div>
        </div>
        <Button
          label="Add Type"
          icon="pi pi-plus"
          @click="handleAddType"
          :disabled="!newTypeName.trim()"
          :loading="saving"
        />
      </div>
    </div>

    <!-- Confirm Delete Dialog -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Delete Task Type"
      :modal="true"
      :closable="true"
      class="delete-dialog"
    >
      <div class="delete-dialog-content">
        <p>Are you sure you want to delete "{{ typeToDelete?.name }}"?</p>
        <div class="warning-text">
          <i class="pi pi-exclamation-triangle"></i>
          <span>Tasks currently assigned to this type will lose their type assignment.</span>
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          @click="deleteDialogVisible = false"
        />
        <Button
          label="Delete"
          severity="danger"
          @click="handleDeleteType"
          :loading="saving"
        />
      </template>
    </Dialog>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import { SectionCard, InfoBox, StatusBadge } from '@/components/common'
import TaskTypeCard from './TaskTypeCard.vue'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { formatDate } from '@/lib/formatDate'
import type { TaskType, ExtractionRun } from '@/types'

interface Props {
  extractionRun: ExtractionRun | null
  isExtracting: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'rerun-extraction'): void
}>()

const {
  taskTypes,
  saving,
  createTaskType,
  updateTaskType,
  deleteTaskType,
  addTaskTypeRule,
  removeTaskTypeRule,
  getRulesForTaskType
} = useTaskTypes()

// State
const newTypeName = ref('')
const newTypeDescription = ref('')
const newTypeColor = ref('#6366f1')
const newRuleTags = ref<Record<string, string>>({})
const editingTypeId = ref<string | null>(null)
const editingTypeName = ref('')
const deleteDialogVisible = ref(false)
const typeToDelete = ref<TaskType | null>(null)

const getRulesForType = (typeId: string) => getRulesForTaskType(typeId)

const handleAddType = async () => {
  if (!newTypeName.value.trim()) return
  
  await createTaskType({
    name: newTypeName.value.trim(),
    description: newTypeDescription.value.trim() || undefined,
    color: newTypeColor.value,
    is_default: false
  })
  
  newTypeName.value = ''
  newTypeDescription.value = ''
  newTypeColor.value = '#6366f1'
}

const startEditType = (taskType: TaskType) => {
  editingTypeId.value = taskType.id
  editingTypeName.value = taskType.name
}

const cancelEditType = () => {
  editingTypeId.value = null
  editingTypeName.value = ''
}

const saveTypeName = async (typeId: string) => {
  if (!editingTypeName.value.trim()) {
    cancelEditType()
    return
  }
  await updateTaskType(typeId, { name: editingTypeName.value.trim() })
  cancelEditType()
}

const confirmDeleteType = (taskType: TaskType) => {
  typeToDelete.value = taskType
  deleteDialogVisible.value = true
}

const handleDeleteType = async () => {
  if (!typeToDelete.value) return
  await deleteTaskType(typeToDelete.value.id)
  deleteDialogVisible.value = false
  typeToDelete.value = null
}

const handleColorChange = async (typeId: string, color: string) => {
  await updateTaskType(typeId, { color })
}

const handleAddRule = async (typeId: string) => {
  const tagName = newRuleTags.value[typeId]?.trim()
  if (!tagName) return
  await addTaskTypeRule(typeId, tagName)
  newRuleTags.value[typeId] = ''
}

const handleRemoveRule = async (ruleId: string) => {
  await removeTaskTypeRule(ruleId)
}
</script>

<style scoped>
/* Task Types List */
.task-types-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

/* Add New Task Type */
.add-task-type {
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.add-task-type h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.add-type-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

.new-type-input {
  width: 200px;
}

.new-type-description {
  width: 250px;
}

.color-input {
  width: 38px;
  height: 38px;
  padding: 0;
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  transition: all 0.15s ease;
}

.color-input:hover {
  transform: scale(1.05);
  border-color: var(--border-secondary);
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
}

.color-input::-moz-color-swatch {
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
}

/* Delete Dialog */
.delete-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.delete-dialog-content p {
  margin: 0;
  color: var(--text-primary);
}

.warning-text {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: #f87171;
}

.warning-text i {
  margin-top: 2px;
  flex-shrink: 0;
}

.warning-text span {
  line-height: 1.4;
}
</style>
