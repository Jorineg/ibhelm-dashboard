<template>
  <a
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    :class="['source-link', variant, { compact }]"
    :title="title"
    @click.stop
  >
    <i :class="iconClass"></i>
    <span v-if="!compact">{{ label }}</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  url: string
  variant: 'teamwork' | 'missive'
  compact?: boolean
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const iconClass = computed(() => {
  return props.variant === 'teamwork' ? 'pi pi-check-square' : 'pi pi-envelope'
})

const label = computed(() => {
  return props.variant === 'teamwork' ? 'Teamwork' : 'Missive'
})

const title = computed(() => {
  return `Open in ${label.value}`
})
</script>

<style scoped>
.source-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.15s ease;
  border: 1px solid;
}

/* Full size variant */
.source-link:not(.compact) {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
}

/* Compact variant (icon only) */
.source-link.compact {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  justify-content: center;
  font-size: 1rem;
}

/* Teamwork colors */
.source-link.teamwork {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
  border-color: rgba(76, 175, 80, 0.3);
}

.source-link.teamwork:hover {
  background: rgba(76, 175, 80, 0.3);
  transform: translateY(-1px);
}

/* Missive colors */
.source-link.missive {
  background: rgba(33, 150, 243, 0.15);
  color: #2196f3;
  border-color: rgba(33, 150, 243, 0.3);
}

.source-link.missive:hover {
  background: rgba(33, 150, 243, 0.3);
  transform: translateY(-1px);
}

.source-link.compact:hover {
  transform: scale(1.12);
  filter: brightness(1.15);
}

.source-link i {
  font-size: inherit;
}
</style>

