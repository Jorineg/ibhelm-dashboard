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

    <div class="configurations-list">
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
  background: #2a2a2a;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
  color: #e0e0e0;
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

.configurations-list::-webkit-scrollbar {
  width: 6px;
}

.configurations-list::-webkit-scrollbar-track {
  background: #333;
  border-radius: 3px;
}

.configurations-list::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  background: #333;
}

.config-item:hover {
  background: #3a3a3a;
}

.config-item.active {
  background: #1e3a5f;
  border-color: #4a9eff;
}

.config-icon {
  color: #888;
  font-size: 1rem;
}

.config-item.active .config-icon {
  color: #4a9eff;
}

.config-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.9rem;
  color: #e0e0e0;
}

.config-date {
  font-size: 0.75rem;
  color: #888;
}

.active-config-controls {
  padding-top: 1.5rem;
}

.active-config-controls h4 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  color: #e0e0e0;
}

.control-group {
  margin-bottom: 1.25rem;
}

.control-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
  color: #b0b0b0;
}

.control-buttons {
  display: flex;
  gap: 0.75rem;
}

.control-buttons button {
  flex: 1;
}
</style>

