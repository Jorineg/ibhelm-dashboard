<template>
  <SectionCard
    :title="displayName"
    :description="service ? `Status: ${service.status}` : 'Select a service to view details'"
  >
    <template v-if="service">
      <!-- Controls -->
      <div class="controls-section">
        <h4>Controls</h4>
        <div class="control-buttons">
          <button 
            class="control-btn start"
            :disabled="isLoading || service.status === 'running'"
            @click="$emit('start', service.name)"
          >
            <i class="pi pi-play" />
            Start
          </button>
          <button 
            class="control-btn stop"
            :disabled="isLoading || service.status === 'stopped' || service.status === 'not_found'"
            @click="$emit('stop', service.name)"
          >
            <i class="pi pi-stop" />
            Stop
          </button>
          <button 
            class="control-btn restart"
            :disabled="isLoading"
            @click="$emit('restart', service.name)"
          >
            <i class="pi pi-refresh" />
            Restart
          </button>
          <button 
            class="control-btn update"
            :disabled="isLoading"
            @click="$emit('update', service.name)"
          >
            <i class="pi pi-cloud-download" />
            Update
          </button>
        </div>
        <div v-if="isLoading" class="operation-loading">
          <i class="pi pi-spin pi-spinner" />
          <span>Operation in progress...</span>
        </div>
      </div>

      <!-- Containers -->
      <div v-if="service.containers?.length" class="containers-section">
        <h4>Containers</h4>
        <div class="containers-list">
          <div 
            v-for="container in service.containers" 
            :key="container.name"
            class="container-row"
          >
            <div class="container-info">
              <div class="status-dot" :class="getStatusClass(container.status)" />
              <span class="container-name">{{ container.name }}</span>
              <span v-if="container.health_status" class="health-badge" :class="container.health_status">
                {{ container.health_status }}
              </span>
            </div>
            <div class="container-stats">
              <span v-if="container.cpu_percent != null" class="stat">
                CPU: {{ container.cpu_percent }}%
              </span>
              <span v-if="container.memory_mb != null" class="stat">
                {{ container.memory_mb }} MB
              </span>
              <span v-if="container.restart_count > 0" class="stat warning">
                {{ container.restart_count }} restarts
              </span>
              <span v-if="container.exit_code != null && container.status !== 'running'" class="stat" :class="container.exit_code === 0 ? '' : 'error'">
                Exit: {{ container.exit_code }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Logs -->
      <div class="logs-section">
        <div class="logs-header">
          <h4>Logs</h4>
          <div class="logs-controls">
            <select v-if="service.containers?.length > 1" v-model="selectedContainer" class="container-select">
              <option v-for="c in service.containers" :key="c.name" :value="c.name">
                {{ c.name }}
              </option>
            </select>
            <button class="refresh-logs-btn" @click="refreshLogs" :disabled="logsLoading">
              <i class="pi" :class="logsLoading ? 'pi-spin pi-spinner' : 'pi-refresh'" />
            </button>
          </div>
        </div>
        <pre class="logs-output" ref="logsRef">{{ logs || 'No logs available' }}</pre>
      </div>
    </template>

    <div v-else class="no-selection">
      <i class="pi pi-info-circle" />
      <span>Select a service from the overview to view details</span>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { SectionCard } from '@/components/common'
import type { ServiceStatus } from '@/composables/useServices'

interface Props {
  service: ServiceStatus | null
  displayName: string
  isLoading: boolean
  logs: string
  logsLoading: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'start', name: string): void
  (e: 'stop', name: string): void
  (e: 'restart', name: string): void
  (e: 'update', name: string): void
  (e: 'refresh-logs', name: string, container?: string): void
}>()

const selectedContainer = ref<string>('')
const logsRef = ref<HTMLPreElement>()

watch(() => props.service, (service) => {
  if (service?.containers?.length) {
    selectedContainer.value = service.containers[0].name
  }
}, { immediate: true })

watch(() => props.logs, () => {
  nextTick(() => {
    if (logsRef.value) {
      logsRef.value.scrollTop = logsRef.value.scrollHeight
    }
  })
})

const emit = defineEmits<{
  (e: 'start', name: string): void
  (e: 'stop', name: string): void
  (e: 'restart', name: string): void
  (e: 'update', name: string): void
  (e: 'refresh-logs', name: string, container?: string): void
}>()

const refreshLogs = () => {
  if (props.service) {
    const container = props.service.containers?.length > 1 ? selectedContainer.value : undefined
    emit('refresh-logs', props.service.name, container)
  }
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'running': return 'status-running'
    case 'exited':
    case 'stopped': return 'status-stopped'
    default: return 'status-error'
  }
}
</script>

<style scoped>
.controls-section,
.containers-section,
.logs-section {
  margin-bottom: 2rem;
}

.controls-section:last-child,
.containers-section:last-child,
.logs-section:last-child {
  margin-bottom: 0;
}

h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

/* Controls */
.control-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn.start {
  background: var(--success);
  color: white;
}

.control-btn.stop {
  background: var(--error);
  color: white;
}

.control-btn.restart {
  background: var(--warning);
  color: white;
}

.control-btn.update {
  background: var(--accent-primary);
  color: white;
}

.control-btn:not(:disabled):hover {
  filter: brightness(1.1);
}

.operation-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  color: var(--accent-primary);
  font-size: 0.9rem;
}

/* Containers */
.containers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.container-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.container-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.status-running {
  background: var(--success);
}

.status-dot.status-stopped {
  background: var(--text-tertiary);
}

.status-dot.status-error {
  background: var(--error);
}

.container-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.health-badge {
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.health-badge.healthy {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

.health-badge.unhealthy {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
}

.health-badge.starting {
  background: rgba(234, 179, 8, 0.15);
  color: var(--warning);
}

.container-stats {
  display: flex;
  gap: 1rem;
}

.stat {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}

.stat.warning {
  color: var(--warning);
}

.stat.error {
  color: var(--error);
}

/* Logs */
.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.logs-header h4 {
  margin: 0;
}

.logs-controls {
  display: flex;
  gap: 0.5rem;
}

.container-select {
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.refresh-logs-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.refresh-logs-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.refresh-logs-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logs-output {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}

/* No Selection */
.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  color: var(--text-tertiary);
}

.no-selection i {
  font-size: 2rem;
}
</style>

