<template>
  <div 
    class="file-preview" 
    :class="{ loading: loading && !thumbnailUrl }"
    tabindex="0"
    @keydown="handleKeydown"
    ref="containerRef"
  >
    <!-- Image preview with thumbnail loading state -->
    <div v-if="(isImage || isHeic) && (signedUrl || thumbnailUrl)" class="image-container">
      <!-- Thumbnail shown while full image loads -->
      <img 
        v-if="thumbnailUrl && !fullImageLoaded"
        :src="thumbnailUrl"
        :alt="filename"
        class="preview-image thumbnail-preview"
      />
      <!-- Spinner overlay while loading -->
      <div v-if="thumbnailUrl && !fullImageLoaded && loading" class="loading-overlay">
        <i class="pi pi-spin pi-spinner" />
      </div>
      <!-- Full image (hidden until loaded, or shown directly if no thumbnail) -->
      <img 
        v-show="fullImageLoaded || !thumbnailUrl"
        :src="displayUrl"
        :alt="filename"
        class="preview-image"
        @load="onFullImageLoad"
        @error="handleImageError"
      />
    </div>
    
    <!-- PDF preview with page navigation -->
    <div v-else-if="isPdf && signedUrl && !pdfError" class="pdf-container">
      <!-- Thumbnail shown while PDF loads -->
      <img 
        v-if="thumbnailUrl && !pdfLoaded"
        :src="thumbnailUrl"
        :alt="filename"
        class="pdf-thumbnail"
      />
      <!-- Spinner overlay while loading -->
      <div v-if="thumbnailUrl && !pdfLoaded && loading" class="loading-overlay">
        <i class="pi pi-spin pi-spinner" />
      </div>
      <canvas v-show="pdfLoaded || !thumbnailUrl" ref="canvasRef" class="pdf-canvas" />
      
      <!-- Page indicator (only if multi-page) -->
      <div v-if="totalPages > 1" class="page-indicator">
        <span class="page-current">{{ currentPage }}</span>
        <span class="page-separator">/</span>
        <span class="page-total">{{ totalPages }}</span>
      </div>
      
      <!-- Page navigation hint -->
      <div v-if="totalPages > 1 && showNavHint" class="nav-hint">
        <i class="pi pi-arrow-left" /> <i class="pi pi-arrow-right" /> to navigate
      </div>
    </div>
    
    <!-- PDF error state -->
    <div v-else-if="isPdf && pdfError" class="error-state">
      <i class="pi pi-exclamation-triangle" />
      <span>Could not load PDF preview</span>
    </div>
    
    <!-- SVG preview -->
    <div v-else-if="isSvg && signedUrl" class="image-container svg-container">
      <!-- Thumbnail shown while SVG loads -->
      <img 
        v-if="thumbnailUrl && !fullImageLoaded"
        :src="thumbnailUrl"
        :alt="filename"
        class="preview-image thumbnail-preview"
      />
      <div v-if="thumbnailUrl && !fullImageLoaded && loading" class="loading-overlay">
        <i class="pi pi-spin pi-spinner" />
      </div>
      <img 
        v-show="fullImageLoaded || !thumbnailUrl"
        :src="signedUrl"
        :alt="filename"
        class="preview-image"
        @load="onFullImageLoad"
        @error="handleImageError"
      />
    </div>
    
    <!-- HTML preview in sandboxed iframe -->
    <div v-else-if="isHtml && htmlContent" class="html-container">
      <iframe
        :srcdoc="htmlContent"
        sandbox="allow-same-origin"
        class="html-iframe"
      />
    </div>
    
    <!-- Loading state (only when no thumbnail available) -->
    <div v-else-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner" />
      <span>Loading preview...</span>
    </div>
    
    <!-- Unsupported file type fallback -->
    <div v-else class="unsupported-state">
      <FilePlaceholder :filename="filename" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { heicTo } from 'heic-to'
import FilePlaceholder from './FilePlaceholder.vue'
import { supabase, supabaseUrl } from '@/lib/supabase'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'

// Set PDF.js worker using jsdelivr CDN (most reliable, uses npm registry)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface Props {
  storagePath: string
  filename: string
  thumbnailPath?: string | null
  mimeType?: string
}

const props = defineProps<Props>()

const { filesBucket } = useAppearanceSettings()

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const signedUrl = ref<string | null>(null)
const loading = ref(true)
const imageError = ref(false)
const fullImageLoaded = ref(false)
const pdfLoaded = ref(false)

// HEIC conversion state
const heicConvertedUrl = ref<string | null>(null)

// HTML content state
const htmlContent = ref<string | null>(null)

// PDF state - store document outside Vue reactivity to avoid Proxy issues with private fields
let pdfDocInstance: pdfjsLib.PDFDocumentProxy | null = null
let currentRenderTask: pdfjsLib.RenderTask | null = null
const currentPage = ref(1)
const totalPages = ref(0)
const showNavHint = ref(true)
const pdfError = ref(false)

// Thumbnail URL
const thumbnailUrl = computed(() => {
  if (!props.thumbnailPath) return null
  return `${supabaseUrl}/storage/v1/object/public/thumbnails/${props.thumbnailPath}`
})

// File type detection
const extension = computed(() => {
  const parts = props.filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() || '' : ''
})

const isImage = computed(() => 
  ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension.value)
)

const isHeic = computed(() => ['heic', 'heif'].includes(extension.value))

const isPdf = computed(() => extension.value === 'pdf')

const isSvg = computed(() => extension.value === 'svg')

const isHtml = computed(() => ['html', 'htm'].includes(extension.value))

const isDisplayable = computed(() => 
  isImage.value || isPdf.value || isHeic.value || isSvg.value || isHtml.value
)

// URL to display for images (either signed URL or converted HEIC)
const displayUrl = computed(() => heicConvertedUrl.value || signedUrl.value)

// Handle full image loaded
const onFullImageLoad = () => {
  fullImageLoaded.value = true
  loading.value = false
}

// Convert HEIC on main thread (heic-to uses Canvas which requires DOM)
const convertHeic = async (url: string) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const result = await heicTo({ blob, type: 'image/jpeg', quality: 0.9 })
    heicConvertedUrl.value = URL.createObjectURL(result as Blob)
  } catch (e) {
    console.error('HEIC conversion failed:', e)
  }
  loading.value = false
}

// Load HTML content for iframe rendering
const loadHtmlContent = async (url: string) => {
  try {
    const response = await fetch(url)
    htmlContent.value = await response.text()
  } catch (e) {
    console.error('Failed to load HTML:', e)
  }
  loading.value = false
}

// Get signed URL
const fetchSignedUrl = async () => {
  if (!props.storagePath) return
  
  loading.value = true
  fullImageLoaded.value = false
  pdfLoaded.value = false
  
  const { data, error } = await supabase.storage
    .from(filesBucket.value)
    .createSignedUrl(props.storagePath, 3600) // 1 hour
  
  if (!error && data?.signedUrl) {
    signedUrl.value = data.signedUrl
    
    if (isPdf.value) {
      await loadPdf(data.signedUrl)
    } else if (isHeic.value) {
      await convertHeic(data.signedUrl)
    } else if (isHtml.value) {
      await loadHtmlContent(data.signedUrl)
    } else if (!isImage.value && !isSvg.value) {
      // For non-displayable files, stop loading
      loading.value = false
    }
    // For images and SVGs, loading will be set to false via onFullImageLoad
  } else {
    loading.value = false
  }
}

// PDF loading
const loadPdf = async (url: string) => {
  try {
    pdfError.value = false
    // Load PDF - store in plain variable to avoid Vue Proxy wrapping private fields
    const loadingTask = pdfjsLib.getDocument(url)
    pdfDocInstance = await loadingTask.promise
    totalPages.value = pdfDocInstance.numPages
    currentPage.value = 1
    await renderPage(1)
    pdfLoaded.value = true
    loading.value = false
  } catch (e) {
    console.error('Error loading PDF:', e)
    pdfError.value = true
    pdfDocInstance = null
    loading.value = false
  }
}

const renderPage = async (pageNum: number) => {
  if (!pdfDocInstance || !canvasRef.value) return
  
  // Cancel any pending render task to avoid overlapping renders
  if (currentRenderTask) {
    currentRenderTask.cancel()
    currentRenderTask = null
  }
  
  try {
    const page = await pdfDocInstance.getPage(pageNum)
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Calculate scale to fit container
    const container = containerRef.value
    if (!container) return
    
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight - 40 // space for page indicator
    
    const viewport = page.getViewport({ scale: 1 })
    const scaleX = containerWidth / viewport.width
    const scaleY = containerHeight / viewport.height
    const scale = Math.min(scaleX, scaleY, 2) // max 2x for quality
    
    const scaledViewport = page.getViewport({ scale })
    
    // Set canvas dimensions for sharp rendering
    const pixelRatio = window.devicePixelRatio || 1
    canvas.width = scaledViewport.width * pixelRatio
    canvas.height = scaledViewport.height * pixelRatio
    canvas.style.width = `${scaledViewport.width}px`
    canvas.style.height = `${scaledViewport.height}px`
    
    // Reset transform before scaling (fixes accumulated transform bug)
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    
    currentRenderTask = page.render({
      canvasContext: ctx,
      viewport: scaledViewport
    })
    
    await currentRenderTask.promise
    currentRenderTask = null
  } catch (e: any) {
    // Ignore cancelled render errors (expected when navigating quickly)
    if (e?.name !== 'RenderingCancelledException') {
      console.error('Error rendering page:', e)
    }
  }
}

// Navigate PDF pages
const goToNextPage = () => {
  if (!isPdf.value || totalPages.value <= 1) return false
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    renderPage(currentPage.value)
    showNavHint.value = false
    return true
  }
  return false
}

const goToPrevPage = () => {
  if (!isPdf.value || totalPages.value <= 1) return false
  if (currentPage.value > 1) {
    currentPage.value--
    renderPage(currentPage.value)
    showNavHint.value = false
    return true
  }
  return false
}

// Keyboard navigation
const handleKeydown = (e: KeyboardEvent) => {
  if (!isPdf.value || totalPages.value <= 1) return
  
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    goToNextPage()
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    goToPrevPage()
  } else if (e.key === 'PageDown') {
    e.preventDefault()
    goToNextPage()
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    goToPrevPage()
  }
}

const handleImageError = () => {
  imageError.value = true
}

// Focus container on mount for keyboard events
onMounted(() => {
  fetchSignedUrl()
  containerRef.value?.focus()
})

// Watch for storage path changes
watch(() => props.storagePath, () => {
  signedUrl.value = null
  // Cancel pending render and clean up PDF
  if (currentRenderTask) {
    currentRenderTask.cancel()
    currentRenderTask = null
  }
  if (pdfDocInstance) {
    pdfDocInstance.destroy()
  }
  pdfDocInstance = null
  currentPage.value = 1
  totalPages.value = 0
  imageError.value = false
  pdfError.value = false
  fullImageLoaded.value = false
  pdfLoaded.value = false
  htmlContent.value = null
  // Clean up previous HEIC conversion
  if (heicConvertedUrl.value) {
    URL.revokeObjectURL(heicConvertedUrl.value)
    heicConvertedUrl.value = null
  }
  fetchSignedUrl()
})

// Re-render PDF on resize
let resizeTimeout: ReturnType<typeof setTimeout> | null = null
const handleResize = () => {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    if (pdfDocInstance && currentPage.value) {
      renderPage(currentPage.value)
    }
  }, 150)
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimeout) clearTimeout(resizeTimeout)
  // Cancel pending render task
  if (currentRenderTask) {
    currentRenderTask.cancel()
    currentRenderTask = null
  }
  // Clean up PDF document
  if (pdfDocInstance) {
    pdfDocInstance.destroy()
    pdfDocInstance = null
  }
  // Clean up HEIC conversion
  if (heicConvertedUrl.value) {
    URL.revokeObjectURL(heicConvertedUrl.value)
  }
})

defineExpose({ isDisplayable, goToNextPage, goToPrevPage })
</script>

<style scoped>
.file-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  overflow: hidden;
  outline: none;
  position: relative;
}

.file-preview:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
}

.image-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.image-container.svg-container {
  background: #fff;
  border-radius: var(--radius-sm);
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.thumbnail-preview {
  /* Scale up thumbnail to fill container like the full image would */
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

.loading-overlay .pi {
  font-size: 3rem;
  color: var(--accent-primary);
}

.pdf-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.pdf-thumbnail {
  /* Enlarged to fill container like the full PDF would */
  width: 100%;
  height: calc(100% - 2.5rem);
  object-fit: contain;
}

.pdf-canvas {
  max-width: 100%;
  max-height: calc(100% - 2.5rem);
}

.page-indicator {
  position: absolute;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.8rem;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 16px;
  font-size: 0.85rem;
  color: #fff;
  font-weight: 500;
  z-index: 10;
}

.page-current {
  color: var(--accent-primary);
  font-weight: 700;
}

.page-separator {
  opacity: 0.5;
}

.page-total {
  opacity: 0.8;
}

.nav-hint {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.7rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
  z-index: 10;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.nav-hint .pi {
  font-size: 0.7rem;
  opacity: 0.8;
}

.loading-state,
.unsupported-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-muted);
  width: 100%;
  height: 100%;
}

.loading-state .pi {
  font-size: 2rem;
  color: var(--accent-primary);
}

.error-state .pi {
  font-size: 2rem;
  color: #ef4444;
}

.html-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: #fff;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.html-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}
</style>

