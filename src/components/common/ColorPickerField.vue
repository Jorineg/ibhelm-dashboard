<template>
  <div class="color-setting">
    <div class="color-preview-row">
      <div class="color-input-wrapper">
        <input 
          type="color" 
          :value="modelValue"
          @input="handleInput"
          class="color-input"
        />
        <span class="color-value">{{ modelValue }}</span>
      </div>
      
      <div class="preview-items">
        <span class="preview-badge" :style="badgeStyle">{{ badgeLabel }}</span>
        <a class="preview-link-btn" :style="linkButtonStyle">
          <i :class="iconClass"></i>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string
  badgeLabel: string
  iconClass: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

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

const handleInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.color-setting {
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

.color-input {
  width: 42px;
  height: 42px;
  padding: 0;
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  transition: all 0.15s ease;
}

.color-input:hover {
  transform: scale(1.05);
  border-color: var(--border-secondary);
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
}

.color-input::-moz-color-swatch {
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
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
</style>
