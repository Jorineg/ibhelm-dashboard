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

    <!-- Main Content with Sidebar -->
    <div class="settings-layout">
      <!-- Sidebar Navigation -->
      <nav class="settings-sidebar">
        <ul class="sidebar-menu">
          <li 
            v-for="section in settingsSections" 
            :key="section.id"
            :class="{ active: activeSection === section.id }"
            @click="activeSection = section.id"
          >
            <i :class="section.icon"></i>
            <span>{{ section.label }}</span>
          </li>
        </ul>
      </nav>

      <!-- Settings Content -->
      <div class="settings-content">
        <!-- Task Types Section -->
        <section v-if="activeSection === 'task-types'" class="settings-section">
          <div class="section-header">
            <h2>Task Types</h2>
            <p class="section-description">
              Configure how Teamwork tasks are categorized based on their tags.
              Tasks with a matching tag will be assigned to that task type.
            </p>
            <div class="info-box">
              <i class="pi pi-info-circle"></i>
              <div>
                <strong>How rules are applied:</strong>
                <p>These rules are automatically applied to newly created tasks and tasks that are updated in Teamwork. 
                   To apply rules to all existing tasks in the database, use the "Re-run All Extractions" button below.</p>
              </div>
            </div>
          </div>

          <!-- Extraction Status & Re-run Button -->
          <div class="extraction-controls">
            <div class="extraction-info">
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
              <div v-else class="extraction-status">
                <span class="status-label">No extraction runs yet</span>
              </div>
            </div>
            
            <Button
              label="Re-run All Extractions"
              icon="pi pi-refresh"
              :loading="isExtracting"
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
                  <!-- Clickable color picker for existing types -->
                  <div 
                    class="task-type-color-btn"
                    :style="{ background: taskType.color || '#6366f1' }"
                    @click="openColorPicker(taskType)"
                    title="Click to change color"
                  >
                    <OverlayPanel ref="colorPickerOverlay" appendTo="body">
                      <div class="color-picker-panel">
                        <label>Choose color:</label>
                        <ColorPicker 
                          v-model="editingColor" 
                          inline 
                          @update:model-value="onColorChange"
                        />
                        <div class="color-picker-actions">
                          <Button label="Apply" size="small" @click="applyColorChange" />
                        </div>
                      </div>
                    </OverlayPanel>
                  </div>
                  <div class="task-type-details">
                    <template v-if="editingTypeId === taskType.id">
                      <InputText
                        v-model="editingTypeName"
                        class="edit-name-input"
                        @keyup.enter="saveTypeName(taskType.id)"
                        @keyup.escape="cancelEditType"
                        autofocus
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
        </section>

        <!-- Placeholder for future sections -->
        <section v-else-if="activeSection === 'general'" class="settings-section">
          <div class="section-header">
            <h2>General</h2>
            <p class="section-description">General application settings.</p>
          </div>
          <div class="placeholder-content">
            <i class="pi pi-cog"></i>
            <p>General settings will be available soon.</p>
          </div>
        </section>

        <section v-else-if="activeSection === 'appearance'" class="settings-section">
          <div class="section-header">
            <h2>Appearance</h2>
            <p class="section-description">Customize the look and feel of the application.</p>
          </div>
          <div class="placeholder-content">
            <i class="pi pi-palette"></i>
            <p>Appearance settings will be available soon.</p>
          </div>
        </section>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ColorPicker from 'primevue/colorpicker'
import Dialog from 'primevue/dialog'
import OverlayPanel from 'primevue/overlaypanel'
import { useAuth } from '@/composables/useAuth'
import { useTaskTypes } from '@/composables/useTaskTypes'
import type { TaskType } from '@/types'

const router = useRouter()
const { user, signOut } = useAuth()
const {
  taskTypes,
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

// Settings navigation
const settingsSections = [
  { id: 'task-types', label: 'Task Types', icon: 'pi pi-tags' },
  { id: 'general', label: 'General', icon: 'pi pi-cog' },
  { id: 'appearance', label: 'Appearance', icon: 'pi pi-palette' }
]
const activeSection = ref('task-types')

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
const isExtracting = ref(false)

// Color picker for existing types
const colorPickerOverlay = ref()
const editingColorTypeId = ref<string | null>(null)
const editingColor = ref('6366f1')

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
const openColorPicker = (taskType: TaskType, event?: Event) => {
  editingColorTypeId.value = taskType.id
  editingColor.value = taskType.color?.replace('#', '') || '6366f1'
  colorPickerOverlay.value?.toggle(event)
}

const onColorChange = () => {
  // Preview change immediately (optional)
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

// Close color picker when clicking outside
const closeColorPicker = () => {
  showNewColorPicker.value = false
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
  isExtracting.value = true
  try {
    const runId = await rerunExtraction()
    console.log('Extraction started with run ID:', runId)
    // The composable handles polling
  } catch (error) {
    console.error('Error starting extraction:', error)
  } finally {
    isExtracting.value = false
  }
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

// Initialize
onMounted(async () => {
  await initialize()
  await fetchLatestExtractionRun()
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
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

/* Settings Layout */
.settings-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* Sidebar */
.settings-sidebar {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 1rem 0;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 2rem;
  height: fit-content;
}

.sidebar-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-menu li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.95rem;
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
}

.sidebar-menu li:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.sidebar-menu li.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-left-color: var(--accent-primary, #6366f1);
  font-weight: 500;
}

.sidebar-menu li i {
  font-size: 1.1rem;
  width: 20px;
}

/* Settings Content */
.settings-content {
  min-width: 0;
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
  margin: 0 0 1rem 0;
}

.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
}

.info-box i {
  color: #818cf8;
  font-size: 1.1rem;
  margin-top: 2px;
}

.info-box strong {
  display: block;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.info-box p {
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
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

.task-type-color-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  margin-top: 2px;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 2px solid transparent;
}

.task-type-color-btn:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.3);
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

/* Color Picker Panel */
.color-picker-panel {
  padding: 0.5rem;
}

.color-picker-panel label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.color-picker-actions {
  margin-top: 0.75rem;
  display: flex;
  justify-content: flex-end;
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
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.5rem;
  box-shadow: var(--shadow-lg);
}

/* Placeholder Content */
.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-tertiary);
}

.placeholder-content i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.placeholder-content p {
  margin: 0;
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

/* Responsive */
@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
  
  .settings-sidebar {
    position: relative;
    top: 0;
  }
  
  .sidebar-menu {
    display: flex;
    overflow-x: auto;
    padding: 0 1rem;
  }
  
  .sidebar-menu li {
    padding: 0.75rem 1rem;
    border-left: none;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }
  
  .sidebar-menu li.active {
    border-left-color: transparent;
    border-bottom-color: var(--accent-primary, #6366f1);
  }
}
</style>
