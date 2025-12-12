<template>
  <SectionCard
    title="Key Bindings"
    description="Customize keyboard shortcuts. Click on a key to change it."
  >
    <!-- Fixed shortcuts info -->
    <InfoBox title="Fixed shortcuts">
      Keys <strong>1-9</strong> and <strong>0</strong> switch to filter configs 1-10
    </InfoBox>

    <!-- Grouped shortcuts -->
    <div v-for="group in shortcutGroups" :key="group.id" class="keybinding-group">
      <h4 class="group-title">{{ group.label }}</h4>
      <div class="keybindings-grid">
        <div 
          v-for="action in group.actions" 
          :key="action" 
          class="keybinding-row"
        >
          <span class="keybinding-description">{{ keyBindings[action].description }}</span>
          <button 
            class="keybinding-key"
            :class="{ recording: recordingAction === action }"
            @click="startRecording(action)"
          >
            {{ recordingAction === action ? 'Press key...' : formatKeyForDisplay(keyBindings[action].key) }}
          </button>
        </div>
      </div>
    </div>

    <div class="keybindings-actions">
      <button class="reset-btn" @click="handleReset">
        <i class="pi pi-refresh"></i>
        Reset to Defaults
      </button>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { SectionCard, InfoBox } from '@/components/common'
import { useKeyBindings, type KeyBindings } from '@/composables/useKeyBindings'

const { keyBindings, updateBinding, resetToDefaults, formatKeyForDisplay } = useKeyBindings()

const recordingAction = ref<keyof KeyBindings | null>(null)

// Grouped shortcuts (excludes filter configs 1-9, 0 which are fixed)
const shortcutGroups: { id: string; label: string; actions: (keyof KeyBindings)[] }[] = [
  {
    id: 'navigation',
    label: 'Navigation',
    actions: ['navigateUp', 'navigateDown', 'navigateLeft', 'navigateRight']
  },
  {
    id: 'actions',
    label: 'Item Actions',
    actions: ['openLink', 'openDetail', 'closeDialog']
  },
  {
    id: 'config_mgmt',
    label: 'Config Management',
    actions: ['newConfig', 'deleteConfig', 'renameConfig']
  },
  {
    id: 'view',
    label: 'View',
    actions: ['focusSearch', 'toggleView', 'gridZoomIn', 'gridZoomOut']
  },
  {
    id: 'filters',
    label: 'Quick Filters',
    actions: ['focusProject', 'focusCostGroup', 'focusLocation', 'focusTags', 'focusInvolvedPerson']
  },
  {
    id: 'toggles',
    label: 'Type Toggles',
    actions: ['toggleEmails', 'toggleCraft', 'toggleFiles', 'toggleTaskType1', 'toggleTaskType2', 'toggleTaskType3']
  }
]

const startRecording = (action: keyof KeyBindings) => {
  recordingAction.value = action
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!recordingAction.value) return
  
  event.preventDefault()
  event.stopPropagation()
  
  // Use the key value directly
  const key = event.key
  
  updateBinding(recordingAction.value, key)
  recordingAction.value = null
}

const handleClickOutside = (event: MouseEvent) => {
  if (recordingAction.value) {
    const target = event.target as HTMLElement
    if (!target.classList.contains('keybinding-key')) {
      recordingAction.value = null
    }
  }
}

const handleReset = () => {
  resetToDefaults()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown, true)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
:deep(.info-box) {
  margin-bottom: 1.5rem;
}

:deep(.info-box strong) {
  font-family: 'JetBrains Mono', monospace;
}

.keybinding-group {
  margin-bottom: 1.5rem;
}

.keybinding-group:last-of-type {
  margin-bottom: 0;
}

.group-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem 0;
  padding-left: 0.25rem;
}

.keybindings-grid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.keybinding-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.keybinding-description {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.keybinding-key {
  min-width: 60px;
  padding: 0.4rem 0.65rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.keybinding-key:hover {
  border-color: var(--accent-primary);
  background: var(--bg-hover);
}

.keybinding-key.recording {
  border-color: var(--accent-primary);
  background: var(--accent-primary-dark);
  color: var(--accent-primary);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.keybindings-actions {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.reset-btn i {
  font-size: 0.9rem;
}
</style>

