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
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: fit-content;
  min-width: 280px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.panel-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #333;
}

.configurations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.config-item:hover {
  background: #f8f9fa;
}

.config-item.active {
  background: #e3f2fd;
  border-color: #2196f3;
}

.config-icon {
  color: #666;
  font-size: 1rem;
}

.config-item.active .config-icon {
  color: #2196f3;
}

.config-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
  color: #333;
}

.config-date {
  font-size: 0.75rem;
  color: #999;
}

.active-config-controls {
  padding-top: 1rem;
}

.active-config-controls h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #333;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #555;
}

.control-buttons {
  display: flex;
  gap: 0.5rem;
}

.control-buttons button {
  flex: 1;
}
</style>

