<template>
  <div class="settings-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <button class="back-btn" @click="goBack">
          <i class="pi pi-arrow-left"></i>
        </button>
        <h1>Settings</h1>
      </div>
      
      <div class="header-actions">
        <span class="user-email">{{ user?.email }}</span>
        <Button
          label="Sign Out"
          icon="pi pi-sign-out"
          @click="handleSignOut"
          outlined
          class="sign-out-btn"
        />
      </div>
    </div>

    <!-- Main Content -->
    <div class="settings-content">
      <!-- Task Types Section -->
      <section class="settings-section">
        <div class="section-header">
          <h2>Task Types</h2>
          <p class="section-description">
            Configure how Teamwork tasks are categorized based on their tags.
            When a task has a matching tag, it will be assigned to that task type.
          </p>
        </div>

        <!-- Extraction Status & Re-run Button -->
        <div class="extraction-controls">
          <div class="extraction-status" v-if="extractionRun">
            <span class="status-label">Last extraction:</span>
            <span :class="['status-badge', extractionRun.status]">
              {{ extractionRun.status }}
            </span>
            <span v-if="extractionRun.status === 'running'" class="progress-info">
              {{ extractionRun.processed_count }} / {{ extractionRun.total_count }}
              ({{ extractionRun.progress_percent }}%)
            </span>
            <span v-else-if="extractionRun.completed_at" class="time-info">
              {{ formatDate(extractionRun.completed_at) }}
            </span>
          </div>
          
          <Button
            label="Re-run All Extractions"
            icon="pi pi-refresh"
            :loading="extractionRun?.status === 'running'"
            @click="handleRerunExtraction"
            severity="secondary"
            class="rerun-btn"
          />
        </div>

        <!-- Task Types List -->
        <div class="task-types-list">
          <div 
            v-for="taskType in taskTypes" 
            :key="taskType.id"
            class="task-type-card"
            :class="{ 'is-default': taskType.is_default }"
          >
            <div class="task-type-header">
              <div class="task-type-info">
                <div 
                  class="task-type-color"
                  :style="{ background: taskType.color || '#6366f1' }"
                ></div>
                <div class="task-type-details">
                  <template v-if="editingTypeId === taskType.id">
                    <InputText
                      v-model="editingTypeName"
                      class="edit-name-input"
                      @keyup.enter="saveTypeName(taskType.id)"
                      @keyup.escape="cancelEditType"
                    />
                  </template>
                  <template v-else>
                    <h3>
                      {{ taskType.name }}
                      <span v-if="taskType.is_default" class="default-badge">Default</span>
                    </h3>
                    <p v-if="taskType.description" class="type-description">
                      {{ taskType.description }}
                    </p>
                  </template>
                </div>
              </div>
              
              <div class="task-type-actions">
                <template v-if="editingTypeId === taskType.id">
                  <Button
                    icon="pi pi-check"
                    text
                    rounded
                    severity="success"
                    @click="saveTypeName(taskType.id)"
                  />
                  <Button
                    icon="pi pi-times"
                    text
                    rounded
                    severity="secondary"
                    @click="cancelEditType"
                  />
                </template>
                <template v-else>
                  <Button
                    icon="pi pi-pencil"
                    text
                    rounded
                    severity="secondary"
                    @click="startEditType(taskType)"
                    title="Edit name"
                  />
                  <Button
                    v-if="!taskType.is_default"
                    icon="pi pi-trash"
                    text
                    rounded
                    severity="danger"
                    @click="confirmDeleteType(taskType)"
                    title="Delete type"
                  />
                </template>
              </div>
            </div>

            <!-- Rules for this type (not for default) -->
            <div v-if="!taskType.is_default" class="task-type-rules">
              <div class="rules-header">
                <span class="rules-label">Matching Tags:</span>
                <span class="rules-hint">Tasks with any of these tags will be categorized as "{{ taskType.name }}"</span>
              </div>
              
              <div class="rules-list">
                <div 
                  v-for="rule in getRulesForType(taskType.id)" 
                  :key="rule.id"
                  class="rule-tag"
                >
                  <span>{{ rule.teamwork_tag_name }}</span>
                  <button class="remove-rule-btn" @click="handleRemoveRule(rule.id)">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
                
                <!-- Add new rule input -->
                <div class="add-rule-wrapper">
                  <InputText
                    v-model="newRuleTags[taskType.id]"
                    placeholder="Add tag..."
                    class="add-rule-input"
                    @keyup.enter="handleAddRule(taskType.id)"
                  />
                  <Button
                    icon="pi pi-plus"
                    text
                    rounded
                    size="small"
                    @click="handleAddRule(taskType.id)"
                    :disabled="!newRuleTags[taskType.id]?.trim()"
                  />
                </div>
              </div>
            </div>

            <!-- Default type info -->
            <div v-else class="default-type-info">
              <i class="pi pi-info-circle"></i>
              <span>This is the default type. Tasks that don't match any tag rules will be assigned here.</span>
            </div>
          </div>
        </div>

        <!-- Add New Task Type -->
        <div class="add-task-type">
          <h4>Add New Task Type</h4>
          <div class="add-type-form">
            <InputText
              v-model="newTypeName"
              placeholder="Type name (e.g., 'Urgent', 'Maintenance')"
              class="new-type-input"
            />
            <InputText
              v-model="newTypeDescription"
              placeholder="Description (optional)"
              class="new-type-description"
            />
            <ColorPicker v-model="newTypeColor" class="new-type-color" />
            <Button
              label="Add Type"
              icon="pi pi-plus"
              @click="handleAddType"
              :disabled="!newTypeName.trim()"
              :loading="saving"
            />
          </div>
        </div>
      </section>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ColorPicker from 'primevue/colorpicker'
import Dialog from 'primevue/dialog'
import { useAuth } from '@/composables/useAuth'
import { useTaskTypes } from '@/composables/useTaskTypes'
import type { TaskType } from '@/types'

const router = useRouter()
const { user, signOut } = useAuth()
const {
  taskTypes,
  taskTypeRules,
  saving,
  extractionRun,
  initialize,
  createTaskType,
  updateTaskType,
  deleteTaskType,
  addTaskTypeRule,
  removeTaskTypeRule,
  getRulesForTaskType,
  rerunExtraction,
  fetchLatestExtractionRun
} = useTaskTypes()

// State
const newTypeName = ref('')
const newTypeDescription = ref('')
const newTypeColor = ref('6366f1')
const newRuleTags = ref<Record<string, string>>({})
const editingTypeId = ref<string | null>(null)
const editingTypeName = ref('')
const deleteDialogVisible = ref(false)
const typeToDelete = ref<TaskType | null>(null)

// Navigation
const goBack = () => {
  router.push('/')
}

const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

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

// Extraction
const handleRerunExtraction = async () => {
  await rerunExtraction()
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

// Initialize
onMounted(async () => {
  await initialize()
  await fetchLatestExtractionRun()
})
</script>

<style scoped>
.settings-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem 2rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.user-email {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.settings-content {
  max-width: 900px;
  margin: 0 auto;
}

.settings-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: var(--shadow-md);
}

.section-header {
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.section-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

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

.extraction-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-label {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.running {
  background: rgba(245, 166, 35, 0.2);
  color: #f5a623;
}

.status-badge.completed {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.status-badge.failed {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
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

.task-type-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  transition: all 0.15s ease;
}

.task-type-card:hover {
  border-color: var(--border-secondary);
}

.task-type-card.is-default {
  border-color: rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.05);
}

.task-type-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-type-info {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.task-type-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-top: 4px;
  flex-shrink: 0;
}

.task-type-details h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.default-badge {
  padding: 0.15rem 0.5rem;
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.type-description {
  color: var(--text-tertiary);
  font-size: 0.85rem;
  margin: 0.25rem 0 0 0;
}

.task-type-actions {
  display: flex;
  gap: 0.25rem;
}

.edit-name-input {
  width: 200px;
}

/* Rules */
.task-type-rules {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.rules-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.rules-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.rules-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.rules-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.rule-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-primary);
}

.remove-rule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.remove-rule-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.add-rule-wrapper {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.add-rule-input {
  width: 140px;
  font-size: 0.85rem !important;
}

/* Default Type Info */
.default-type-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.default-type-info i {
  color: #818cf8;
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
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.new-type-input {
  width: 200px;
}

.new-type-description {
  width: 250px;
}

/* Delete Dialog */
.delete-dialog {
  max-width: 400px;
}

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

