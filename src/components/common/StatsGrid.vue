<template>
  <div class="stats-grid-container">
    <h4 v-if="title">{{ title }}</h4>
    <div class="stats-grid">
      <div 
        v-for="stat in stats" 
        :key="stat.label"
        :class="['stat-item', stat.variant]"
      >
        <span class="stat-value">{{ formatValue(stat.value) }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface StatItem {
  label: string
  value: number | string
  variant?: 'default' | 'created' | 'linked' | 'skipped' | 'success' | 'warning' | 'error'
}

interface Props {
  title?: string
  stats: StatItem[]
}

defineProps<Props>()

const formatValue = (value: number | string): string => {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return value
}
</script>

<style scoped>
.stats-grid-container {
  padding: 1.25rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.stats-grid-container h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

.stat-item .stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-item .stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-align: center;
  margin-top: 0.25rem;
}

/* Variants */
.stat-item.created .stat-value,
.stat-item.success .stat-value {
  color: #4ade80;
}

.stat-item.linked .stat-value {
  color: var(--accent-primary);
}

.stat-item.skipped .stat-value {
  color: var(--text-secondary);
}

.stat-item.warning .stat-value {
  color: #f5a623;
}

.stat-item.error .stat-value {
  color: #ef4444;
}
</style>

