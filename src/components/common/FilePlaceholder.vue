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

// Extension colors based on file type category
const extensionStyle = computed(() => {
  const ext = extension.value.toLowerCase()
  
  // No extension - neutral style
  if (!ext) {
    const color = '#78909c'
    return { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
  }
  
  const colors: Record<string, string> = {
    // Documents
    pdf: '#e53935',
    doc: '#1976d2', docx: '#1976d2',
    xls: '#2e7d32', xlsx: '#2e7d32', csv: '#2e7d32',
    ppt: '#d84315', pptx: '#d84315',
    txt: '#78909c', md: '#78909c', rtf: '#78909c',
    
    // Images
    jpg: '#9c27b0', jpeg: '#9c27b0', png: '#9c27b0', 
    gif: '#9c27b0', webp: '#9c27b0', svg: '#9c27b0',
    psd: '#00bcd4', ai: '#ff9800',
    
    // Video/Audio
    mp4: '#ff5722', mov: '#ff5722', avi: '#ff5722', mkv: '#ff5722',
    mp3: '#e91e63', wav: '#e91e63', flac: '#e91e63',
    
    // Archives
    zip: '#ffc107', rar: '#ffc107', '7z': '#ffc107', tar: '#ffc107', gz: '#ffc107',
    
    // Code
    js: '#ffca28', ts: '#1976d2', vue: '#42b883', 
    py: '#3776ab', html: '#e44d26', css: '#264de4',
    json: '#78909c', xml: '#78909c',
    
    // CAD/Technical
    dwg: '#c62828', dxf: '#c62828', ifc: '#0d47a1', rvt: '#0d47a1',
  }
  
  const color = colors[ext] || '#607d8b'
  return { 
    backgroundColor: `${color}22`,
    color,
    borderColor: `${color}55`
  }
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

