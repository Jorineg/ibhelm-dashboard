<template>
  <SectionCard
    title="Appearance"
    description="Customize the visual appearance of items in the dashboard."
  >
    <!-- Email Color Section -->
    <div class="appearance-section">
      <h4>Email Color</h4>
      <p class="section-hint">
        This color is used for email type badges, link buttons, and the colored bar in the table header.
      </p>
      
      <div class="color-setting">
        <div class="color-preview-row">
          <div class="color-input-wrapper">
            <div 
              class="color-preview" 
              :style="{ background: displayColor }"
              @click="toggleColorPicker"
            ></div>
            <span class="color-value">{{ displayColor }}</span>
          </div>
          
          <div class="preview-items">
            <span class="preview-badge" :style="badgeStyle">EMAIL</span>
            <a class="preview-link-btn" :style="linkButtonStyle">
              <i class="pi pi-envelope"></i>
            </a>
          </div>
        </div>
        
        <div v-if="showColorPicker" class="color-picker-dropdown">
          <ColorPicker v-model="editingColor" inline />
          <div class="color-picker-actions">
            <Button label="Cancel" severity="secondary" size="small" @click="cancelColorChange" />
            <Button label="Apply" size="small" @click="applyColorChange" :loading="saving" />
          </div>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import { SectionCard } from '@/components/common'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'

const { emailColor, saving, initialize, updateEmailColor } = useAppearanceSettings()

// State
const showColorPicker = ref(false)
const editingColor = ref('')

// Computed
const displayColor = computed(() => emailColor.value)

const badgeStyle = computed(() => {
  const color = displayColor.value
  return {
    background: `${color}20`,
    color: color,
    borderColor: `${color}40`
  }
})

const linkButtonStyle = computed(() => {
  const color = displayColor.value
  return {
    background: `${color}15`,
    color: color,
    borderColor: `${color}30`
  }
})

// Methods
const toggleColorPicker = (event: Event) => {
  event.stopPropagation()
  if (!showColorPicker.value) {
    editingColor.value = displayColor.value.replace('#', '')
  }
  showColorPicker.value = !showColorPicker.value
}

const cancelColorChange = () => {
  showColorPicker.value = false
  editingColor.value = ''
}

const applyColorChange = async () => {
  const newColor = `#${editingColor.value}`
  const success = await updateEmailColor(newColor)
  if (success) {
    showColorPicker.value = false
  }
}

// Handle clicking outside color picker
const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.color-setting')) {
    showColorPicker.value = false
  }
}

onMounted(async () => {
  await initialize()
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
.appearance-section {
  margin-bottom: 2rem;
}

.appearance-section:last-child {
  margin-bottom: 0;
}

.appearance-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.section-hint {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin: 0 0 1.25rem 0;
}

.color-setting {
  position: relative;
  padding: 1.25rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.color-preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.color-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.color-preview {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 2px solid var(--border-primary);
  transition: all 0.15s ease;
}

.color-preview:hover {
  transform: scale(1.05);
  border-color: var(--border-secondary);
}

.color-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.preview-items {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.preview-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
}

.preview-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 1rem;
  border: 1px solid;
}

.color-picker-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 1rem;
  box-shadow: var(--shadow-lg);
}

.color-picker-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>

