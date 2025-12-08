import { ref, onMounted, onUnmounted, computed } from 'vue'

export interface KeyBinding {
  key: string
  description: string
}

export interface KeyBindings {
  filterConfig1: KeyBinding
  filterConfig2: KeyBinding
  filterConfig3: KeyBinding
  filterConfig4: KeyBinding
  filterConfig5: KeyBinding
  filterConfig6: KeyBinding
  filterConfig7: KeyBinding
  filterConfig8: KeyBinding
  filterConfig9: KeyBinding
  navigateUp: KeyBinding
  navigateDown: KeyBinding
  navigateLeft: KeyBinding
  navigateRight: KeyBinding
  openLink: KeyBinding
  openDetail: KeyBinding
  closeDialog: KeyBinding
  newConfig: KeyBinding
  deleteConfig: KeyBinding
  focusSearch: KeyBinding
  toggleView: KeyBinding
}

const STORAGE_KEY = 'ibhelm_key_bindings'

const defaultBindings: KeyBindings = {
  filterConfig1: { key: '1', description: 'Switch to filter config 1' },
  filterConfig2: { key: '2', description: 'Switch to filter config 2' },
  filterConfig3: { key: '3', description: 'Switch to filter config 3' },
  filterConfig4: { key: '4', description: 'Switch to filter config 4' },
  filterConfig5: { key: '5', description: 'Switch to filter config 5' },
  filterConfig6: { key: '6', description: 'Switch to filter config 6' },
  filterConfig7: { key: '7', description: 'Switch to filter config 7' },
  filterConfig8: { key: '8', description: 'Switch to filter config 8' },
  filterConfig9: { key: '9', description: 'Switch to filter config 9' },
  navigateUp: { key: 'ArrowUp', description: 'Move selection up' },
  navigateDown: { key: 'ArrowDown', description: 'Move selection down (loads more at end)' },
  navigateLeft: { key: 'ArrowLeft', description: 'Scroll table left' },
  navigateRight: { key: 'ArrowRight', description: 'Scroll table right' },
  openLink: { key: 'Enter', description: 'Open item link' },
  openDetail: { key: 'o', description: 'Toggle detail popup' },
  closeDialog: { key: 'Escape', description: 'Close dialog' },
  newConfig: { key: 'n', description: 'Create new filter config' },
  deleteConfig: { key: 'd', description: 'Delete current filter config' },
  focusSearch: { key: 's', description: 'Focus search box' },
  toggleView: { key: 'v', description: 'Toggle list/gallery view' }
}

const bindings = ref<KeyBindings>({ ...defaultBindings })
let initialized = false

function loadBindings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to ensure new bindings are included
      bindings.value = { ...defaultBindings, ...parsed }
    }
  } catch (e) {
    console.error('Error loading key bindings:', e)
  }
}

function saveBindings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings.value))
  } catch (e) {
    console.error('Error saving key bindings:', e)
  }
}

export function useKeyBindings() {
  if (!initialized) {
    initialized = true
    loadBindings()
  }

  const updateBinding = (action: keyof KeyBindings, key: string) => {
    bindings.value[action] = { ...bindings.value[action], key }
    saveBindings()
  }

  const resetToDefaults = () => {
    bindings.value = { ...defaultBindings }
    saveBindings()
  }

  const keyBindings = computed(() => bindings.value)

  // Helper to format key for display
  const formatKeyForDisplay = (key: string): string => {
    const keyMap: Record<string, string> = {
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Enter': '↵',
      'Escape': 'Esc',
      ' ': 'Space'
    }
    return keyMap[key] || key.toUpperCase()
  }

  return {
    keyBindings,
    updateBinding,
    resetToDefaults,
    formatKeyForDisplay
  }
}

// Hook for components to listen to keyboard shortcuts
export function useKeyboardShortcuts(handlers: Partial<Record<keyof KeyBindings, () => void>>) {
  const { keyBindings } = useKeyBindings()
  
  const handleKeyDown = (event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only allow Escape in inputs
      if (event.key !== 'Escape') return
    }

    // Find matching action
    for (const [action, handler] of Object.entries(handlers)) {
      const binding = keyBindings.value[action as keyof KeyBindings]
      if (binding && event.key === binding.key) {
        event.preventDefault()
        handler()
        return
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
}

