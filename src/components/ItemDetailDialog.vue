<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :style="dialogStyle"
    :dismissable-mask="true"
    :pt="{
      content: { style: 'padding: 0; overflow: hidden; height: 100%;' },
      header: { style: 'padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-primary); overflow: hidden;' }
    }"
    @keydown="handleDialogKeydown"
  >
    <template #header>
      <div class="dialog-header-content">
        <TypeLinkButton v-if="item" :item="item" :item-type="detectedItemType" />
        <span class="dialog-title">{{ dialogTitle }}</span>
      </div>
    </template>

    <div v-if="item" class="detail-layout" :class="layoutClass">
      <!-- Preview-focused layout for Email, Craft, File -->
      <template v-if="hasPreviewLayout">
        <!-- Main content area with preview -->
        <div class="preview-main" ref="previewMainRef">
          <!-- Email preview -->
          <template v-if="isEmail">
            <EmailPreview
              v-if="emailHtmlBody || loadingEmailBody"
              :html-body="emailHtmlBody"
              :loading="loadingEmailBody"
              :attachments="emailAttachmentFiles"
              :full-res-attachments="true"
              class="detail-email-preview"
            />
            <div v-else class="empty-preview">
              <i class="pi pi-envelope" />
              <span>No email content available</span>
            </div>
          </template>
          
          <!-- Craft preview -->
          <template v-else-if="isCraft">
            <CraftPreview
              v-if="craftMarkdown || loadingCraftBody"
              :markdown="craftMarkdown"
              :loading="loadingCraftBody"
              :detail-mode="true"
              class="detail-craft-preview"
            />
            <div v-else class="empty-preview">
              <i class="pi pi-file-edit" />
              <span>No document content available</span>
            </div>
          </template>
          
          <!-- File preview -->
          <template v-else-if="isFile">
            <FilePreview
              v-if="isDisplayableFile"
              :storage-path="(item as DataItem).storage_path || ''"
              :filename="(item as DataItem).name || 'file'"
              ref="filePreviewRef"
              class="detail-file-preview"
            />
            <!-- Non-displayable file with large thumbnail or placeholder -->
            <div v-else class="file-placeholder-container">
              <img
                v-if="hasThumbnail"
          :src="thumbnailUrl"
          :alt="(item as DataItem).name"
                class="large-thumbnail"
          @error="thumbnailFailed = true"
        />
              <FilePlaceholder
                v-else
                :filename="(item as DataItem).name || 'Unknown'"
                class="large-placeholder"
              />
              <button class="download-button" @click="downloadCurrentFile">
                <i class="pi pi-download" />
                Download File
              </button>
            </div>
          </template>
      </div>

        <!-- Sidebar with metadata -->
        <aside class="detail-sidebar scrollable-list">
          <!-- Source email for files -->
          <div v-if="isFile && sourceEmail" class="sidebar-section">
            <div class="section-label">Source Email</div>
            <div class="source-email-card">
              <div class="email-subject">{{ sourceEmail.subject || 'No subject' }}</div>
              <div class="email-from">from {{ sourceEmail.from_name || sourceEmail.from_email || 'Unknown' }}</div>
          <a
            v-if="sourceEmail.missive_url"
            :href="sourceEmail.missive_url"
            target="_blank"
                class="email-link"
          >
                <i class="pi pi-external-link" />
            Open in Missive
          </a>
        </div>
      </div>

          <!-- Attachments for emails -->
          <div v-if="isEmail && emailAttachmentFiles.length > 0" class="sidebar-section">
            <div class="section-label">Attachments ({{ emailAttachmentFiles.length }})</div>
            <div class="attachments-list">
              <div
                v-for="file in emailAttachmentFiles"
                :key="file.file_id"
                class="attachment-item"
                @click="downloadAttachment(file)"
              >
                <img
                  v-if="file.thumbnail_path && !failedFileThumbnails.has(file.file_id)"
                  :src="getFileThumbnailUrl(file.thumbnail_path)"
                  :alt="file.filename"
                  class="attachment-thumb"
                  @error="failedFileThumbnails.add(file.file_id)"
                />
                <i v-else class="pi pi-file attachment-icon" />
                <span class="attachment-name">{{ file.filename }}</span>
                <i class="pi pi-download attachment-download" />
              </div>
            </div>
          </div>

      <!-- Toggle for empty fields -->
          <div class="sidebar-section toggle-section">
        <div class="checkbox-wrapper">
          <Checkbox
            v-model="showEmptyFields"
            input-id="show-empty"
            :binary="true"
          />
          <label for="show-empty">Show empty fields</label>
        </div>
      </div>
          
          <!-- Field list -->
          <div class="sidebar-section fields-section">
            <div
              v-for="[key, value] in displayFields"
              :key="key"
              class="field-row"
            >
              <div class="field-label">{{ formatFieldName(key) }}</div>
              <div class="field-value">
                <template v-if="Array.isArray(value)">
                  <div v-if="value.length > 0" class="array-values">
                    <span v-for="(arrayItem, idx) in value" :key="idx" class="array-item">
                      {{ formatValue(arrayItem) }}
                    </span>
                  </div>
                  <span v-else class="empty-value">—</span>
                </template>
                <template v-else-if="typeof value === 'object' && value !== null">
                  <pre class="object-value">{{ JSON.stringify(value, null, 2) }}</pre>
                </template>
                <template v-else>
                  {{ formatValue(value) }}
                </template>
              </div>
            </div>
          </div>
          
          <!-- Raw data accordion -->
          <Accordion v-if="item._raw" class="raw-data-accordion">
            <AccordionTab header="Raw Data">
              <pre class="raw-data">{{ JSON.stringify(item._raw, null, 2) }}</pre>
            </AccordionTab>
          </Accordion>
        </aside>
      </template>
      
      <!-- Standard layout for Tasks (unchanged) -->
      <template v-else>
        <div class="standard-content scrollable-list">
          <!-- Thumbnail preview for tasks with images -->
          <div v-if="hasThumbnail" class="thumbnail-preview">
            <img
              :src="thumbnailUrl"
              :alt="(item as DataItem).name"
              class="thumbnail-preview-img"
              @error="thumbnailFailed = true"
            />
          </div>

          <!-- Toggle for empty fields -->
          <div class="detail-header">
            <div class="checkbox-wrapper">
              <Checkbox
                v-model="showEmptyFields"
                input-id="show-empty-std"
                :binary="true"
              />
              <label for="show-empty-std">Show empty fields</label>
        </div>
      </div>

      <!-- Display all fields -->
      <div class="detail-fields">
        <div
          v-for="[key, value] in displayFields"
          :key="key"
          class="field-row"
        >
          <div class="field-label">{{ formatFieldName(key) }}</div>
          <div class="field-value">
            <template v-if="Array.isArray(value)">
              <div v-if="value.length > 0">
                <div v-for="(arrayItem, idx) in value" :key="idx" class="array-item">
                  {{ formatValue(arrayItem) }}
                </div>
              </div>
              <span v-else class="empty-value">—</span>
            </template>
            <template v-else-if="typeof value === 'object' && value !== null">
              <pre>{{ JSON.stringify(value, null, 2) }}</pre>
            </template>
            <template v-else>
              {{ formatValue(value) }}
            </template>
          </div>
        </div>
      </div>

      <!-- Raw data (collapsible) -->
      <Accordion v-if="item._raw" class="raw-data-accordion">
        <AccordionTab header="Raw Data">
          <pre class="raw-data">{{ JSON.stringify(item._raw, null, 2) }}</pre>
        </AccordionTab>
      </Accordion>
        </div>
      </template>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import { TypeLinkButton, EmailPreview, CraftPreview, FilePlaceholder, FilePreview } from '@/components/common'
import { supabase } from '@/lib/supabase'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import type { ViewDataItem, DataItem, ProjectItem, PersonItem } from '@/types'

interface SourceEmailInfo {
  message_id: string
  subject: string | null
  from_name: string | null
  from_email: string | null
  delivered_at: string | null
  missive_url: string | null
}

interface EmailFileInfo {
  file_id: string
  filename: string
  storage_path: string
  thumbnail_path: string | null
}

interface Props {
  visible: boolean
  item: ViewDataItem | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showEmptyFields = ref(false)
const thumbnailFailed = ref(false)
const sourceEmail = ref<SourceEmailInfo | null>(null)
const emailAttachmentFiles = ref<EmailFileInfo[]>([])
const failedFileThumbnails = reactive(new Set<string>())

// Email/Craft body state
const emailHtmlBody = ref<string | null>(null)
const loadingEmailBody = ref(false)
const craftMarkdown = ref<string | null>(null)
const loadingCraftBody = ref(false)

const previewMainRef = ref<HTMLElement | null>(null)
const filePreviewRef = ref<InstanceType<typeof FilePreview> | null>(null)

const { filesBucket } = useAppearanceSettings()

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Detect item types
const isFile = computed(() => (props.item as DataItem)?.type?.toLowerCase() === 'file')
const isEmail = computed(() => (props.item as DataItem)?.type?.toLowerCase() === 'email')
const isCraft = computed(() => (props.item as DataItem)?.type?.toLowerCase() === 'craft')
const isTask = computed(() => (props.item as DataItem)?.type?.toLowerCase() === 'task')

// Check if file is displayable inline
const fileExtension = computed(() => {
  if (!isFile.value || !props.item) return ''
  const name = (props.item as DataItem).name || ''
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() || '' : ''
})

const isDisplayableFile = computed(() => 
  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(fileExtension.value)
)

// Preview layout for email, craft, and files
const hasPreviewLayout = computed(() => isEmail.value || isCraft.value || isFile.value)

const layoutClass = computed(() => {
  if (hasPreviewLayout.value) return 'preview-layout'
  return 'standard-layout'
})

// Dialog size - larger for preview layouts
const dialogStyle = computed(() => {
  if (hasPreviewLayout.value) {
    return { width: '95vw', maxWidth: '1600px', height: '90vh' }
  }
  return { width: '90vw', maxWidth: '1200px' }
})

// Thumbnail support
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const hasThumbnail = computed(() => {
  if (!props.item || thumbnailFailed.value) return false
  return !!(props.item as DataItem).thumbnail_path
})
const thumbnailUrl = computed(() => {
  if (!props.item) return ''
  const path = (props.item as DataItem).thumbnail_path
  return path ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${path}` : ''
})

const getFileThumbnailUrl = (thumbnailPath: string): string => {
  return `${supabaseUrl}/storage/v1/object/public/thumbnails/${thumbnailPath}`
}

// Fetch source email for a file
const fetchSourceEmail = async (fileId: string) => {
  const { data, error } = await supabase.rpc('get_file_source_email', { p_file_id: fileId })
  if (!error && data && data.length > 0) {
    sourceEmail.value = data[0]
  } else {
    sourceEmail.value = null
  }
}

// Fetch files for an email
const fetchEmailFiles = async (messageId: string) => {
  const { data, error } = await supabase.rpc('get_email_files', { p_message_id: messageId })
  if (!error && data) {
    emailAttachmentFiles.value = data
  } else {
    emailAttachmentFiles.value = []
  }
}

// Fetch email HTML body
const fetchEmailBody = async (messageId: string) => {
  loadingEmailBody.value = true
  const { data, error } = await supabase.rpc('get_email_html_bodies', { p_message_ids: [messageId] })
  loadingEmailBody.value = false
  
  if (!error && data && data.length > 0) {
    emailHtmlBody.value = data[0].html_body
  } else {
    emailHtmlBody.value = null
  }
}

// Fetch craft markdown
const fetchCraftBody = async (documentId: string) => {
  loadingCraftBody.value = true
  const { data, error } = await supabase.rpc('get_craft_markdowns', { p_document_ids: [documentId] })
  loadingCraftBody.value = false
  
  if (!error && data && data.length > 0) {
    craftMarkdown.value = data[0].markdown
  } else {
    craftMarkdown.value = null
  }
}

// Download file via signed URL
const downloadAttachment = async (file: EmailFileInfo) => {
  if (!file.storage_path) return
  
  const { data, error } = await supabase.storage
    .from(filesBucket.value)
    .createSignedUrl(file.storage_path, 300)
  
  if (!error && data?.signedUrl) {
    window.open(data.signedUrl, '_blank')
  }
}

// Download current file (for non-displayable files)
const downloadCurrentFile = async () => {
  if (!isFile.value || !props.item) return
  const storagePath = (props.item as DataItem).storage_path
  if (!storagePath) return
  
  const { data, error } = await supabase.storage
    .from(filesBucket.value)
    .createSignedUrl(storagePath, 300)
  
  if (!error && data?.signedUrl) {
    window.open(data.signedUrl, '_blank')
  }
}

// Handle keyboard events for PDF navigation
const handleDialogKeydown = (e: KeyboardEvent) => {
  // Let FilePreview handle arrow keys for PDF
  if (isFile.value && isDisplayableFile.value && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    const previewEl = previewMainRef.value?.querySelector('.detail-file-preview') as HTMLElement
    if (previewEl && document.activeElement !== previewEl) {
      previewEl.focus()
    }
  }
}

// Detect item type based on properties
const detectedItemType = computed<'item' | 'project' | 'person'>(() => {
  if (!props.item) return 'item'
  
  if ('display_name' in props.item && 'primary_email' in props.item) {
    return 'person'
  }
  
  if ('company_name' in props.item || 'task_count' in props.item || 'contractor_count' in props.item) {
    return 'project'
  }
  
  return 'item'
})

// Dialog title based on item type
const dialogTitle = computed(() => {
  if (!props.item) return 'Details'
  
  switch (detectedItemType.value) {
    case 'person':
      return (props.item as PersonItem).display_name || 'Person Details'
    case 'project':
      return (props.item as ProjectItem).name || 'Project Details'
    default:
      return (props.item as DataItem).name || 'Item Details'
  }
})

// Fields to exclude from display
const excludedFields = ['_raw', 'id', 'teamwork_url', 'missive_url', 'craft_url', 'thumbnail_path', 'storage_path', 'html_body', 'markdown']

const displayFields = computed(() => {
  if (!props.item) return []

  const fields = Object.entries(props.item)
    .filter(([key]) => !excludedFields.includes(key))
    .filter(([_, value]) => {
      if (showEmptyFields.value) return true
      if (value === null || value === undefined || value === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    })
    .sort(([keyA], [keyB]) => {
      const order = ['type', 'name', 'description', 'status', 'project', 'customer']
      const indexA = order.indexOf(keyA)
      const indexB = order.indexOf(keyB)
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      
      return keyA.localeCompare(keyB)
    })

  return fields
})

const formatFieldName = (key: string): string => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '—'
  if (value === '') return '—'
  
  // Format dates
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
  
  // Format objects
  if (typeof value === 'object') {
    if (value.name) return value.name
    if (value.first_name && value.last_name) return `${value.first_name} ${value.last_name}`
    if (value.email) return value.email
    return JSON.stringify(value)
  }
  
  return String(value)
}

// Reset state and fetch related data when dialog opens
watch(isVisible, async (visible) => {
  if (visible) {
    showEmptyFields.value = false
    thumbnailFailed.value = false
    sourceEmail.value = null
    emailAttachmentFiles.value = []
    emailHtmlBody.value = null
    craftMarkdown.value = null
    failedFileThumbnails.clear()
    
    if (props.item) {
      const item = props.item as DataItem
      
      // Fetch data based on item type
      if (isFile.value && item.id) {
        fetchSourceEmail(item.id)
      }
      
      if (isEmail.value && item.id) {
        await Promise.all([
          fetchEmailFiles(item.id),
          fetchEmailBody(item.id)
        ])
      }
      
      if (isCraft.value && item.id) {
        fetchCraftBody(item.id)
      }
      
      // Focus preview after mount
      await nextTick()
      if (isFile.value && isDisplayableFile.value) {
        const previewEl = previewMainRef.value?.querySelector('.detail-file-preview') as HTMLElement
        previewEl?.focus()
      }
    }
  }
})
</script>

<style scoped>
/* Layout containers */
.detail-layout {
  display: flex;
  height: 100%;
  max-height: calc(90vh - 4.5rem); /* dialog height minus header */
  overflow: hidden;
  width: 100%;
  min-width: 0;
}

.detail-layout.preview-layout {
  flex-direction: row;
}

.detail-layout.standard-layout {
  flex-direction: column;
}

/* Preview layout - main area with preview */
.preview-main {
  flex: 1;
  min-width: 0;
  min-height: 0; /* Important: allow flex item to shrink */
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: transparent;
}

.detail-email-preview,
.detail-craft-preview,
.detail-file-preview {
  width: 100%;
  height: 100%;
}

.empty-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-muted);
  width: 100%;
  height: 100%;
}

.empty-preview .pi {
  font-size: 4rem;
  opacity: 0.5;
}

/* File placeholder for non-displayable files */
.file-placeholder-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  width: 100%;
  height: 100%;
}

.large-thumbnail {
  max-width: 80%;
  max-height: 60%;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.large-placeholder {
  transform: scale(1.5);
}

.download-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: var(--accent-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.download-button:hover {
  background: #3b8ae8;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(74, 158, 255, 0.4);
}

/* Sidebar */
.detail-sidebar {
  width: 380px;
  flex-shrink: 0;
  min-height: 0; /* Important: allow flex item to shrink independently */
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-primary);
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

/* Source email card */
.source-email-card {
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.email-subject {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-from {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.email-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--accent-primary);
  text-decoration: none;
  transition: color var(--transition-normal);
}

.email-link:hover {
  color: #6db3ff;
}

/* Attachments list */
.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.attachment-item:hover {
  border-color: var(--accent-primary);
  background: var(--bg-hover);
}

.attachment-item:hover .attachment-download {
  opacity: 1;
}

.attachment-thumb {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.attachment-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.attachment-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-download {
  font-size: 0.9rem;
  color: var(--accent-primary);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

/* Toggle section */
.toggle-section {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-primary);
}

.checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.checkbox-wrapper label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
}

/* Fields section */
.fields-section {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-primary);
}

.field-row:last-child {
  border-bottom: none;
}

.field-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.field-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  word-break: break-word;
}

.empty-value {
  color: var(--text-muted);
  font-style: italic;
}

.array-values {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.array-values .array-item {
  padding: 0.2rem 0.5rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}

.object-value {
  font-size: 0.75rem;
  background: var(--bg-tertiary);
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

/* Raw data accordion */
.raw-data-accordion {
  margin-top: auto;
  border-top: 1px solid var(--border-primary);
  padding-top: 1rem;
}

.raw-data-accordion :deep(.p-accordion-header-link) {
  padding: 0.75rem !important;
  border-radius: var(--radius-md) !important;
  font-size: 0.85rem;
}

.raw-data-accordion :deep(.p-accordion-content) {
  padding: 0.75rem !important;
  background: transparent !important;
}

.raw-data {
  background: var(--bg-tertiary);
  padding: 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.7rem;
  overflow-x: auto;
  max-height: 300px;
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
}

/* Standard layout (tasks) */
.standard-content {
  padding: 2rem;
  max-height: 70vh;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  min-width: 0;
}

.thumbnail-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.thumbnail-preview-img {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.detail-header {
  margin-bottom: 1.5rem;
}

.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  width: 100%;
}

.standard-content .field-row {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 1.5rem;
  padding: 1rem 0;
}

.standard-content .field-label {
  font-weight: 500;
  font-size: 0.875rem;
}

.standard-content .field-value {
  font-size: 0.95rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.standard-content .field-value pre {
  background: var(--bg-tertiary);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  overflow-x: auto;
}

.standard-content .array-item {
  padding: 0.5rem 0;
}

.standard-content .array-item:not(:last-child) {
  border-bottom: 1px solid var(--border-primary);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

/* Dialog header */
.dialog-header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
  overflow: hidden;
  flex: 1;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}
</style>
