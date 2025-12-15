<template>
  <div
    class="email-preview"
    :class="{ loading, 'has-content': !!htmlBody }"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Email content (full width, shown when hovering left half) -->
    <div class="email-section" :class="{ hidden: showingAttachment }">
      <iframe
        v-if="htmlBody"
        ref="iframeRef"
        :srcdoc="sanitizedHtml"
        sandbox="allow-same-origin"
        class="email-iframe"
        @load="onIframeLoad"
      />
      <div v-else-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" />
      </div>
      <div v-else class="empty-state">
        <i class="pi pi-envelope" />
      </div>
    </div>
    
    <!-- Attachment thumbnail (full width, shown when hovering right half) -->
    <div v-if="hasAttachments" class="attachment-section" :class="{ hidden: !showingAttachment }">
      <img
        v-if="currentAttachmentUrl"
        :src="currentAttachmentUrl"
        class="attachment-thumbnail"
        @error="handleAttachmentError"
      />
      <FilePlaceholder v-else :filename="currentAttachmentName" />
    </div>
    
    <!-- Indicator dots (always visible when attachments exist) -->
    <div v-if="hasAttachments" class="indicator-dots">
      <span class="dot email-dot" :class="{ active: !showingAttachment }" title="Email">
        <i class="pi pi-envelope" />
      </span>
      <span
        v-for="(att, idx) in attachments"
        :key="idx"
        class="dot"
        :class="{ active: showingAttachment && idx === currentAttachmentIndex }"
        :title="att.filename"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import FilePlaceholder from './FilePlaceholder.vue'

interface AttachmentFile {
  file_id: string
  filename: string
  storage_path: string
  thumbnail_path: string | null
}

interface Props {
  htmlBody: string | null
  loading?: boolean
  attachments?: AttachmentFile[]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  attachments: () => []
})

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

const iframeRef = ref<HTMLIFrameElement | null>(null)
const contentHeight = ref(0)
const containerHeight = ref(0)
const currentAttachmentIndex = ref(0)
const showingAttachment = ref(false)
const failedAttachmentThumbs = ref(new Set<string>())

const hasAttachments = computed(() => props.attachments.length > 0)

const currentAttachment = computed(() => 
  props.attachments[currentAttachmentIndex.value] ?? null
)

const currentAttachmentUrl = computed(() => {
  const att = currentAttachment.value
  if (!att?.thumbnail_path) return null
  if (failedAttachmentThumbs.value.has(att.thumbnail_path)) return null
  return `${supabaseUrl}/storage/v1/object/public/thumbnails/${att.thumbnail_path}`
})

const currentAttachmentName = computed(() => 
  currentAttachment.value?.filename ?? ''
)

const handleAttachmentError = () => {
  const path = currentAttachment.value?.thumbnail_path
  if (path) failedAttachmentThumbs.value.add(path)
}

// Sanitize HTML
const sanitizedHtml = computed(() => {
  if (!props.htmlBody) return ''
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #1a1a2e;
      background: #fafafa;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img { max-width: 100%; height: auto; }
    a { color: #4a6fa5; }
    blockquote {
      margin: 0.5em 0;
      padding-left: 1em;
      border-left: 3px solid #ddd;
      color: #666;
    }
    pre, code {
      background: #f0f0f0;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
    table { border-collapse: collapse; max-width: 100%; }
    td, th { padding: 4px 8px; border: 1px solid #ddd; }
  </style>
</head>
<body>${props.htmlBody}</body>
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
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const xRatio = (e.clientX - rect.left) / rect.width
  const yRatio = (e.clientY - rect.top) / rect.height
  
  // X-axis: switch between email (left half) and attachments (right half)
  if (hasAttachments.value) {
    if (xRatio > 0.5) {
      // Right half: show attachments, cycle based on position
      showingAttachment.value = true
      const attachmentRatio = (xRatio - 0.5) * 2 // 0-1 within right half
      const newIndex = Math.min(
        Math.floor(attachmentRatio * props.attachments.length),
        props.attachments.length - 1
      )
      currentAttachmentIndex.value = newIndex
    } else {
      // Left half: show email
      showingAttachment.value = false
    }
  }
  
  // Y-axis: scroll email content (only when showing email)
  if (!showingAttachment.value && iframeRef.value) {
    // Re-measure height on every move (images may have loaded)
    measureHeight()
    
    if (contentHeight.value > containerHeight.value) {
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
  }
}

const onMouseLeave = () => {
  showingAttachment.value = false
  currentAttachmentIndex.value = 0
  if (iframeRef.value) {
    try {
      iframeRef.value.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Cross-origin errors silently ignored  
    }
  }
}

// Re-measure on content change
watch(() => props.htmlBody, () => {
  contentHeight.value = 0
  containerHeight.value = 0
})

// Reset state when attachments change
watch(() => props.attachments, () => {
  currentAttachmentIndex.value = 0
  showingAttachment.value = false
  failedAttachmentThumbs.value.clear()
})

// Cleanup height check interval on htmlBody change
watch(() => props.htmlBody, () => {
  if (heightCheckInterval) {
    clearInterval(heightCheckInterval)
    heightCheckInterval = null
  }
})

onUnmounted(() => {
  if (heightCheckInterval) {
    clearInterval(heightCheckInterval)
    heightCheckInterval = null
  }
})
</script>

<style scoped>
.email-preview {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-tertiary);
  position: relative;
}

.email-section,
.attachment-section {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease;
}

.email-section.hidden,
.attachment-section.hidden {
  opacity: 0;
  pointer-events: none;
}

.email-iframe {
  width: 100%;
  height: 100%;
  border: none;
  pointer-events: none;
}

.attachment-section {
  background: var(--bg-secondary);
}

.attachment-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.indicator-dots {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  padding: 6px 10px;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(120, 120, 130, 0.4);
  transition: transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1),
              background 0.1s ease,
              box-shadow 0.1s ease;
  flex-shrink: 0;
}

.dot.active {
  background: var(--accent-primary, #4a9eff);
  transform: scale(1.3);
  box-shadow: 0 0 6px var(--accent-primary, #4a9eff);
}

.dot.email-dot {
  width: auto;
  height: auto;
  border-radius: 0;
  background: none !important;
  box-shadow: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: none !important;
}

.dot.email-dot .pi {
  font-size: 1rem;
  color: rgba(100, 100, 110, 0.6);
  transition: transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1),
              color 0.1s ease;
  line-height: 1;
}

.dot.email-dot.active .pi {
  color: var(--accent-primary, #4a9eff);
  transform: scale(1.2);
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

