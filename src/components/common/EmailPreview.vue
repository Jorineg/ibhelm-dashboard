<template>
  <div
    class="email-preview"
    :class="{ loading, 'has-content': !!htmlBody, 'detail-mode': fullResAttachments }"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="email-section" :class="{ hidden: showingAttachment }">
      <iframe
        v-if="htmlBody"
        ref="iframeRef"
        :srcdoc="sanitizedHtml"
        sandbox="allow-same-origin"
        class="email-iframe"
        @load="onIframeLoad"
      />
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
    
    <div v-if="hasAttachments" class="attachment-section" :class="{ hidden: !showingAttachment }">
      <template v-if="fullResAttachments">
        <!-- Image: preloaded blob URLs for instant switching -->
        <template v-if="currentAttachmentIsImage">
          <img
            v-if="currentImageBlobUrl"
            :key="currentAttachment?.file_id"
            :src="currentImageBlobUrl"
            class="attachment-full-image"
          />
          <div v-else-if="imageErrors.has(currentAttachment?.file_id ?? '')" class="attachment-error">
            <i class="pi pi-exclamation-triangle" />
            <span>Failed to load image</span>
            <button class="retry-btn" @click="retryImage(currentAttachment!)">Retry</button>
          </div>
          <div v-else class="attachment-loading">
            <i class="pi pi-spin pi-spinner" />
          </div>
        </template>
        
        <!-- PDF: rendered to canvas with generation-based cancellation -->
        <div
          v-else-if="currentAttachmentIsPdf"
          ref="pdfContainerRef"
          class="pdf-scroll-container"
        >
          <div v-if="pdfLoading" class="pdf-loading">
            <i class="pi pi-spin pi-spinner" />
          </div>
          <div v-else-if="pdfError" class="attachment-error pdf-error">
            <i class="pi pi-exclamation-triangle" />
            <span>{{ pdfError }}</span>
            <button class="retry-btn" @click="retryPdf">Retry</button>
          </div>
          <canvas
            v-for="pageNum in pdfPageCount"
            :key="`${currentAttachment?.file_id}-${pageNum}`"
            :ref="(el) => setPdfCanvasRef(pageNum, el as HTMLCanvasElement)"
            class="pdf-page-canvas"
          />
        </div>
        
        <FilePlaceholder v-else :filename="currentAttachmentName" />
      </template>
      
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
  fullResAttachments?: boolean
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

// Signed URL cache (intermediate for images, direct for PDFs)
const signedUrls = ref<Map<string, string>>(new Map())

// Image preload: fetch as blob for instant display, no stale-image issues
const imageBlobUrls = ref<Map<string, string>>(new Map())
const imageErrors = ref(new Set<string>())
const imageLoading = ref(new Set<string>())

// Thumbnail mode
const failedThumbs = ref(new Set<string>())

// PDF state
const pdfContainerRef = ref<HTMLElement | null>(null)
const pdfCanvasRefs = new Map<number, HTMLCanvasElement>()
const pdfPageCount = ref(0)
const pdfLoading = ref(false)
const pdfError = ref<string | null>(null)
let currentPdfDoc: pdfjsLib.PDFDocumentProxy | null = null
let currentPdfFileId: string | null = null
let pdfGeneration = 0
let destroyed = false

const setPdfCanvasRef = (pageNum: number, el: HTMLCanvasElement | null) => {
  if (el) pdfCanvasRefs.set(pageNum, el)
  else pdfCanvasRefs.delete(pageNum)
}

const hasAttachments = computed(() => props.attachments.length > 0)
const currentAttachment = computed(() => props.attachments[currentAttachmentIndex.value] ?? null)
const currentAttachmentName = computed(() => currentAttachment.value?.filename ?? '')

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

const currentImageBlobUrl = computed(() => {
  const att = currentAttachment.value
  if (!att) return null
  return imageBlobUrls.value.get(att.file_id) ?? null
})

const currentThumbnailUrl = computed(() => {
  const att = currentAttachment.value
  if (!att?.thumbnail_path) return null
  return `${supabaseUrl}/storage/v1/object/public/thumbnails/${att.thumbnail_path}`
})

const handleThumbnailError = () => {
  const att = currentAttachment.value
  if (att) failedThumbs.value.add(att.file_id)
}

// --- Signed URL fetching ---

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

// --- Image preloading via blob URLs ---

const preloadImage = async (att: AttachmentFile) => {
  const fileId = att.file_id
  if (imageBlobUrls.value.has(fileId) || imageLoading.value.has(fileId)) return

  let url = signedUrls.value.get(fileId)
  if (!url) {
    await fetchSignedUrl(att)
    if (destroyed) return
    url = signedUrls.value.get(fileId)
  }
  if (!url) {
    imageErrors.value.add(fileId)
    return
  }

  imageLoading.value.add(fileId)
  try {
    const resp = await fetch(url)
    if (destroyed) return
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const blob = await resp.blob()
    if (destroyed) return
    imageBlobUrls.value.set(fileId, URL.createObjectURL(blob))
  } catch {
    if (!destroyed) imageErrors.value.add(fileId)
  } finally {
    imageLoading.value.delete(fileId)
  }
}

const retryImage = (att: AttachmentFile) => {
  imageErrors.value.delete(att.file_id)
  signedUrls.value.delete(att.file_id)
  preloadImage(att)
}

// --- PDF rendering ---

const renderPdfPages = async (doc: pdfjsLib.PDFDocumentProxy, gen: number) => {
  await nextTick()
  if (gen !== pdfGeneration || destroyed) return
  await new Promise<void>(r => requestAnimationFrame(() => r()))
  if (gen !== pdfGeneration || destroyed) return

  let containerWidth = pdfContainerRef.value?.clientWidth ?? 0
  if (containerWidth < 100) {
    await new Promise(r => setTimeout(r, 60))
    if (gen !== pdfGeneration || destroyed) return
    containerWidth = pdfContainerRef.value?.clientWidth || 800
  }

  const pixelRatio = window.devicePixelRatio || 1

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    if (gen !== pdfGeneration || destroyed) return

    const canvas = pdfCanvasRefs.get(pageNum)
    if (!canvas) continue

    const page = await doc.getPage(pageNum)
    if (gen !== pdfGeneration || destroyed) return

    const viewport = page.getViewport({ scale: 1 })
    const scale = (containerWidth - 40) / viewport.width
    const scaledViewport = page.getViewport({ scale })

    canvas.width = scaledViewport.width * pixelRatio
    canvas.height = scaledViewport.height * pixelRatio
    canvas.style.width = `${scaledViewport.width}px`
    canvas.style.height = `${scaledViewport.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.scale(pixelRatio, pixelRatio)

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
  }
}

const loadAndRenderPdf = async (attachment: AttachmentFile) => {
  if (!props.fullResAttachments) return

  // Same PDF already loaded — re-render to (possibly recreated) canvases
  if (currentPdfFileId === attachment.file_id && currentPdfDoc) {
    const gen = ++pdfGeneration
    try { await renderPdfPages(currentPdfDoc, gen) } catch { /* stale */ }
    return
  }

  const gen = ++pdfGeneration

  if (currentPdfDoc) {
    currentPdfDoc.destroy()
    currentPdfDoc = null
  }
  currentPdfFileId = attachment.file_id
  pdfPageCount.value = 0
  pdfError.value = null
  pdfLoading.value = true

  let url = signedUrls.value.get(attachment.file_id)
  if (!url) {
    await fetchSignedUrl(attachment)
    if (gen !== pdfGeneration || destroyed) return
    url = signedUrls.value.get(attachment.file_id)
  }

  if (!url) {
    pdfLoading.value = false
    pdfError.value = 'Could not load PDF — signed URL unavailable'
    return
  }

  try {
    const loadingTask = pdfjsLib.getDocument(url)
    const doc = await loadingTask.promise
    if (gen !== pdfGeneration || destroyed) { doc.destroy(); return }

    currentPdfDoc = doc
    pdfPageCount.value = doc.numPages
    pdfLoading.value = false

    await renderPdfPages(doc, gen)
  } catch (e) {
    if (gen !== pdfGeneration || destroyed) return
    console.error('PDF render error:', e)
    pdfLoading.value = false
    pdfError.value = 'Failed to render PDF'
  }
}

const retryPdf = () => {
  const att = currentAttachment.value
  if (!att) return
  pdfError.value = null
  currentPdfFileId = null
  signedUrls.value.delete(att.file_id)
  loadAndRenderPdf(att)
}

// --- Prefetch ---

const prefetchAttachments = () => {
  if (!props.fullResAttachments) return
  for (const att of props.attachments) {
    const ext = getExtension(att.filename)
    if (imageExtensions.includes(ext)) preloadImage(att)
    else if (ext === pdfExtension) fetchSignedUrl(att)
  }
}

// --- Cleanup ---

const cleanupImageBlobs = () => {
  for (const blobUrl of imageBlobUrls.value.values()) {
    URL.revokeObjectURL(blobUrl)
  }
  imageBlobUrls.value.clear()
  imageErrors.value.clear()
  imageLoading.value.clear()
}

const cleanupPdf = () => {
  pdfGeneration++
  if (currentPdfDoc) {
    currentPdfDoc.destroy()
    currentPdfDoc = null
  }
  currentPdfFileId = null
  pdfPageCount.value = 0
  pdfCanvasRefs.clear()
  pdfError.value = null
}

// --- HTML ---

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

// --- Iframe height ---

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
  } catch { /* cross-origin */ }
  return false
}

const onIframeLoad = () => {
  measureHeight()
  if (heightCheckInterval) clearInterval(heightCheckInterval)

  let stableCount = 0
  let checkCount = 0

  heightCheckInterval = setInterval(() => {
    checkCount++
    if (measureHeight()) stableCount = 0
    else stableCount++

    if (stableCount >= 5 || checkCount >= 25) {
      if (heightCheckInterval) {
        clearInterval(heightCheckInterval)
        heightCheckInterval = null
      }
    }
  }, 200)
}

// --- Mouse interaction ---

const onMouseMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const xRatio = (e.clientX - rect.left) / rect.width
  const yRatio = (e.clientY - rect.top) / rect.height

  if (hasAttachments.value) {
    if (xRatio > 0.5) {
      const wasShowing = showingAttachment.value
      showingAttachment.value = true
      const attachmentRatio = (xRatio - 0.5) * 2
      const newIndex = Math.min(
        Math.floor(attachmentRatio * props.attachments.length),
        props.attachments.length - 1
      )

      const indexChanged = newIndex !== currentAttachmentIndex.value
      if (indexChanged) currentAttachmentIndex.value = newIndex

      if (props.fullResAttachments && (indexChanged || !wasShowing)) {
        const att = props.attachments[newIndex]
        if (att && getExtension(att.filename) === pdfExtension) {
          loadAndRenderPdf(att)
        }
      }
    } else {
      showingAttachment.value = false
    }
  }

  if (!props.fullResAttachments && !showingAttachment.value && iframeRef.value) {
    measureHeight()
    if (contentHeight.value > containerHeight.value) {
      const maxScroll = contentHeight.value - containerHeight.value
      try {
        iframeRef.value.contentWindow?.scrollTo({ top: yRatio * maxScroll, behavior: 'auto' })
      } catch { /* cross-origin */ }
    }
  }
}

const onMouseLeave = () => {
  showingAttachment.value = false
  currentAttachmentIndex.value = 0
  if (!props.fullResAttachments && iframeRef.value) {
    try {
      iframeRef.value.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { /* cross-origin */ }
  }
}

const onEmailWheel = (e: WheelEvent) => {
  if (!iframeRef.value) return
  try {
    iframeRef.value.contentWindow?.scrollBy({ top: e.deltaY, behavior: 'auto' })
  } catch { /* cross-origin */ }
}

const scrollByAmount = (amount: number) => {
  if (!iframeRef.value) return
  try {
    iframeRef.value.contentWindow?.scrollBy({ top: amount, behavior: 'smooth' })
  } catch { /* cross-origin */ }
}

const scrollByPage = (pages: number) => {
  if (!iframeRef.value) return
  scrollByAmount(pages * (containerHeight.value || iframeRef.value.clientHeight || 400) * 0.8)
}

defineExpose({ scrollByAmount, scrollByPage })

// --- Lifecycle ---

onMounted(() => prefetchAttachments())

watch(() => props.attachments, () => {
  currentAttachmentIndex.value = 0
  showingAttachment.value = false
  failedThumbs.value.clear()
  signedUrls.value.clear()
  cleanupImageBlobs()
  cleanupPdf()
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
  destroyed = true
  if (heightCheckInterval) {
    clearInterval(heightCheckInterval)
    heightCheckInterval = null
  }
  cleanupPdf()
  cleanupImageBlobs()
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

.pdf-loading,
.attachment-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-muted);
  font-size: 2rem;
}

.pdf-loading {
  color: #fff;
}

.attachment-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.attachment-error .pi-exclamation-triangle {
  font-size: 2rem;
  color: var(--color-warning, #e6a817);
}

.attachment-error.pdf-error {
  color: rgba(255, 255, 255, 0.7);
}

.attachment-error.pdf-error .pi-exclamation-triangle {
  color: #ffc107;
}

.retry-btn {
  padding: 6px 16px;
  border: 1px solid var(--border-primary, #555);
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.retry-btn:hover {
  background: rgba(128, 128, 128, 0.2);
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
