<template>
  <div
    class="email-preview"
    :class="{ loading, 'has-content': !!htmlBody, 'detail-mode': fullResAttachments }"
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
      <!-- Overlay for X-axis tracking while allowing scroll through (detail mode only) -->
      <div
        v-if="htmlBody && fullResAttachments"
        class="email-overlay"
        @wheel="onEmailWheel"
      />
      <div v-if="!htmlBody && loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" />
      </div>
      <div v-if="!htmlBody && !loading" class="empty-state">
        <i class="pi pi-envelope" />
      </div>
    </div>
    
    <!-- Attachment preview (shown when hovering right half) -->
    <div v-if="hasAttachments" class="attachment-section" :class="{ hidden: !showingAttachment }">
      <!-- Full-res mode (detail view) -->
      <template v-if="fullResAttachments">
        <!-- Image preview -->
        <img
          v-if="currentAttachmentIsImage && currentFullUrl"
          :src="currentFullUrl"
          class="attachment-full-image"
          @error="handleFullImageError"
        />
        <!-- PDF preview with canvas pages in scrollable container -->
        <div
          v-else-if="currentAttachmentIsPdf"
          ref="pdfContainerRef"
          class="pdf-scroll-container"
        >
          <div v-if="pdfLoading" class="pdf-loading">
            <i class="pi pi-spin pi-spinner" />
          </div>
          <canvas
            v-for="pageNum in pdfPageCount"
            :key="`${currentAttachment?.file_id}-${pageNum}`"
            :ref="(el) => setPdfCanvasRef(pageNum, el as HTMLCanvasElement)"
            class="pdf-page-canvas"
          />
        </div>
        <!-- Fallback for other types -->
        <FilePlaceholder v-else :filename="currentAttachmentName" />
      </template>
      <!-- Thumbnail mode (gallery view) - fast loading -->
      <template v-else>
        <img
          v-if="currentThumbnailUrl && !failedThumbs.has(currentAttachment?.file_id || '')"
          :src="currentThumbnailUrl"
          class="attachment-thumbnail"
          @error="handleThumbnailError"
        />
        <FilePlaceholder v-else :filename="currentAttachmentName" />
      </template>
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
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import FilePlaceholder from './FilePlaceholder.vue'
import { supabase, supabaseUrl } from '@/lib/supabase'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

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
  fullResAttachments?: boolean // true = fetch full images/PDFs (detail view), false = use thumbnails (gallery)
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  attachments: () => [],
  fullResAttachments: false
})

const { filesBucket } = useAppearanceSettings()
const iframeRef = ref<HTMLIFrameElement | null>(null)
const contentHeight = ref(0)
const containerHeight = ref(0)
const currentAttachmentIndex = ref(0)
const showingAttachment = ref(false)

// Signed URL cache for full images/PDFs (full-res mode)
const signedUrls = ref<Map<string, string>>(new Map())
const failedFullImages = ref(new Set<string>())

// Thumbnail mode tracking
const failedThumbs = ref(new Set<string>())

// PDF rendering state
const pdfContainerRef = ref<HTMLElement | null>(null)
const pdfCanvasRefs = new Map<number, HTMLCanvasElement>()
const pdfPageCount = ref(0)
const pdfLoading = ref(false)
let currentPdfDoc: pdfjsLib.PDFDocumentProxy | null = null
let currentPdfFileId: string | null = null

const setPdfCanvasRef = (pageNum: number, el: HTMLCanvasElement | null) => {
  if (el) {
    pdfCanvasRefs.set(pageNum, el)
  } else {
    pdfCanvasRefs.delete(pageNum)
  }
}

const hasAttachments = computed(() => props.attachments.length > 0)

const currentAttachment = computed(() => 
  props.attachments[currentAttachmentIndex.value] ?? null
)

const currentAttachmentName = computed(() => 
  currentAttachment.value?.filename ?? ''
)

// File type detection
const getExtension = (filename: string) => {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() || '' : ''
}

const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const pdfExtension = 'pdf'

const currentAttachmentIsImage = computed(() => {
  if (!currentAttachment.value) return false
  return imageExtensions.includes(getExtension(currentAttachment.value.filename))
})

const currentAttachmentIsPdf = computed(() => {
  if (!currentAttachment.value) return false
  return getExtension(currentAttachment.value.filename) === pdfExtension
})

const currentFullUrl = computed(() => {
  const att = currentAttachment.value
  if (!att) return null
  if (failedFullImages.value.has(att.file_id)) return null
  return signedUrls.value.get(att.file_id) ?? null
})

const handleFullImageError = () => {
  const att = currentAttachment.value
  if (att) failedFullImages.value.add(att.file_id)
}

// Thumbnail URL (for gallery mode)
const currentThumbnailUrl = computed(() => {
  const att = currentAttachment.value
  if (!att?.thumbnail_path) return null
  return `${supabaseUrl}/storage/v1/object/public/thumbnails/${att.thumbnail_path}`
})

const handleThumbnailError = () => {
  const att = currentAttachment.value
  if (att) failedThumbs.value.add(att.file_id)
}

// Fetch signed URL for an attachment
const fetchSignedUrl = async (attachment: AttachmentFile) => {
  if (signedUrls.value.has(attachment.file_id)) return
  if (!attachment.storage_path) return
  
  const { data, error } = await supabase.storage
    .from(filesBucket.value)
    .createSignedUrl(attachment.storage_path, 3600)
  
  if (!error && data?.signedUrl) {
    signedUrls.value.set(attachment.file_id, data.signedUrl)
  }
}

// Load and render all PDF pages
const loadAndRenderPdf = async (attachment: AttachmentFile) => {
  if (!props.fullResAttachments) return
  if (currentPdfFileId === attachment.file_id && currentPdfDoc) return
  
  // Cleanup previous PDF
  if (currentPdfDoc) {
    currentPdfDoc.destroy()
    currentPdfDoc = null
  }
  currentPdfFileId = attachment.file_id
  pdfPageCount.value = 0
  pdfLoading.value = true
  
  // Get signed URL
  let url = signedUrls.value.get(attachment.file_id)
  if (!url) {
    await fetchSignedUrl(attachment)
    url = signedUrls.value.get(attachment.file_id)
  }
  
  if (!url) {
    pdfLoading.value = false
    return
  }
  
  try {
    const loadingTask = pdfjsLib.getDocument(url)
    currentPdfDoc = await loadingTask.promise
    pdfPageCount.value = currentPdfDoc.numPages
    pdfLoading.value = false
    
    // Wait for canvases to be created
    await nextTick()
    
    // Render all pages
    const containerWidth = pdfContainerRef.value?.clientWidth || 800
    const pixelRatio = window.devicePixelRatio || 1
    
    for (let pageNum = 1; pageNum <= currentPdfDoc.numPages; pageNum++) {
      const canvas = pdfCanvasRefs.get(pageNum)
      if (!canvas) continue
      
      const page = await currentPdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      
      // Scale to fit container width with some padding
      const scale = (containerWidth - 40) / viewport.width
      const scaledViewport = page.getViewport({ scale })
      
      canvas.width = scaledViewport.width * pixelRatio
      canvas.height = scaledViewport.height * pixelRatio
      canvas.style.width = `${scaledViewport.width}px`
      canvas.style.height = `${scaledViewport.height}px`
      
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      
      ctx.scale(pixelRatio, pixelRatio)
      
      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport
      }).promise
    }
  } catch (e) {
    console.error('Error loading PDF:', e)
    pdfLoading.value = false
  }
}

// Prefetch viewable attachments (only in full-res mode)
const prefetchAttachments = async () => {
  if (!props.fullResAttachments) return // Skip in thumbnail mode
  
  for (const att of props.attachments) {
    const ext = getExtension(att.filename)
    if (imageExtensions.includes(ext) || ext === pdfExtension) {
      fetchSignedUrl(att)
    }
  }
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
  
  // Keep checking height as images load
  if (heightCheckInterval) clearInterval(heightCheckInterval)
  
  let stableCount = 0
  let checkCount = 0
  const maxChecks = 25
  
  heightCheckInterval = setInterval(() => {
    checkCount++
    const changed = measureHeight()
    
    if (changed) {
      stableCount = 0
    } else {
      stableCount++
    }
    
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
      // Right half: show attachments
      showingAttachment.value = true
      const attachmentRatio = (xRatio - 0.5) * 2
      const newIndex = Math.min(
        Math.floor(attachmentRatio * props.attachments.length),
        props.attachments.length - 1
      )
      
      if (newIndex !== currentAttachmentIndex.value) {
        currentAttachmentIndex.value = newIndex
        
        // Load and render PDF if needed (full-res mode)
        if (props.fullResAttachments) {
          const att = props.attachments[newIndex]
          if (att && getExtension(att.filename) === pdfExtension) {
            loadAndRenderPdf(att)
          }
        }
      }
    } else {
      showingAttachment.value = false
    }
  }
  
  // Y-axis: scroll email content (only in gallery mode, not detail mode)
  if (!props.fullResAttachments && !showingAttachment.value && iframeRef.value) {
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
  // Only scroll back to top in gallery mode (parallax)
  if (!props.fullResAttachments && iframeRef.value) {
    try {
      iframeRef.value.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Cross-origin errors silently ignored  
    }
  }
}

// Forward wheel events to iframe for scrolling (detail mode)
const onEmailWheel = (e: WheelEvent) => {
  if (!iframeRef.value) return
  try {
    iframeRef.value.contentWindow?.scrollBy({
      top: e.deltaY,
      behavior: 'auto'
    })
  } catch {
    // Cross-origin errors silently ignored
  }
}

// Keyboard scroll methods for external control
const scrollByAmount = (amount: number) => {
  if (!iframeRef.value) return
  try {
    iframeRef.value.contentWindow?.scrollBy({ top: amount, behavior: 'smooth' })
  } catch {
    // Cross-origin errors silently ignored
  }
}

const scrollByPage = (pages: number) => {
  if (!iframeRef.value) return
  const pageHeight = containerHeight.value || iframeRef.value.clientHeight || 400
  scrollByAmount(pages * pageHeight * 0.8)
}

defineExpose({ scrollByAmount, scrollByPage })

// Prefetch on mount and when attachments change
onMounted(() => {
  prefetchAttachments()
})

watch(() => props.attachments, () => {
  currentAttachmentIndex.value = 0
  showingAttachment.value = false
  failedFullImages.value.clear()
  failedThumbs.value.clear()
  signedUrls.value.clear()
  // Cleanup PDF
  if (currentPdfDoc) {
    currentPdfDoc.destroy()
    currentPdfDoc = null
  }
  currentPdfFileId = null
  pdfPageCount.value = 0
  pdfCanvasRefs.clear()
  prefetchAttachments()
})

watch(() => props.htmlBody, () => {
  contentHeight.value = 0
  containerHeight.value = 0
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
  // Cleanup PDF
  if (currentPdfDoc) {
    currentPdfDoc.destroy()
    currentPdfDoc = null
  }
})
</script>

<style scoped>
.email-preview {
  width: 100%;
  height: 100%;
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

.email-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.attachment-section {
  background: var(--bg-primary);
}

.attachment-full-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.pdf-scroll-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #525659;
}

.pdf-page-canvas {
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  background: #fff;
}

.pdf-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-size: 2rem;
}

.attachment-thumbnail {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
  color: var(--text-muted);
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
