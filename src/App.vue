<template>
  <router-view />
  
  <!-- Footer Status Bar -->
  <div class="footer-status-bar">
    <div class="version-tag">{{ buildTime }}</div>
    
    <div class="sync-status">
      <div class="sync-item" :class="{ 'has-pending': syncStatus.teamwork.pendingCount > 0 }">
        <span class="sync-label">TW</span>
        <span class="sync-time" :title="formatFullDate(syncStatus.teamwork.lastScanned)">
          {{ formatTime(syncStatus.teamwork.lastScanned) }}
        </span>
        <span v-if="syncStatus.teamwork.pendingCount > 0" class="sync-pending">
          {{ syncStatus.teamwork.pendingCount }}
        </span>
      </div>
      
      <div class="sync-divider"></div>
      
      <div class="sync-item" :class="{ 'has-pending': syncStatus.missive.pendingCount > 0 }">
        <span class="sync-label">MI</span>
        <span class="sync-time" :title="formatFullDate(syncStatus.missive.lastScanned)">
          {{ formatTime(syncStatus.missive.lastScanned) }}
        </span>
        <span v-if="syncStatus.missive.pendingCount > 0" class="sync-pending">
          {{ syncStatus.missive.pendingCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSyncStatus } from '@/composables/useSyncStatus'

const { syncStatus } = useSyncStatus()

const buildTime = computed(() => {
  const date = new Date(__BUILD_TIMESTAMP__)
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const formatTime = (date: Date | null): string => {
  if (!date) return '--:--:--'
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatFullDate = (date: Date | null): string => {
  if (!date) return 'No data'
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<style scoped>
.footer-status-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  z-index: 9999;
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
}

.version-tag {
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sync-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s ease;
}

.sync-item.has-pending {
  color: rgba(255, 200, 100, 0.8);
}

.sync-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.5px;
}

.sync-time {
  color: inherit;
  cursor: default;
}

.sync-pending {
  background: rgba(255, 180, 50, 0.2);
  color: rgba(255, 200, 100, 1);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

.sync-divider {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
}
</style>

