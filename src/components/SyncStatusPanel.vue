<template>
  <div class="sync-status-popup">
    <div class="popup-header">
      <span class="popup-title">Data Sync Status</span>
    </div>
    
    <div class="sync-sources">
      <div class="sync-source-item" v-for="source in sources" :key="source.key">
        <div class="source-header">
          <span class="source-icon">{{ source.icon }}</span>
          <span class="source-name">{{ source.name }}</span>
          <span class="source-status" :class="getSourceStatusClass(source.data)">
            <i :class="getSourceStatusIcon(source.data)"></i>
          </span>
        </div>
        
        <div class="source-details">
          <div class="detail-row">
            <span class="detail-label">Last sync:</span>
            <span 
              class="detail-value time" 
              :class="{ warning: isSourceOutdated(source.data) }"
              :title="formatFullDate(source.data.lastScanned)"
            >
              {{ formatTime(source.data.lastScanned) }}
              <i v-if="isSourceOutdated(source.data)" class="pi pi-exclamation-triangle warning-icon"></i>
            </span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Last change:</span>
            <span 
              class="detail-value time" 
              :title="formatFullDate(source.data.lastChange)"
            >
              {{ formatTime(source.data.lastChange) }}
            </span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Queue:</span>
            <span v-if="source.data.pendingCount > 0" class="detail-value queue pending">
              {{ source.data.pendingCount }} pending
            </span>
            <span v-else class="detail-value queue ok">
              ✓ synced
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SyncStatus, SyncSourceStatus } from '@/composables/useSyncStatus'

interface Props {
  syncStatus: SyncStatus
  isSourceOutdated: (source: SyncSourceStatus) => boolean
}

const props = defineProps<Props>()

const sources = computed(() => [
  { key: 'teamwork', name: 'Teamwork', icon: '📋', data: props.syncStatus.teamwork },
  { key: 'missive', name: 'Missive', icon: '✉️', data: props.syncStatus.missive },
  { key: 'craft', name: 'Craft', icon: '📝', data: props.syncStatus.craft }
])

const getSourceStatusClass = (source: SyncSourceStatus): string => {
  if (source.pendingCount > 0) return 'importing'
  if (props.isSourceOutdated(source)) return 'outdated'
  return 'ok'
}

const getSourceStatusIcon = (source: SyncSourceStatus): string => {
  if (source.pendingCount > 0) return 'pi pi-download'
  if (props.isSourceOutdated(source)) return 'pi pi-exclamation-triangle'
  return 'pi pi-check'
}

const formatTime = (date: Date | null): string => {
  if (!date) return '--:--:--'
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatFullDate = (date: Date | null): string => {
  if (!date) return 'No data available'
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<style scoped>
.sync-status-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 280px;
  overflow: hidden;
}

.popup-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
}

.popup-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sync-sources {
  padding: 0.5rem 0;
}

.sync-source-item {
  padding: 0.75rem 1rem;
}

.sync-source-item:not(:last-child) {
  border-bottom: 1px solid var(--border-primary);
}

.source-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.source-icon {
  font-size: 1rem;
}

.source-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.source-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 0.7rem;
}

.source-status.ok {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.15);
}

.source-status.importing {
  color: var(--accent-primary);
  background: rgba(74, 158, 255, 0.15);
}

.source-status.importing i {
  animation: pulse 1.5s ease-in-out infinite;
}

.source-status.outdated {
  color: #f5a623;
  background: rgba(245, 166, 35, 0.15);
}

.source-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-left: 1.5rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
}

.detail-label {
  color: var(--text-tertiary);
  min-width: 70px;
}

.detail-value {
  color: var(--text-secondary);
}

.detail-value.time {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.detail-value.time.warning {
  color: #f5a623;
}

.warning-icon {
  font-size: 0.6rem;
}

.detail-value.queue.pending {
  color: #f5a623;
  background: rgba(245, 166, 35, 0.15);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-weight: 500;
}

.detail-value.queue.ok {
  color: #4ade80;
  font-weight: 500;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
