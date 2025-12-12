<template>
  <div class="config-panel-wrapper">
    <!-- Collapsed Mini View (always rendered, invisible when expanded to preserve space) -->
    <div class="mini-config-bar" :class="{ invisible: isExpanded }">
      <button class="mini-expand-btn" @click="expand" title="Expand filter configurations">
        <i class="pi pi-chevron-right"></i>
      </button>
      <TransitionGroup name="config-list">
        <button
          v-for="config in sortedConfigurations"
          :key="config.id"
          :class="['mini-config-item', { 
            active: config.id === activeConfigId,
            dragging: draggedConfigId === config.id
          }]"
          @click="handleMiniConfigClick(config.id)"
          :title="config.name"
          :tabindex="isExpanded ? -1 : 0"
          draggable="true"
          @dragstart="onConfigDragStart($event, config.id)"
          @dragover="onConfigDragOver($event, config.id)"
          @drop="onConfigDrop"
          @dragend="onConfigDragEnd"
        >
          {{ truncateName(config.name) }}
        </button>
      </TransitionGroup>
    </div>

    <!-- Expanded Panel (floating) -->
    <div v-if="isExpanded" ref="panelRef" class="configuration-panel">
      <div class="panel-header">
        <h3>Filter Configurations for <span class="view-badge">{{ viewLabel }}</span></h3>
        <Button
          icon="pi pi-plus"
          label="New"
          size="small"
          @click="handleCreateConfig"
          class="new-config-btn"
        />
      </div>

      <div class="configurations-list thin-scrollbar">
        <div
          v-for="config in configurations"
          :key="config.id"
          :class="['config-item', { active: config.id === activeConfigId }]"
          @click="handleConfigClick(config.id)"
        >
          <i class="pi pi-filter config-icon"></i>
          <span class="config-name">{{ config.name }}</span>
          <span class="config-date">{{ formatDate(config.updatedAt) }}</span>
        </div>
      </div>

      <Divider />

      <!-- Active configuration controls -->
      <div v-if="activeConfig" class="active-config-controls">
        <h4>Active Configuration</h4>
        
        <div class="control-group">
          <label for="config-name">Name</label>
          <InputText
            ref="configNameInputRef"
            id="config-name"
            :model-value="activeConfig.name"
            @update:model-value="handleUpdateName"
            placeholder="Configuration name"
            class="config-name-input"
          />
        </div>

        <div class="control-buttons">
          <Button
            label="Duplicate"
            icon="pi pi-copy"
            outlined
            size="small"
            @click="handleDuplicate"
          />
          
          <Button
            label="Delete"
            icon="pi pi-trash"
            outlined
            severity="danger"
            size="small"
            @click="handleDelete"
            :disabled="configurations.length <= 1"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Divider from 'primevue/divider'
import { useFilterConfigs } from '@/composables/useFilterConfigs'

const {
  configurations,
  activeConfig,
  activeConfigId,
  currentViewType,
  createConfiguration,
  duplicateConfiguration,
  deleteConfiguration,
  updateConfiguration,
  setActiveConfiguration,
  updateConfigOrder
} = useFilterConfigs()

// Drag and drop state for mini config bar
const draggedConfigId = ref<string | null>(null)
const previewOrder = ref<string[] | null>(null)
let lastSwapTime = 0

// Sorted configurations with live preview during drag
const sortedConfigurations = computed(() => {
  if (previewOrder.value) {
    return previewOrder.value
      .map(id => configurations.value.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c != null)
  }
  return configurations.value
})

const onConfigDragStart = (e: DragEvent, configId: string) => {
  draggedConfigId.value = configId
  previewOrder.value = configurations.value.map(c => c.id)
  lastSwapTime = 0
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', configId)
  }
}

const onConfigDragOver = (e: DragEvent, configId: string) => {
  e.preventDefault()
  if (!draggedConfigId.value || draggedConfigId.value === configId || !previewOrder.value) return
  
  // Throttle swaps to prevent flickering
  const now = Date.now()
  if (now - lastSwapTime < 150) return
  
  const currentIdx = previewOrder.value.indexOf(draggedConfigId.value)
  const targetIdx = previewOrder.value.indexOf(configId)
  if (currentIdx === -1 || targetIdx === -1 || currentIdx === targetIdx) return
  
  // Move item to new position
  const newOrder = [...previewOrder.value]
  newOrder.splice(currentIdx, 1)
  newOrder.splice(targetIdx, 0, draggedConfigId.value)
  previewOrder.value = newOrder
  lastSwapTime = now
}

const onConfigDrop = (e: DragEvent) => {
  e.preventDefault()
  if (previewOrder.value) {
    updateConfigOrder(previewOrder.value)
  }
  draggedConfigId.value = null
  previewOrder.value = null
}

const onConfigDragEnd = () => {
  if (previewOrder.value) {
    updateConfigOrder(previewOrder.value)
  }
  draggedConfigId.value = null
  previewOrder.value = null
}

const isExpanded = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const configNameInputRef = ref<InstanceType<typeof InputText> | null>(null)

// Truncate config name for mini view (no ellipsis)
const truncateName = (name: string) => {
  return name.slice(0, 10)
}

const focusNameInput = () => {
  nextTick(() => {
    const input = configNameInputRef.value?.$el as HTMLInputElement | undefined
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const expand = () => {
  isExpanded.value = true
  focusNameInput()
}

const collapse = () => {
  isExpanded.value = false
}

const toggle = () => {
  if (isExpanded.value) {
    collapse()
  } else {
    expand()
  }
}

defineExpose({ expand, collapse, toggle, isExpanded })

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  if (!isExpanded.value) return
  const target = event.target as HTMLElement
  if (panelRef.value && !panelRef.value.contains(target)) {
    collapse()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})

// View label for the header badge
const viewLabel = computed(() => {
  switch (currentViewType.value) {
    case 'items': return 'ITEMS'
    case 'projects': return 'PROJECTS'
    case 'people': return 'PEOPLE'
    default: return ''
  }
})

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const handleCreateConfig = () => {
  createConfiguration()
}

const handleDuplicate = () => {
  if (activeConfig.value) {
    duplicateConfiguration(activeConfig.value.id)
  }
}

const handleDelete = () => {
  if (activeConfig.value && configurations.value.length > 1) {
    if (confirm(`Delete configuration "${activeConfig.value.name}"?`)) {
      deleteConfiguration(activeConfig.value.id)
    }
  }
}

const handleUpdateName = (name: string) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { name })
  }
}

const handleConfigClick = (configId: string) => {
  if (configId === activeConfigId.value) {
    // Same config clicked - close the popup
    collapse()
  } else {
    setActiveConfiguration(configId)
  }
}

const handleMiniConfigClick = (configId: string) => {
  if (configId === activeConfigId.value) {
    // Same config clicked - open the popup
    expand()
  } else {
    setActiveConfiguration(configId)
  }
}
</script>

<style scoped>
.config-panel-wrapper {
  padding-right: 1rem;
  position: relative;
  flex-shrink: 0;
}

/* Mini Config Bar (collapsed state) */
.mini-config-bar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: opacity 0.15s ease;
}

.mini-config-bar.invisible {
  opacity: 0;
  pointer-events: none;
}

.mini-config-item {
  padding: 0.5rem 0.65rem;
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: 500;
  cursor: grab;
  transition: background var(--transition-normal), border-color var(--transition-normal), 
              color var(--transition-normal), opacity 0.15s, transform 0.2s ease;
  white-space: nowrap;
  text-align: left;
}

.mini-config-item:active {
  cursor: grabbing;
}

.mini-config-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.mini-config-item.active {
  background: var(--accent-primary-dark);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.mini-config-item.dragging {
  opacity: 0.4;
  transform: scale(0.95);
}

/* Move transition for reordering */
.config-list-move {
  transition: transform 0.2s ease;
}

.mini-expand-btn {
  height: 3rem;
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.mini-expand-btn:hover {
  background: var(--accent-primary-dark);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

/* Expanded Panel (floating) */
.configuration-panel {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 99999;
  background: var(--bg-secondary);
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-primary);
  min-width: 280px;
  max-width: 320px;
  max-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.new-config-btn {
  width: 100%;
}

.view-badge {
  padding: 0.2rem 0.5rem;
  background: var(--accent-primary-dark, rgba(99, 102, 241, 0.15));
  color: var(--accent-primary, #6366f1);
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.configurations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding-right: 0.25rem;
  flex: 1;
  min-height: 0;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 2px solid transparent;
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.config-item:hover {
  background: var(--bg-hover);
}

.config-item.active {
  background: var(--accent-primary-dark);
  border-color: var(--accent-primary);
}

.config-icon {
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.config-item.active .config-icon {
  color: var(--accent-primary);
}

.config-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.config-date {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

.active-config-controls {
  padding-top: 1rem;
  flex-shrink: 0;
}

.active-config-controls h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

.config-name-input {
  width: 100%;
}

.control-buttons {
  display: flex;
  gap: 0.5rem;
}

.control-buttons button {
  flex: 1;
}
</style>
