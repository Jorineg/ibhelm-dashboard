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
    <div class="extraction-controls">
      <div class="extraction-info">
        <div class="extraction-status" v-if="extractionRun">
          <span class="status-label">Last extraction:</span>
          <StatusBadge :status="extractionRun.status" />
          <span v-if="extractionRun.status === 'running'" class="progress-info">
            {{ extractionRun.processed_count }} / {{ extractionRun.total_count }}
            ({{ extractionRun.progress_percent }}%)
          </span>
          <span v-else-if="extractionRun.completed_at" class="time-info">
            {{ formatDate(extractionRun.completed_at) }}
          </span>
        </div>
        <div v-else class="extraction-status">
          <span class="status-label">No extraction runs yet</span>
        </div>
      </div>
      
      <Button
        label="Re-run All Extractions"
        icon="pi pi-refresh"
        :loading="isExtracting"
        @click="$emit('rerun-extraction')"
        severity="secondary"
        class="rerun-btn"
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
        @color-click="openColorPicker"
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
            <div class="color-input-wrapper">
              <div 
                class="color-preview" 
                :style="{ background: `#${newTypeColor}` }"
                @click="toggleNewColorPicker"
              ></div>
              <div v-if="showNewColorPicker" class="color-picker-dropdown">
                <ColorPicker v-model="newTypeColor" inline />
              </div>
            </div>
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

    <!-- Color Picker Overlay -->
    <OverlayPanel 
      ref="colorPickerOverlay" 
      appendTo="body"
      class="color-picker-overlay"
    >
      <div class="color-picker-panel">
        <label>Choose color:</label>
        <ColorPicker 
          v-model="editingColor" 
          inline 
        />
        <div class="color-picker-actions">
          <Button label="Apply" size="small" @click="applyColorChange" />
        </div>
      </div>
    </OverlayPanel>

    <!-- Confirm Delete Dialog -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Delete Task Type"
      :modal="true"
      :closable="true"
      class="delete-dialog"
    >
      <p>Are you sure you want to delete "{{ typeToDelete?.name }}"?</p>
      <p class="warning-text">
        <i class="pi pi-exclamation-triangle"></i>
        Tasks currently assigned to this type will lose their type assignment.
      </p>
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
import { ref, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ColorPicker from 'primevue/colorpicker'
import Dialog from 'primevue/dialog'
import OverlayPanel from 'primevue/overlaypanel'
import { SectionCard, InfoBox, StatusBadge } from '@/components/common'
import TaskTypeCard from './TaskTypeCard.vue'
import { useTaskTypes } from '@/composables/useTaskTypes'
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
const newTypeColor = ref('6366f1')
const showNewColorPicker = ref(false)
const newRuleTags = ref<Record<string, string>>({})
const editingTypeId = ref<string | null>(null)
const editingTypeName = ref('')
const deleteDialogVisible = ref(false)
const typeToDelete = ref<TaskType | null>(null)

// Color picker for existing types
const colorPickerOverlay = ref()
const editingColorTypeId = ref<string | null>(null)
const editingColor = ref('6366f1')

// Get rules for a specific type
const getRulesForType = (typeId: string) => {
  return getRulesForTaskType(typeId)
}

// Task Type CRUD
const handleAddType = async () => {
  if (!newTypeName.value.trim()) return
  
  await createTaskType({
    name: newTypeName.value.trim(),
    description: newTypeDescription.value.trim() || undefined,
    color: `#${newTypeColor.value}`,
    is_default: false
  })
  
  newTypeName.value = ''
  newTypeDescription.value = ''
  newTypeColor.value = '6366f1'
  showNewColorPicker.value = false
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

// Color picker for existing types
const openColorPicker = (taskType: TaskType, event: Event) => {
  editingColorTypeId.value = taskType.id
  editingColor.value = taskType.color?.replace('#', '') || '6366f1'
  colorPickerOverlay.value?.toggle(event)
}

const applyColorChange = async () => {
  if (editingColorTypeId.value) {
    await updateTaskType(editingColorTypeId.value, { color: `#${editingColor.value}` })
    colorPickerOverlay.value?.hide()
    editingColorTypeId.value = null
  }
}

const toggleNewColorPicker = (event: Event) => {
  event.stopPropagation()
  showNewColorPicker.value = !showNewColorPicker.value
}

// Rule CRUD
const handleAddRule = async (typeId: string) => {
  const tagName = newRuleTags.value[typeId]?.trim()
  if (!tagName) return
  
  await addTaskTypeRule(typeId, tagName)
  newRuleTags.value[typeId] = ''
}

const handleRemoveRule = async (ruleId: string) => {
  await removeTaskTypeRule(ruleId)
}

// Formatting
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Handle clicking outside color picker
const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.color-input-wrapper')) {
    showNewColorPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
/* Extraction Controls */
.extraction-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.extraction-info {
  flex: 1;
}

.extraction-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-label {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.progress-info,
.time-info {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

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

.color-group {
  position: relative;
}

.color-input-wrapper {
  position: relative;
}

.color-preview {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 2px solid var(--border-primary);
  transition: all 0.15s ease;
}

.color-preview:hover {
  transform: scale(1.05);
  border-color: var(--border-secondary);
}

.color-picker-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 1rem;
  box-shadow: var(--shadow-lg);
}

/* Color Picker Panel */
.color-picker-panel {
  padding: 1rem 1.25rem;
}

.color-picker-panel label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.color-picker-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

/* Delete Dialog */
.warning-text {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: #f87171;
  margin-top: 1rem;
}

.warning-text i {
  margin-top: 2px;
}
</style>

