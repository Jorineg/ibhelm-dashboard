<template>
  <div class="configuration-panel">
    <div class="panel-header">
      <h3>Filter Configurations</h3>
      <Button
        icon="pi pi-plus"
        label="New"
        size="small"
        @click="handleCreateConfig"
      />
    </div>

    <div class="configurations-list thin-scrollbar">
      <div
        v-for="config in configurations"
        :key="config.id"
        :class="['config-item', { active: config.id === activeConfigId }]"
        @click="setActiveConfiguration(config.id)"
      >
        <i class="pi pi-filter config-icon"></i>
        <span class="config-name">{{ config.name }}</span>
        <span class="config-date">{{ formatDate(config.updatedAt) }}</span>
      </div>
    </div>

    <Divider />

    <!-- Active configuration controls -->
    <div v-if="activeConfig" class="active-config-controls">
      <h4>Active Configuration</h4>
      
      <div class="control-group">
        <label for="config-name">Name</label>
        <InputText
          id="config-name"
          :model-value="activeConfig.name"
          @update:model-value="handleUpdateName"
          placeholder="Configuration name"
          class="config-name-input"
        />
      </div>

      <div class="control-buttons">
        <Button
          label="Duplicate"
          icon="pi pi-copy"
          outlined
          size="small"
          @click="handleDuplicate"
        />
        
        <Button
          label="Delete"
          icon="pi pi-trash"
          outlined
          severity="danger"
          size="small"
          @click="handleDelete"
          :disabled="configurations.length <= 1"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Divider from 'primevue/divider'
import { useFilterConfigs } from '@/composables/useFilterConfigs'

const {
  configurations,
  activeConfig,
  activeConfigId,
  createConfiguration,
  duplicateConfiguration,
  deleteConfiguration,
  updateConfiguration,
  setActiveConfiguration
} = useFilterConfigs()

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const handleCreateConfig = () => {
  createConfiguration()
}

const handleDuplicate = () => {
  if (activeConfig.value) {
    duplicateConfiguration(activeConfig.value.id)
  }
}

const handleDelete = () => {
  if (activeConfig.value && configurations.value.length > 1) {
    if (confirm(`Delete configuration "${activeConfig.value.name}"?`)) {
      deleteConfiguration(activeConfig.value.id)
    }
  }
}

const handleUpdateName = (name: string) => {
  if (activeConfig.value) {
    updateConfiguration(activeConfig.value.id, { name })
  }
}
</script>

<style scoped>
.configuration-panel {
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  height: fit-content;
  min-width: 300px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.panel-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.configurations-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 1.5rem;
  padding-right: 0.5rem;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 2px solid transparent;
  background: var(--bg-tertiary);
}

.config-item:hover {
  background: var(--bg-hover);
}

.config-item.active {
  background: var(--accent-primary-dark);
  border-color: var(--accent-primary);
}

.config-icon {
  color: var(--text-tertiary);
  font-size: 1rem;
}

.config-item.active .config-icon {
  color: var(--accent-primary);
}

.config-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.config-date {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.active-config-controls {
  padding-top: 1.5rem;
}

.active-config-controls h4 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  color: var(--text-primary);
}

.control-group {
  margin-bottom: 1.25rem;
}

.control-buttons {
  display: flex;
  gap: 0.75rem;
}

.control-buttons button {
  flex: 1;
}
</style>

