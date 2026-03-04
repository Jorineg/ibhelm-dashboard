<template>
  <nav class="view-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="view-tab"
      :class="{ active: tab.active }"
      @click="tab.action"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFilterConfigs } from '@/composables/useFilterConfigs'
import type { ViewType } from '@/types'

const route = useRoute()
const router = useRouter()
const { currentViewType, setCurrentView } = useFilterConfigs()

const viewTypes: { id: ViewType; label: string }[] = [
  { id: 'items', label: 'Items' },
  { id: 'projects', label: 'Projects' },
  { id: 'people', label: 'People' }
]

const tabs = computed(() => [
  ...viewTypes.map(vt => ({
    id: vt.id,
    label: vt.label,
    active: route.path === '/' && currentViewType.value === vt.id,
    action: () => {
      setCurrentView(vt.id)
      if (route.path !== '/') router.push('/')
    }
  })),
  {
    id: 'chat',
    label: 'Chat',
    active: route.path === '/chat',
    action: () => {
      if (route.path !== '/chat') router.push('/chat')
    }
  }
])
</script>

<style scoped>
.view-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.view-tab {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1rem;
  font-weight: 400;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease, background 0.15s ease;
  letter-spacing: 0.01em;
  position: relative;
}

.view-tab:hover:not(.active) {
  color: var(--text-secondary);
}

.view-tab.active {
  color: var(--text-primary);
  font-weight: 600;
}

.view-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 70%;
  height: 2px;
  background: var(--accent-primary);
  border-radius: 1px;
}
</style>
