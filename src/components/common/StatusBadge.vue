<template>
  <span :class="['status-badge', status]">
    {{ label || status }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  status: 'running' | 'completed' | 'failed' | 'pending'
  label?: string
}

defineProps<Props>()
</script>

<style scoped>
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.running,
.status-badge.pending {
  background: rgba(245, 166, 35, 0.2);
  color: #f5a623;
}

.status-badge.completed {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.status-badge.failed {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}
</style>

