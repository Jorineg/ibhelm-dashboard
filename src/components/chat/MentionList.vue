<template>
  <div class="mention-list" v-if="items.length">
    <button
      v-for="(item, index) in items"
      :key="item.id"
      class="mention-item"
      :class="{ 'is-selected': index === selectedIndex }"
      @click="selectItem(index)"
    >
      <span class="mention-dot" :class="item.status === 'active' ? 'dot-active' : 'dot-inactive'"></span>
      <span class="mention-item-name">{{ item.name }}</span>
      <span v-if="item.company_name" class="mention-item-company">{{ item.company_name }}</span>
    </button>
  </div>
  <div class="mention-list" v-else>
    <div class="mention-empty">No projects found</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface ProjectItem {
  id: number
  name: string
  company_name: string | null
  status: string | null
}

const props = defineProps<{
  items: ProjectItem[]
  command: (attrs: { id: string; label: string }) => void
}>()

const selectedIndex = ref(0)

watch(() => props.items, () => { selectedIndex.value = 0 })

function selectItem(index: number) {
  const item = props.items[index]
  if (item) {
    props.command({ id: String(item.id), label: item.name })
  }
}

function onKeyDown({ event }: { event: KeyboardEvent }): boolean {
  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length
    return true
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    if (!props.items.length) return false
    selectItem(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<style>
.mention-list {
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-primary, #333);
  border-radius: 8px;
  padding: 0.3rem;
  min-width: 240px;
  max-height: 280px;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  scrollbar-width: thin;
  scrollbar-color: var(--border-primary, #333) transparent;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #ccc);
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.1s;
  text-align: left;
  font-family: inherit;
}
.mention-item:hover,
.mention-item.is-selected {
  background: var(--bg-tertiary, #2a2a3e);
  color: var(--text-primary, #eee);
}

.mention-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-active { background: #4ade80; }
.dot-inactive { background: #555; }

.mention-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-item-company {
  font-size: 0.8rem;
  color: var(--text-muted, #888);
  white-space: nowrap;
}

.mention-empty {
  padding: 0.5rem 0.65rem;
  color: var(--text-muted, #888);
  font-size: 0.9rem;
  font-style: italic;
}

/* Tippy overrides for the mention popup */
.tippy-box[data-theme~='mention-popup'] {
  background: none;
  box-shadow: none;
  border: none;
  padding: 0;
}
.tippy-box[data-theme~='mention-popup'] > .tippy-content {
  padding: 0;
}
.tippy-box[data-theme~='mention-popup'] > .tippy-arrow {
  display: none;
}
</style>
