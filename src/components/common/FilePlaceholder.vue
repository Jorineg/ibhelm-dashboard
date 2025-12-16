<template>
  <div class="file-placeholder">
    <div class="extension-badge" :style="extensionStyle">
      <template v-if="hasExtension">{{ displayExtension }}</template>
      <i v-else class="pi pi-file no-ext-icon" />
    </div>
    <div class="filename" :title="filename">{{ filename }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getExtensionStyle } from '@/lib/extensionColors'

interface Props {
  filename: string
}

const props = defineProps<Props>()

const extension = computed(() => {
  const parts = props.filename.split('.')
  return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : ''
})

const hasExtension = computed(() => extension.value.length > 0)

const displayExtension = computed(() => {
  const ext = extension.value
  return ext.length > 5 ? ext.slice(0, 4) + '…' : ext
})

const extensionStyle = computed(() => {
  if (!hasExtension.value) {
    const color = '#78909c'
    return { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
  }
  return getExtensionStyle(extension.value)
})
</script>

<style scoped>
.file-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-secondary);
}

.extension-badge {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.6rem 1.25rem;
  border-radius: var(--radius-md);
  border: 2px solid;
  text-transform: uppercase;
  line-height: 1;
}

.no-ext-icon {
  font-size: 2.25rem;
  line-height: 1;
}

.filename {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
  line-height: 1.4;
}
</style>
