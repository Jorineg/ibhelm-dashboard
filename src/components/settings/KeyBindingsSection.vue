<template>
  <SectionCard
    title="Key Bindings"
    description="Customize keyboard shortcuts. Click on a key to change it."
  >
    <div class="keybindings-grid">
      <div 
        v-for="(binding, action) in keyBindings" 
        :key="action" 
        class="keybinding-row"
      >
        <span class="keybinding-description">{{ binding.description }}</span>
        <button 
          class="keybinding-key"
          :class="{ recording: recordingAction === action }"
          @click="startRecording(action)"
        >
          {{ recordingAction === action ? 'Press key...' : formatKeyForDisplay(binding.key) }}
        </button>
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
import { SectionCard } from '@/components/common'
import { useKeyBindings, type KeyBindings } from '@/composables/useKeyBindings'

const { keyBindings, updateBinding, resetToDefaults, formatKeyForDisplay } = useKeyBindings()

const recordingAction = ref<keyof KeyBindings | null>(null)

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
.keybindings-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.keybinding-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.keybinding-description {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.keybinding-key {
  min-width: 60px;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
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

