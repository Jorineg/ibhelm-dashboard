<template>
  <SectionCard
    title="Service Overview"
    description="Status of all IBHelm services."
  >
    <div class="services-grid">
      <div 
        v-for="service in services" 
        :key="service.name"
        class="service-card"
        :class="{ 'is-selected': selectedService === service.name }"
        @click="$emit('select', service.name)"
      >
        <div class="service-header">
          <div class="status-indicator" :class="getStatusClass(service.status)" />
          <span class="service-name">{{ getDisplayName(service.name) }}</span>
        </div>
        
        <div class="service-stats">
          <div v-if="service.total_memory_mb" class="stat">
            <i class="pi pi-database" />
            <span>{{ service.total_memory_mb }} MB</span>
          </div>
          <div v-if="service.containers?.length > 1" class="stat">
            <i class="pi pi-box" />
            <span>{{ service.containers.length }} containers</span>
          </div>
          <div v-if="getRestartCount(service) > 0" class="stat warning">
            <i class="pi pi-refresh" />
            <span>{{ getRestartCount(service) }} restarts</span>
          </div>
        </div>
        
        <div class="service-status-label" :class="getStatusClass(service.status)">
          {{ formatStatus(service.status) }}
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="loading-overlay">
      <i class="pi pi-spin pi-spinner" />
      <span>Loading services...</span>
    </div>
    
    <div v-if="error" class="error-message">
      <i class="pi pi-exclamation-triangle" />
      <span>{{ error }}</span>
      <button class="retry-btn" @click="$emit('refresh')">
        <i class="pi pi-refresh" />
        Retry
      </button>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { SectionCard } from '@/components/common'
import type { ServiceStatus } from '@/composables/useServices'

interface Props {
  services: ServiceStatus[]
  loading: boolean
  error: string | null
  selectedService: string | null
  getDisplayName: (name: string) => string
}

defineProps<Props>()

defineEmits<{
  (e: 'select', name: string): void
  (e: 'refresh'): void
}>()

const getStatusClass = (status: string) => {
  switch (status) {
    case 'running': return 'status-running'
    case 'partial': return 'status-partial'
    case 'stopped':
    case 'exited': return 'status-stopped'
    case 'not_found': return 'status-notfound'
    default: return 'status-error'
  }
}

const formatStatus = (status: string) => {
  switch (status) {
    case 'running': return 'Running'
    case 'partial': return 'Partial'
    case 'stopped': return 'Stopped'
    case 'exited': return 'Exited'
    case 'not_found': return 'Not Found'
    default: return status
  }
}

const getRestartCount = (service: ServiceStatus) => {
  return service.containers?.reduce((sum, c) => sum + (c.restart_count || 0), 0) || 0
}
</script>

<style scoped>
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.service-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.service-card:hover {
  border-color: var(--border-secondary);
  background: var(--bg-hover);
}

.service-card.is-selected {
  border-color: var(--accent-primary);
  background: var(--accent-primary-dark);
}

.service-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.status-running {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

.status-indicator.status-partial {
  background: var(--warning);
  box-shadow: 0 0 8px var(--warning);
}

.status-indicator.status-stopped,
.status-indicator.status-notfound {
  background: var(--text-tertiary);
}

.status-indicator.status-error {
  background: var(--error);
  box-shadow: 0 0 8px var(--error);
}

.service-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.service-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.stat i {
  font-size: 0.9rem;
}

.stat.warning {
  color: var(--warning);
}

.service-status-label {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.service-status-label.status-running {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

.service-status-label.status-partial {
  background: rgba(234, 179, 8, 0.15);
  color: var(--warning);
}

.service-status-label.status-stopped,
.service-status-label.status-notfound {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.service-status-label.status-error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
}

.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--text-secondary);
}

.loading-overlay i {
  font-size: 1.5rem;
  color: var(--accent-primary);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  color: var(--error);
}

.error-message i {
  font-size: 1.25rem;
}

.retry-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: var(--error);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.retry-btn:hover {
  opacity: 0.9;
}
</style>

