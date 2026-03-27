<template>
  <div 
    ref="triggerRef"
    class="tooltip-wrapper"
    :class="{ 'tooltip-block': block }"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focus="showTooltip"
    @blur="hideTooltip"
  >
    <slot />
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div 
          v-if="visible && !tooltipsDisabled && (text || shortcuts?.length)" 
          class="tooltip-content" 
          :style="tooltipStyle"
          :class="{ 'has-shortcut': shortcut, 'has-shortcuts': shortcuts?.length }"
        >
          <!-- Simple mode: text + optional single shortcut -->
          <template v-if="!shortcuts?.length">
            <span class="tooltip-text">{{ text }}</span>
            <kbd v-if="shortcut" class="tooltip-shortcut">{{ formatShortcut(shortcut) }}</kbd>
          </template>
          <!-- Multi-shortcut mode: list of label + shortcut pairs -->
          <template v-else>
            <span v-if="text" class="tooltip-text">{{ text }}</span>
            <div class="tooltip-shortcuts-list">
              <div v-for="(s, i) in shortcuts" :key="i" class="tooltip-shortcut-row">
                <span class="shortcut-label">{{ s.label }}</span>
                <kbd class="tooltip-shortcut">{{ formatShortcut(s.key) }}</kbd>
              </div>
            </div>
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserSettings } from '@/composables/useUserSettings'

interface ShortcutItem {
  label: string
  key: string
}

interface Props {
  text?: string
  shortcut?: string
  shortcuts?: ShortcutItem[] // For multiple shortcuts with labels
  position?: 'top' | 'bottom' | 'left' | 'right'
  block?: boolean // Use display: block instead of inline-flex (for full-width elements)
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
  block: false
})

const { tooltipsDisabled } = useUserSettings()

const triggerRef = ref<HTMLElement | null>(null)
const visible = ref(false)
const rect = ref<DOMRect | null>(null)

const showTooltip = () => {
  if (triggerRef.value) {
    rect.value = triggerRef.value.getBoundingClientRect()
  }
  visible.value = true
}

const hideTooltip = () => {
  visible.value = false
}

const tooltipStyle = computed(() => {
  if (!rect.value) return {}
  
  const gap = 6
  const r = rect.value
  
  switch (props.position) {
    case 'top':
      return {
        left: `${r.left + r.width / 2}px`,
        top: `${r.top - gap}px`,
        transform: 'translate(-50%, -100%)'
      }
    case 'bottom':
      return {
        left: `${r.left + r.width / 2}px`,
        top: `${r.bottom + gap}px`,
        transform: 'translateX(-50%)'
      }
    case 'left': {
      // Anchor right edge to the left of the trigger so the panel grows leftward
      // (avoids overflow past the viewport when the trigger sits on the right edge).
      const vw = typeof window !== 'undefined' ? window.innerWidth : 0
      return {
        right: `${vw - r.left + gap}px`,
        top: `${r.top + r.height / 2}px`,
        transform: 'translateY(-50%)',
        left: 'auto',
      }
    }
    case 'right':
      return {
        left: `${r.right + gap}px`,
        top: `${r.top + r.height / 2}px`,
        transform: 'translateY(-50%)'
      }
  }
})

const formatShortcut = (shortcut: string): string => {
  const keyMap: Record<string, string> = {
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '↵',
    'Escape': 'Esc',
    ' ': 'Space',
    'Shift': '⇧',
  }
  return shortcut.split('+').map(part => {
    const trimmed = part.trim()
    return keyMap[trimmed] || trimmed.toUpperCase()
  }).join(' + ')
}
</script>

<style>
/* Global styles (not scoped) because tooltip is teleported to body */
.tooltip-content {
  position: fixed;
  z-index: 999999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.65rem;
  background: #1a1a1a;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: pre-line;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.tooltip-content.has-shortcut {
  gap: 0.6rem;
}

.tooltip-content.has-shortcuts {
  flex-direction: column;
  align-items: stretch;
  gap: 0.35rem;
}

.tooltip-shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tooltip-shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tooltip-shortcut-row .shortcut-label {
  color: var(--text-tertiary);
  font-size: 0.7rem;
}

.tooltip-content .tooltip-text {
  color: var(--text-secondary);
}

.tooltip-content .tooltip-shortcut {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  padding: 0.15rem 0.35rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--text-primary);
  box-shadow: 0 1px 0 var(--border-secondary);
}

/* Transitions */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.15s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>

<style scoped>
.tooltip-wrapper {
  display: inline-flex;
}

.tooltip-wrapper.tooltip-block {
  display: block;
}
</style>
