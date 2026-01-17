import { onMounted, onUnmounted, computed } from 'vue'
import { useUserSettings } from '@/composables/useUserSettings'

export interface KeyBinding {
  key: string
  description: string
  group?: string
}

export interface KeyBindings {
  // Filter configs (1-9, 0)
  filterConfig1: KeyBinding
  filterConfig2: KeyBinding
  filterConfig3: KeyBinding
  filterConfig4: KeyBinding
  filterConfig5: KeyBinding
  filterConfig6: KeyBinding
  filterConfig7: KeyBinding
  filterConfig8: KeyBinding
  filterConfig9: KeyBinding
  filterConfig0: KeyBinding
  // Navigation
  navigateUp: KeyBinding
  navigateDown: KeyBinding
  navigateLeft: KeyBinding
  navigateRight: KeyBinding
  // Item actions
  openLink: KeyBinding
  openDetail: KeyBinding
  peek: KeyBinding
  closeDialog: KeyBinding
  // Config management
  newConfig: KeyBinding
  deleteConfig: KeyBinding
  renameConfig: KeyBinding
  saveConfig: KeyBinding
  // View
  focusSearch: KeyBinding
  toggleView: KeyBinding
  gridZoomIn: KeyBinding
  gridZoomOut: KeyBinding
  // Quick filters
  focusProject: KeyBinding
  focusCostGroup: KeyBinding
  focusLocation: KeyBinding
  focusTags: KeyBinding
  focusInvolvedPerson: KeyBinding
  // Type toggles
  toggleEmails: KeyBinding
  toggleCraft: KeyBinding
  toggleFiles: KeyBinding
  toggleTaskType1: KeyBinding
  toggleTaskType2: KeyBinding
  toggleTaskType3: KeyBinding
}

const defaultBindings: KeyBindings = {
  // Filter configs (fixed, not customizable via UI)
  filterConfig1: { key: '1', description: 'Switch to filter config 1', group: 'configs' },
  filterConfig2: { key: '2', description: 'Switch to filter config 2', group: 'configs' },
  filterConfig3: { key: '3', description: 'Switch to filter config 3', group: 'configs' },
  filterConfig4: { key: '4', description: 'Switch to filter config 4', group: 'configs' },
  filterConfig5: { key: '5', description: 'Switch to filter config 5', group: 'configs' },
  filterConfig6: { key: '6', description: 'Switch to filter config 6', group: 'configs' },
  filterConfig7: { key: '7', description: 'Switch to filter config 7', group: 'configs' },
  filterConfig8: { key: '8', description: 'Switch to filter config 8', group: 'configs' },
  filterConfig9: { key: '9', description: 'Switch to filter config 9', group: 'configs' },
  filterConfig0: { key: '0', description: 'Switch to filter config 10', group: 'configs' },
  // Navigation
  navigateUp: { key: 'ArrowUp', description: 'Move selection up', group: 'navigation' },
  navigateDown: { key: 'ArrowDown', description: 'Move selection down', group: 'navigation' },
  navigateLeft: { key: 'ArrowLeft', description: 'Scroll table left', group: 'navigation' },
  navigateRight: { key: 'ArrowRight', description: 'Scroll table right', group: 'navigation' },
  // Item actions
  openLink: { key: 'Enter', description: 'Open item link', group: 'actions' },
  openDetail: { key: '.', description: 'Toggle detail popup', group: 'actions' },
  peek: { key: ' ', description: 'Peek detail (hold)', group: 'actions' },
  closeDialog: { key: 'Escape', description: 'Close dialog / blur input', group: 'actions' },
  // Config management
  newConfig: { key: 'f', description: 'Create new filter config', group: 'config_mgmt' },
  deleteConfig: { key: 'd', description: 'Delete current filter config', group: 'config_mgmt' },
  renameConfig: { key: 'r', description: 'Rename current filter config', group: 'config_mgmt' },
  saveConfig: { key: 'j', description: 'Save current filter config', group: 'config_mgmt' },
  // View
  focusSearch: { key: 's', description: 'Focus search box', group: 'view' },
  toggleView: { key: 'g', description: 'Toggle list/gallery view', group: 'view' },
  gridZoomIn: { key: '+', description: 'Grid: zoom in (larger tiles)', group: 'view' },
  gridZoomOut: { key: '-', description: 'Grid: zoom out (smaller tiles)', group: 'view' },
  // Quick filters
  focusProject: { key: 'p', description: 'Focus Projekt filter', group: 'filters' },
  focusCostGroup: { key: 'k', description: 'Focus Kostengruppe filter', group: 'filters' },
  focusLocation: { key: 'o', description: 'Focus Ort filter', group: 'filters' },
  focusTags: { key: 't', description: 'Focus Tags filter', group: 'filters' },
  focusInvolvedPerson: { key: 'i', description: 'Focus Involvierte Person filter', group: 'filters' },
  // Type toggles
  toggleEmails: { key: 'v', description: 'Toggle show emails', group: 'toggles' },
  toggleCraft: { key: 'b', description: 'Toggle show craft docs', group: 'toggles' },
  toggleFiles: { key: 'n', description: 'Toggle show files', group: 'toggles' },
  toggleTaskType1: { key: 'y', description: 'Toggle task type 1', group: 'toggles' },
  toggleTaskType2: { key: 'x', description: 'Toggle task type 2', group: 'toggles' },
  toggleTaskType3: { key: 'c', description: 'Toggle task type 3', group: 'toggles' }
}

export function useKeyBindings() {
  const { keyBindings: storedBindings, updateKeyBindings } = useUserSettings()

  // Merge stored key overrides with default bindings
  const keyBindings = computed<KeyBindings>(() => {
    const result = { ...defaultBindings }
    for (const [action, key] of Object.entries(storedBindings.value)) {
      if (key && action in result) {
        result[action as keyof KeyBindings] = {
          ...result[action as keyof KeyBindings],
          key
        }
      }
    }
    return result
  })

  const updateBinding = (action: keyof KeyBindings, key: string) => {
    const newBindings = { ...storedBindings.value, [action]: key }
    updateKeyBindings(newBindings)
  }

  const resetToDefaults = () => {
    updateKeyBindings({})
  }

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
    // Let browser handle Ctrl/Cmd/Alt modified shortcuts (e.g., Cmd+R for reload)
    if (event.ctrlKey || event.metaKey || event.altKey) return
    
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
