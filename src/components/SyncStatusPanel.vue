<template>
  <div class="sync-status-panel">
    <div class="sync-status-item">
      <div class="sync-source">
        <span class="sync-icon">📋</span>
        <span class="sync-label">Teamwork</span>
      </div>
      <div class="sync-details">
        <div class="sync-time-row">
          <span class="sync-time-label">Last sync:</span>
          <span class="sync-time-value" :title="formatFullDate(syncStatus.teamwork.lastScanned)">
            {{ formatTime(syncStatus.teamwork.lastScanned) }}
          </span>
        </div>
        <div v-if="syncStatus.teamwork.pendingCount > 0" class="sync-queue-row">
          <span class="sync-queue-label">Queue:</span>
          <span class="sync-queue-value pending">{{ syncStatus.teamwork.pendingCount }} pending</span>
        </div>
        <div v-else class="sync-queue-row">
          <span class="sync-queue-ok">✓ synced</span>
        </div>
      </div>
    </div>
    
    <div class="sync-divider"></div>
    
    <div class="sync-status-item">
      <div class="sync-source">
        <span class="sync-icon">✉️</span>
        <span class="sync-label">Missive</span>
      </div>
      <div class="sync-details">
        <div class="sync-time-row">
          <span class="sync-time-label">Last sync:</span>
          <span class="sync-time-value" :title="formatFullDate(syncStatus.missive.lastScanned)">
            {{ formatTime(syncStatus.missive.lastScanned) }}
          </span>
        </div>
        <div v-if="syncStatus.missive.pendingCount > 0" class="sync-queue-row">
          <span class="sync-queue-label">Queue:</span>
          <span class="sync-queue-value pending">{{ syncStatus.missive.pendingCount }} pending</span>
        </div>
        <div v-else class="sync-queue-row">
          <span class="sync-queue-ok">✓ synced</span>
        </div>
      </div>
    </div>
    
    <div class="sync-divider"></div>
    
    <div class="sync-status-item">
      <div class="sync-source">
        <span class="sync-icon">📝</span>
        <span class="sync-label">Craft</span>
      </div>
      <div class="sync-details">
        <div class="sync-time-row">
          <span class="sync-time-label">Last sync:</span>
          <span class="sync-time-value" :title="formatFullDate(syncStatus.craft.lastScanned)">
            {{ formatTime(syncStatus.craft.lastScanned) }}
          </span>
        </div>
        <div v-if="syncStatus.craft.pendingCount > 0" class="sync-queue-row">
          <span class="sync-queue-label">Queue:</span>
          <span class="sync-queue-value pending">{{ syncStatus.craft.pendingCount }} pending</span>
        </div>
        <div v-else class="sync-queue-row">
          <span class="sync-queue-ok">✓ synced</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SyncSourceStatus {
  lastScanned: Date | null
  pendingCount: number
}

interface SyncStatus {
  teamwork: SyncSourceStatus
  missive: SyncSourceStatus
  craft: SyncSourceStatus
}

interface Props {
  syncStatus: SyncStatus
}

defineProps<Props>()

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
  return 'V: ' + date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.sync-status-panel {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.sync-status-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.sync-source {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.sync-icon {
  font-size: 1rem;
}

.sync-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.sync-details {
  display: flex;
  flex-direction: column;
  gap: 0;
  line-height: 1.2;
}

.sync-time-row,
.sync-queue-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
}

.sync-time-label,
.sync-queue-label {
  color: var(--text-tertiary);
}

.sync-time-value {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  color: var(--text-secondary);
  cursor: default;
  font-size: 0.7rem;
}

.sync-queue-value {
  font-weight: 600;
}

.sync-queue-value.pending {
  color: #f5a623;
  background: rgba(245, 166, 35, 0.15);
  padding: 0 0.35rem;
  border-radius: 3px;
  font-size: 0.65rem;
}

.sync-queue-ok {
  color: #4ade80;
  font-weight: 500;
  font-size: 0.65rem;
}

.sync-divider {
  width: 1px;
  height: 1.75rem;
  background: rgba(255, 255, 255, 0.1);
}
</style>

