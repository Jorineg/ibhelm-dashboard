<template>
  <router-view />
  <div class="version-tag">V: {{ buildTime }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
</script>

<style scoped>
.version-tag {
  position: fixed;
  bottom: 8px;
  left: 12px;
  font-size: 11px;
  color: var(--text-disabled);
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  pointer-events: none;
  z-index: 9999;
}
</style>
