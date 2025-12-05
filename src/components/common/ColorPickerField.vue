<template>
  <div class="color-setting" @click.stop>
    <div class="color-preview-row">
      <div class="color-input-wrapper">
        <div 
          class="color-preview" 
          :style="{ background: modelValue }"
          @click="togglePicker"
        ></div>
        <span class="color-value">{{ modelValue }}</span>
      </div>
      
      <div class="preview-items">
        <span class="preview-badge" :style="badgeStyle">{{ badgeLabel }}</span>
        <a class="preview-link-btn" :style="linkButtonStyle">
          <i :class="iconClass"></i>
        </a>
      </div>
    </div>
    
    <div v-if="showPicker" class="color-picker-dropdown">
      <ColorPicker v-model="editingColor" inline />
      <div class="color-picker-actions">
        <Button label="Cancel" severity="secondary" size="small" @click="cancelChange" />
        <Button label="Apply" size="small" @click="applyChange" :loading="saving" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'

interface Props {
  modelValue: string
  badgeLabel: string
  iconClass: string
  saving?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  saving: false
})
const emit = defineEmits<Emits>()

const showPicker = ref(false)
const editingColor = ref('')

const badgeStyle = computed(() => ({
  background: `${props.modelValue}20`,
  color: props.modelValue,
  borderColor: `${props.modelValue}40`
}))

const linkButtonStyle = computed(() => ({
  background: `${props.modelValue}15`,
  color: props.modelValue,
  borderColor: `${props.modelValue}30`
}))

const togglePicker = () => {
  if (!showPicker.value) {
    editingColor.value = props.modelValue.replace('#', '')
  }
  showPicker.value = !showPicker.value
}

const cancelChange = () => {
  showPicker.value = false
  editingColor.value = ''
}

const applyChange = () => {
  emit('update:modelValue', `#${editingColor.value}`)
  showPicker.value = false
}

// Close picker when clicking outside (parent handles document click)
defineExpose({ closePicker: () => { showPicker.value = false } })
</script>

<style scoped>
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

