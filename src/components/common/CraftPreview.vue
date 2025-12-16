<template>
  <div
    class="craft-preview"
    :class="{ 'has-content': !!markdown, loading, 'detail-mode': detailMode }"
    @mousemove="!detailMode && onMouseMove($event)"
    @mouseleave="!detailMode && onMouseLeave()"
  >
    <iframe
      v-if="markdown"
      ref="iframeRef"
      :srcdoc="renderedHtml"
      sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
      class="craft-iframe"
      :class="{ scrollable: detailMode }"
      @load="onIframeLoad"
    />
    <div v-else-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" />
    </div>
    <div v-else class="empty-state">
      <i class="pi pi-file-edit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { marked } from 'marked'

interface Props {
  markdown: string | null
  loading?: boolean
  detailMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  detailMode: false
})

const iframeRef = ref<HTMLIFrameElement | null>(null)
const contentHeight = ref(0)
const containerHeight = ref(0)

// Render markdown to HTML with styling
const renderedHtml = computed(() => {
  if (!props.markdown) return ''
  
  const htmlContent = marked(props.markdown, { breaks: true, gfm: true })
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a2e;
      background: #fefefe;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    h1, h2, h3, h4, h5, h6 {
      margin: 0.5em 0 0.3em;
      font-weight: 600;
      line-height: 1.3;
      color: #111;
    }
    h1 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.3em; }
    h3 { font-size: 1.15em; }
    p { margin: 0.5em 0; }
    img { max-width: 100%; height: auto; border-radius: 4px; }
    a { color: #4a6fa5; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
    li { margin: 0.2em 0; }
    blockquote {
      margin: 0.5em 0;
      padding: 0.5em 1em;
      border-left: 3px solid #4a6fa5;
      background: #f8f9fa;
      color: #555;
    }
    pre {
      background: #f4f4f4;
      padding: 0.75em;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.9em;
    }
    code {
      background: #f4f4f4;
      padding: 0.15em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
    td, th { padding: 0.5em; border: 1px solid #ddd; text-align: left; }
    th { background: #f8f9fa; font-weight: 600; }
    hr { border: none; border-top: 1px solid #eee; margin: 1em 0; }
  </style>
</head>
<body>${htmlContent}</body>
<script>
  document.querySelectorAll('a').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
<\/script>
</html>`
})

let heightCheckInterval: ReturnType<typeof setInterval> | null = null

const measureHeight = () => {
  if (!iframeRef.value) return false
  try {
    const doc = iframeRef.value.contentDocument
    if (doc?.body) {
      const newHeight = doc.body.scrollHeight
      const changed = newHeight !== contentHeight.value
      contentHeight.value = newHeight
      containerHeight.value = iframeRef.value.clientHeight
      return changed
    }
  } catch {
    // Cross-origin errors silently ignored
  }
  return false
}

const onIframeLoad = () => {
  measureHeight()
  
  // Keep checking height as images load (stop after 5s or when stable for 1s)
  if (heightCheckInterval) clearInterval(heightCheckInterval)
  
  let stableCount = 0
  let checkCount = 0
  const maxChecks = 25 // 5 seconds max
  
  heightCheckInterval = setInterval(() => {
    checkCount++
    const changed = measureHeight()
    
    if (changed) {
      stableCount = 0
    } else {
      stableCount++
    }
    
    // Stop if stable for 1s (5 checks) or max time reached
    if (stableCount >= 5 || checkCount >= maxChecks) {
      if (heightCheckInterval) {
        clearInterval(heightCheckInterval)
        heightCheckInterval = null
      }
    }
  }, 200)
}

const onMouseMove = (e: MouseEvent) => {
  if (!iframeRef.value) return
  
  // Re-measure height on every move (images may have loaded)
  measureHeight()
  
  if (contentHeight.value <= containerHeight.value) return
  
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const yRatio = (e.clientY - rect.top) / rect.height
  const maxScroll = contentHeight.value - containerHeight.value
  
  try {
    iframeRef.value.contentWindow?.scrollTo({
      top: yRatio * maxScroll,
      behavior: 'auto'
    })
  } catch {
    // Cross-origin errors silently ignored
  }
}

const onMouseLeave = () => {
  if (!iframeRef.value) return
  try {
    iframeRef.value.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    // Cross-origin errors silently ignored  
  }
}

// Re-measure on content change
watch(() => props.markdown, () => {
  if (heightCheckInterval) {
    clearInterval(heightCheckInterval)
    heightCheckInterval = null
  }
  contentHeight.value = 0
  containerHeight.value = 0
})

onUnmounted(() => {
  if (heightCheckInterval) {
    clearInterval(heightCheckInterval)
    heightCheckInterval = null
  }
})
</script>

<style scoped>
.craft-preview {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-tertiary);
  position: relative;
}

.craft-iframe {
  width: 100%;
  height: 100%;
  border: none;
  pointer-events: none;
}

.craft-iframe.scrollable {
  pointer-events: auto;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 2rem;
  width: 100%;
  height: 100%;
}

.loading-state .pi-spinner {
  font-size: 1.5rem;
}
</style>

