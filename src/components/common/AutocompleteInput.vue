<template>
  <div class="autocomplete-container" ref="containerRef">
    <input
      ref="inputRef"
      type="text"
      class="autocomplete-input"
      :class="{ 'has-dropdown': showDropdown && suggestions.length > 0 }"
      :value="modelValue"
      :placeholder="placeholder"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
    
    <!-- Loading indicator -->
    <div v-if="loading" class="autocomplete-loading">
      <i class="pi pi-spin pi-spinner"></i>
    </div>
    
    <!-- Clear button -->
    <button 
      v-if="modelValue && !loading" 
      class="autocomplete-clear"
      type="button"
      @mousedown.prevent="clearValue"
      tabindex="-1"
    >
      <i class="pi pi-times"></i>
    </button>
    
    <!-- Dropdown -->
    <Transition name="dropdown">
      <div 
        v-if="showDropdown && suggestions.length > 0" 
        class="autocomplete-dropdown dropdown-panel"
      >
        <div
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.id"
          class="dropdown-item"
          :class="{ 
            highlighted: index === highlightedIndex,
            selected: isSelected(suggestion)
          }"
          @mousedown.prevent="selectSuggestion(suggestion)"
          @mouseenter="highlightedIndex = index"
        >
          <slot name="option" :suggestion="suggestion" :index="index">
            <div class="option-content">
              <span class="option-primary">{{ getPrimaryText(suggestion) }}</span>
              <span v-if="getSecondaryText(suggestion)" class="option-secondary">
                {{ getSecondaryText(suggestion) }}
              </span>
            </div>
          </slot>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

export interface AutocompleteSuggestion {
  id: string | number
  [key: string]: any
}

interface Props {
  modelValue: string
  suggestions: AutocompleteSuggestion[]
  loading?: boolean
  placeholder?: string
  primaryField?: string
  secondaryField?: string
  debounceMs?: number
  minChars?: number
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'search', value: string): void
  (e: 'select', suggestion: AutocompleteSuggestion): void
  (e: 'clear'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  placeholder: 'Search...',
  primaryField: 'name',
  secondaryField: '',
  debounceMs: 200,
  minChars: 0
})

const emit = defineEmits<Emits>()

const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const selectedId = ref<string | number | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Get primary display text from suggestion
const getPrimaryText = (suggestion: AutocompleteSuggestion): string => {
  return suggestion[props.primaryField] || String(suggestion.id)
}

// Get secondary display text from suggestion
const getSecondaryText = (suggestion: AutocompleteSuggestion): string => {
  if (!props.secondaryField) return ''
  return suggestion[props.secondaryField] || ''
}

// Check if suggestion is currently selected
const isSelected = (suggestion: AutocompleteSuggestion): boolean => {
  return selectedId.value === suggestion.id
}

// Handle input changes with debounce
const handleInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
  selectedId.value = null // Clear selection when typing
  
  // Clear previous timer
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  
  // Debounce the search
  debounceTimer = setTimeout(() => {
    if (value.length >= props.minChars) {
      emit('search', value)
      showDropdown.value = true
    } else if (props.minChars === 0) {
      emit('search', value)
      showDropdown.value = true
    } else {
      showDropdown.value = false
    }
  }, props.debounceMs)
}

// Handle focus - show dropdown
const handleFocus = () => {
  if (props.modelValue.length >= props.minChars || props.minChars === 0) {
    emit('search', props.modelValue)
    showDropdown.value = true
  }
  highlightedIndex.value = 0
}

// Handle blur - hide dropdown (with delay for click handling)
const handleBlur = () => {
  setTimeout(() => {
    showDropdown.value = false
  }, 150)
}

// Handle keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  if (!showDropdown.value || props.suggestions.length === 0) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Open dropdown on arrow keys
      if (props.modelValue.length >= props.minChars || props.minChars === 0) {
        emit('search', props.modelValue)
        showDropdown.value = true
        highlightedIndex.value = 0
      }
      event.preventDefault()
    }
    return
  }
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        props.suggestions.length - 1
      )
      scrollToHighlighted()
      break
      
    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
      scrollToHighlighted()
      break
      
    case 'Enter':
      event.preventDefault()
      if (props.suggestions[highlightedIndex.value]) {
        selectSuggestion(props.suggestions[highlightedIndex.value])
      }
      break
      
    case 'Escape':
      event.preventDefault()
      showDropdown.value = false
      break
      
    case 'Tab':
      // Allow tab to close dropdown and move to next field
      showDropdown.value = false
      break
  }
}

// Scroll dropdown to keep highlighted option visible
const scrollToHighlighted = () => {
  nextTick(() => {
    const dropdown = containerRef.value?.querySelector('.autocomplete-dropdown')
    const highlighted = dropdown?.querySelector('.highlighted') as HTMLElement
    if (dropdown && highlighted) {
      const dropdownRect = dropdown.getBoundingClientRect()
      const highlightedRect = highlighted.getBoundingClientRect()
      
      if (highlightedRect.bottom > dropdownRect.bottom) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      } else if (highlightedRect.top < dropdownRect.top) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  })
}

// Select a suggestion
const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
  const displayValue = getPrimaryText(suggestion)
  emit('update:modelValue', displayValue)
  emit('select', suggestion)
  selectedId.value = suggestion.id
  showDropdown.value = false
  highlightedIndex.value = 0
}

// Clear the input
const clearValue = () => {
  emit('update:modelValue', '')
  emit('clear')
  selectedId.value = null
  showDropdown.value = false
  inputRef.value?.focus()
}

// Reset highlighted index when suggestions change
watch(() => props.suggestions, () => {
  highlightedIndex.value = 0
})

// Cleanup
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<style scoped>
.autocomplete-container {
  position: relative;
  width: 100%;
}

.autocomplete-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 1rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.autocomplete-input:focus {
  outline: none;
  border-color: var(--border-secondary);
}

.autocomplete-input.has-dropdown {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: var(--border-primary);
}

.autocomplete-input::placeholder {
  color: var(--text-tertiary);
}

.autocomplete-loading,
.autocomplete-clear {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.autocomplete-clear {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease, background 0.15s ease;
}

.autocomplete-clear:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* Dropdown positioning (uses global .dropdown-panel and .dropdown-item for shared styles) */
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  border-top: none;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  overflow-x: hidden;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.option-primary {
  color: var(--text-primary);
  font-weight: 500;
}

.option-secondary {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>


