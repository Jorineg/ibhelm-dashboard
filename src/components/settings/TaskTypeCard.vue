<template>
  <div 
    class="task-type-card"
    :class="{ 'is-default': taskType.is_default }"
  >
    <div class="task-type-header">
      <div class="task-type-info">
        <Tooltip text="Click to change color" position="top">
          <input 
            type="color" 
            :value="taskType.color || '#6366f1'"
            @input="(e) => $emit('color-change', taskType.id, (e.target as HTMLInputElement).value)"
            class="task-type-color-input"
          />
        </Tooltip>
        <div class="task-type-details">
          <template v-if="isEditing">
            <InputText
              :model-value="editingName"
              @update:model-value="$emit('update:editingName', $event)"
              class="edit-name-input"
              @keyup.enter="$emit('save-name', taskType.id)"
              @keyup.escape="$emit('cancel-edit')"
              autofocus
            />
          </template>
          <template v-else>
            <h3>
              {{ taskType.name }}
              <span v-if="taskType.is_default" class="default-badge">Default</span>
            </h3>
            <p v-if="taskType.description" class="type-description">
              {{ taskType.description }}
            </p>
          </template>
        </div>
      </div>
      
      <div class="task-type-actions">
        <template v-if="isEditing">
          <Button
            icon="pi pi-check"
            text
            rounded
            severity="success"
            @click="$emit('save-name', taskType.id)"
          />
          <Button
            icon="pi pi-times"
            text
            rounded
            severity="secondary"
            @click="$emit('cancel-edit')"
          />
        </template>
        <template v-else>
          <Tooltip text="Edit name" position="top">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              severity="secondary"
              @click="$emit('start-edit', taskType)"
            />
          </Tooltip>
          <Tooltip v-if="!taskType.is_default" text="Delete type" position="top">
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              @click="$emit('delete', taskType)"
            />
          </Tooltip>
        </template>
      </div>
    </div>

    <!-- Rules for this type (not for default) -->
    <div v-if="!taskType.is_default" class="task-type-rules">
      <div class="rules-header">
        <span class="rules-label">Matching Tags:</span>
        <span class="rules-hint">Tasks with any of these tags will be categorized as "{{ taskType.name }}"</span>
      </div>
      
      <div class="rules-list">
        <div 
          v-for="rule in rules" 
          :key="rule.id"
          class="rule-tag"
        >
          <span>{{ rule.teamwork_tag_name }}</span>
          <button class="remove-rule-btn" @click="$emit('remove-rule', rule.id)">
            <i class="pi pi-times"></i>
          </button>
        </div>
        
        <!-- Add new rule input -->
        <div class="add-rule-wrapper">
          <InputText
            :model-value="newRuleTag"
            @update:model-value="$emit('update:newRuleTag', $event)"
            placeholder="Add tag..."
            class="add-rule-input"
            @keyup.enter="$emit('add-rule', taskType.id)"
          />
          <Button
            icon="pi pi-plus"
            text
            rounded
            size="small"
            @click="$emit('add-rule', taskType.id)"
            :disabled="!newRuleTag?.trim()"
          />
        </div>
      </div>
    </div>

    <!-- Default type info -->
    <div v-else class="default-type-info">
      <i class="pi pi-info-circle"></i>
      <span>This is the default type. Tasks that don't match any tag rules will be assigned here.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { Tooltip } from '@/components/common'
import type { TaskType, TaskTypeRule } from '@/types'

interface Props {
  taskType: TaskType
  rules: TaskTypeRule[]
  isEditing: boolean
  editingName: string
  newRuleTag?: string
}

defineProps<Props>()

defineEmits<{
  (e: 'start-edit', taskType: TaskType): void
  (e: 'save-name', typeId: string): void
  (e: 'cancel-edit'): void
  (e: 'delete', taskType: TaskType): void
  (e: 'color-change', typeId: string, color: string): void
  (e: 'add-rule', typeId: string): void
  (e: 'remove-rule', ruleId: string): void
  (e: 'update:editingName', value: string): void
  (e: 'update:newRuleTag', value: string): void
}>()
</script>

<style scoped>
.task-type-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  transition: all 0.15s ease;
}

.task-type-card:hover {
  border-color: var(--border-secondary);
}

.task-type-card.is-default {
  border-color: rgba(74, 158, 255, 0.3);
  background: rgba(74, 158, 255, 0.05);
}

.task-type-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-type-info {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.task-type-color-input {
  width: 24px;
  height: 24px;
  padding: 0;
  margin-top: 2px;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.task-type-color-input:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.task-type-color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.task-type-color-input::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.task-type-color-input::-moz-color-swatch {
  border: none;
  border-radius: 4px;
}

.task-type-details h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.default-badge {
  padding: 0.15rem 0.5rem;
  background: rgba(74, 158, 255, 0.2);
  color: var(--accent-primary);
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.type-description {
  color: var(--text-tertiary);
  font-size: 0.85rem;
  margin: 0.25rem 0 0 0;
}

.task-type-actions {
  display: flex;
  gap: 0.25rem;
}

.edit-name-input {
  width: 200px;
}

/* Rules */
.task-type-rules {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.rules-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.rules-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.rules-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.rules-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.rule-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-primary);
}

.remove-rule-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.remove-rule-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.add-rule-wrapper {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.add-rule-input {
  width: 140px;
  font-size: 0.85rem !important;
}

/* Default Type Info */
.default-type-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(74, 158, 255, 0.1);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.default-type-info i {
  color: var(--accent-primary);
}
</style>
