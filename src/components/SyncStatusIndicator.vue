<template>
  <div class="sync-indicator" @click="$emit('click')" :title="statusTitle">
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
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'click'): void
}>()

const statusText = computed(() => {
  switch (props.overallStatus) {
    case 'importing': return 'importing'
    case 'outdated': return 'outdated'
    default: return 'synced'
  }
})

const statusIcon = computed(() => {
  switch (props.overallStatus) {
    case 'importing': return 'pi pi-download'
    case 'outdated': return 'pi pi-exclamation-triangle'
    default: return 'pi pi-check'
  }
})

const statusTitle = computed(() => {
  switch (props.overallStatus) {
    case 'importing': return 'Importing data from external sources'
    case 'outdated': return 'Last sync was more than 5 minutes ago'
    default: return 'All data is synced'
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
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.sync-indicator:hover {
  background: var(--bg-tertiary);
}

.indicator-label {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  text-transform: lowercase;
}

.indicator-status {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.indicator-status i {
  font-size: 0.7rem;
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

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>

