<template>
  <div class="config-panel-wrapper">
    <div class="mini-config-bar">
      <TransitionGroup name="config-list">
        <div
          v-for="config in sortedConfigurations"
          :key="config.id"
          class="config-item-wrapper"
          @mouseenter="hoveredConfigId = config.id"
          @mouseleave="hoveredConfigId = null"
        >
          <button
            :class="['mini-config-item', { 
              active: config.id === activeConfigId,
              dragging: draggedConfigId === config.id
            }]"
            @click="handleConfigClick(config.id)"
            :title="config.name"
            draggable="true"
            @dragstart="onConfigDragStart($event, config.id)"
            @dragover="onConfigDragOver($event, config.id)"
            @drop="onConfigDrop"
            @dragend="onConfigDragEnd"
          >
            <span v-if="!isRenaming(config.id)" class="config-name">{{ truncateName(config.name) }}</span>
            <input
              v-else
              ref="renameInputRef"
              v-model="renameValue"
              class="rename-input"
              @blur="finishRename"
              @keydown.enter="finishRename"
              @keydown.escape="cancelRename"
              @click.stop
            />
          </button>
          
          <!-- Three dots menu button (outside button, positioned over it) -->
          <span 
            v-if="config.id === activeConfigId && !isRenaming(config.id) && (hoveredConfigId === config.id || openMenuId === config.id)"
            class="config-menu-btn" 
            @click="toggleMenu(config.id)"
            title="Configuration options"
            ref="menuRef"
          >
            <i class="pi pi-ellipsis-v"></i>
          </span>
          
          <!-- Dropdown menu -->
          <Transition name="dropdown">
            <div v-if="openMenuId === config.id" class="config-dropdown dropdown-panel">
              <div class="dropdown-item" @click="startRename(config.id, config.name)">
                <i class="pi pi-pencil"></i>
                <span>Rename</span>
              </div>
              <div class="dropdown-item" @click="handleDuplicate(config.id)">
                <i class="pi pi-copy"></i>
                <span>Duplicate</span>
              </div>
              <div 
                class="dropdown-item danger" 
                :class="{ disabled: configurations.length <= 1 }"
                @click="handleDelete(config.id)"
              >
                <i class="pi pi-trash"></i>
                <span>Delete</span>
              </div>
            </div>
          </Transition>
        </div>
      </TransitionGroup>
      
      <!-- Add new config button -->
      <button class="add-config-btn" @click="handleCreateConfig" title="New configuration">
        <i class="pi pi-plus"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useFilterConfigs } from '@/composables/useFilterConfigs'

const {
  configurations,
  activeConfigId,
  createConfiguration,
  duplicateConfiguration,
  deleteConfiguration,
  updateConfiguration,
  setActiveConfiguration,
  updateConfigOrder
} = useFilterConfigs()

// Drag and drop state
const draggedConfigId = ref<string | null>(null)
const previewOrder = ref<string[] | null>(null)
let lastSwapTime = 0

// Menu state
const openMenuId = ref<string | null>(null)
const menuRef = ref<HTMLElement[] | null>(null)
const hoveredConfigId = ref<string | null>(null)

// Rename state
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement[] | null>(null)

const isRenaming = (configId: string) => renamingId.value === configId

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
  
  const now = Date.now()
  if (now - lastSwapTime < 150) return
  
  const currentIdx = previewOrder.value.indexOf(draggedConfigId.value)
  const targetIdx = previewOrder.value.indexOf(configId)
  if (currentIdx === -1 || targetIdx === -1 || currentIdx === targetIdx) return
  
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

const truncateName = (name: string) => name.slice(0, 10)

const handleConfigClick = (configId: string) => {
  if (configId !== activeConfigId.value) {
    setActiveConfiguration(configId)
  }
  closeMenu()
}

const toggleMenu = (configId: string) => {
  openMenuId.value = openMenuId.value === configId ? null : configId
}

const closeMenu = () => {
  openMenuId.value = null
}

const handleCreateConfig = () => {
  createConfiguration()
  closeMenu()
}

const handleDuplicate = (configId: string) => {
  duplicateConfiguration(configId)
  closeMenu()
}

const handleDelete = (configId: string) => {
  if (configurations.value.length <= 1) return
  deleteConfiguration(configId)
  closeMenu()
}

const startRename = (configId: string, currentName: string) => {
  renamingId.value = configId
  renameValue.value = currentName
  closeMenu()
  nextTick(() => {
    if (renameInputRef.value && renameInputRef.value[0]) {
      renameInputRef.value[0].focus()
      renameInputRef.value[0].select()
    }
  })
}

const finishRename = () => {
  if (renamingId.value && renameValue.value.trim()) {
    updateConfiguration(renamingId.value, { name: renameValue.value.trim() })
  }
  renamingId.value = null
  renameValue.value = ''
}

const cancelRename = () => {
  renamingId.value = null
  renameValue.value = ''
}

// Click outside handler for menu
const handleClickOutside = (event: MouseEvent) => {
  if (!openMenuId.value) return
  const target = event.target as HTMLElement
  if (menuRef.value && !menuRef.value.some(el => el?.contains(target))) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<style scoped>
.config-panel-wrapper {
  padding-right: 1rem;
  position: relative;
  flex-shrink: 0;
}

.mini-config-bar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 7rem;
}

.config-item-wrapper {
  position: relative;
}

.mini-config-item {
  position: relative;
  width: 100%;
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
  overflow: hidden;
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

.config-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rename-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 500;
  padding: 0;
  margin: 0;
  outline: none;
}

/* Move transition for reordering */
.config-list-move {
  transition: transform 0.2s ease;
}

/* Three dots menu button - positioned over the config button */
.config-menu-btn {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%);
  background: var(--accent-primary-dark);
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0.2rem 0.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-normal);
  z-index: 2;
  opacity: 0.7;
}

.config-menu-btn:hover {
  opacity: 1;
  color: var(--text-primary);
}

/* Dropdown menu - opens to the right */
.config-dropdown {
  position: absolute;
  top: 0;
  left: 100%;
  margin-left: 0.25rem;
  min-width: 140px;
  z-index: 1000;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  transition: background var(--transition-normal);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-item.danger {
  color: var(--color-danger);
}

.dropdown-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.dropdown-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropdown-item.disabled:hover {
  background: transparent;
}

.dropdown-item i {
  font-size: 0.9rem;
  width: 1rem;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

/* Add config button */
.add-config-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 0.65rem;
  background: transparent;
  border: 1px dashed var(--border-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-config-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
</style>
