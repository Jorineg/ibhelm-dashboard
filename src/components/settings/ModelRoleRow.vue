<template>
  <div class="role-row">
    <div class="role-header">
      <h4>{{ label }}</h4>
      <p class="role-hint">{{ hint }}</p>
    </div>
    <div class="role-control">
      <select :value="modelValue" class="role-select" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
        <option value="">— {{ fallbackLabel || 'None' }} —</option>
        <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
      <span v-if="modelValue && !modelExists" class="role-error">
        <i class="pi pi-exclamation-circle"></i> Not found
      </span>
      <span v-else-if="warn" class="role-warning">
        <i class="pi pi-exclamation-triangle"></i> {{ warnText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatModelConfig } from '@/composables/useAppearanceSettings'

const props = defineProps<{
  label: string
  hint: string
  modelValue: string
  models: ChatModelConfig[]
  fallbackLabel?: string
  warn?: boolean
  warnText?: string
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()

const modelExists = computed(() => props.models.some(m => m.id === props.modelValue))
</script>

<style scoped>
.role-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.role-header {
  flex: 1;
  min-width: 0;
}

.role-header h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.role-hint {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin: 0.15rem 0 0;
}

.role-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.role-select {
  width: 220px;
  padding: 0.55rem 2.25rem 0.55rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.15s ease;
}

.role-select:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.role-error {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #ef4444;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.role-warning {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #f5a623;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}
</style>
