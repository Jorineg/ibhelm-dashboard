<template>
  <div class="sync-indicator" @click="$emit('click')" :title="tooltip">
    <span class="indicator-label">data status:</span>
    <span class="indicator-status" :class="overallStatus">
      <i :class="statusIcon"></i>
      {{ statusText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OverallStatus } from '@/composables/useSyncStatus'

interface Props {
  overallStatus: OverallStatus
  tooltip: string
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'click'): void
}>()

const statusText = computed(() => {
  switch (props.overallStatus) {
    case 'error': return 'errors'
    case 'importing': return 'importing'
    case 'outdated': return 'outdated'
    default: return 'synced'
  }
})

const statusIcon = computed(() => {
  switch (props.overallStatus) {
    case 'error': return 'pi pi-times'
    case 'importing': return 'pi pi-download'
    case 'outdated': return 'pi pi-exclamation-triangle'
    default: return 'pi pi-check'
  }
})
</script>

<style scoped>
.sync-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}

.sync-indicator:hover {
  background: var(--bg-tertiary);
}

.indicator-label {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  text-transform: lowercase;
}

.indicator-status {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.indicator-status i {
  font-size: 0.875rem;
}

.indicator-status.synced {
  color: #4ade80;
}

.indicator-status.importing {
  color: var(--accent-primary);
}

.indicator-status.importing i {
  animation: pulse 1.5s ease-in-out infinite;
}

.indicator-status.outdated {
  color: #f5a623;
}

.indicator-status.error {
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
