<template>
  <div class="slash-list" v-if="items.length">
    <button
      v-for="(item, index) in items"
      :key="item.id"
      class="slash-item"
      :class="{ 'is-selected': index === selectedIndex }"
      @click="selectItem(index)"
    >
      <span class="slash-dot" :class="item.category === 'skill' ? 'dot-skill' : 'dot-doc'"></span>
      <span class="slash-item-title">{{ item.title }}</span>
      <span class="slash-item-cat">{{ item.category }}</span>
    </button>
  </div>
  <div class="slash-list" v-else>
    <div class="slash-empty">No skills or docs found</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface TemplateItem {
  id: string
  title: string
  category: 'skill' | 'doc'
  summary: string | null
}

const props = defineProps<{
  items: TemplateItem[]
  command: (attrs: { id: string; label: string }) => void
}>()

const selectedIndex = ref(0)

watch(() => props.items, () => { selectedIndex.value = 0 })

function selectItem(index: number) {
  const item = props.items[index]
  if (item) {
    props.command({ id: item.id, label: item.title })
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
.slash-list {
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

.slash-item {
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
.slash-item:hover,
.slash-item.is-selected {
  background: var(--bg-tertiary, #2a2a3e);
  color: var(--text-primary, #eee);
}

.slash-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-skill { background: #c084fc; }
.dot-doc { background: #22d3ee; }

.slash-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slash-item-cat {
  font-size: 0.75rem;
  color: var(--text-muted, #888);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.slash-empty {
  padding: 0.5rem 0.65rem;
  color: var(--text-muted, #888);
  font-size: 0.9rem;
  font-style: italic;
}

.tippy-box[data-theme~='slash-popup'] {
  background: none;
  box-shadow: none;
  border: none;
  padding: 0;
}
.tippy-box[data-theme~='slash-popup'] > .tippy-content {
  padding: 0;
}
.tippy-box[data-theme~='slash-popup'] > .tippy-arrow {
  display: none;
}
</style>
