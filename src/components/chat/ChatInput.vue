<template>
  <div
    class="chat-input-area"
    @dragover.prevent="dragActive = true"
    @dragleave.self="dragActive = false"
    @drop.prevent="handleDrop"
  >
    <div v-if="attachedFiles.length" class="file-chips">
      <div v-for="(f, i) in attachedFiles" :key="i" class="file-chip">
        <i class="pi pi-file"></i>
        <span class="file-chip-name">{{ f.name }}</span>
        <span class="file-chip-size">{{ formatSize(f.size) }}</span>
        <button class="file-chip-remove" @click="removeFile(i)">
          <i class="pi pi-times"></i>
        </button>
      </div>
    </div>
    <div class="chat-input-wrapper" :class="{ 'drag-active': dragActive }">
      <textarea
        ref="inputEl"
        :value="modelValue"
        class="chat-input"
        placeholder="Message..."
        rows="1"
        @input="handleInput"
        @keydown.enter.exact="handleSend"
        @paste="handlePaste"
      ></textarea>
      <div class="input-bottom-row">
        <div class="model-picker-wrap">
          <button
            v-if="models.length > 1"
            class="model-picker"
            @click="showMenu = !showMenu"
          >
            {{ selectedModel?.name || 'Model' }}
            <i class="pi pi-chevron-down"></i>
          </button>
          <span v-else-if="selectedModel" class="model-label">{{ selectedModel.name }}</span>
          <div v-if="showMenu" class="model-menu">
            <button
              v-for="m in models"
              :key="m.id"
              class="model-menu-item"
              :class="{ active: m.id === selectedModelId }"
              @click="$emit('update:selectedModelId', m.id); showMenu = false"
            >
              <span class="model-menu-name">{{ m.name }}</span>
              <span class="model-menu-price">${{ m.input_price }} / ${{ m.output_price }}</span>
            </button>
          </div>
        </div>
        <button class="attach-btn" @click="openFilePicker" title="Attach files">
          <i class="pi pi-paperclip"></i>
        </button>
        <div class="input-bottom-spacer"></div>
        <button
          v-if="sending"
          class="send-btn stop-btn"
          @click="$emit('stop')"
          title="Stop"
        >
          <i class="pi pi-stop-circle"></i>
        </button>
        <button
          v-else
          class="send-btn"
          :disabled="!modelValue.trim() && !attachedFiles.length"
          @click="handleSend"
        >
          <i class="pi pi-send"></i>
        </button>
      </div>
    </div>
    <input
      ref="fileInputEl"
      type="file"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { ChatModel } from '@/composables/useChat'

defineProps<{
  modelValue: string
  models: ChatModel[]
  selectedModelId: string | null
  selectedModel: ChatModel | null
  sending: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'send': [files: File[]]
  'stop': []
  'update:selectedModelId': [id: string]
}>()

const inputEl = ref<HTMLTextAreaElement>()
const fileInputEl = ref<HTMLInputElement>()
const showMenu = ref(false)
const dragActive = ref(false)
const attachedFiles = ref<File[]>([])

function handleInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  emit('update:modelValue', el.value)
  autoResize()
}

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 280) + 'px'
}

function handleSend(e?: Event) {
  if (e && e instanceof KeyboardEvent && e.shiftKey) return
  e?.preventDefault()
  emit('send', [...attachedFiles.value])
  attachedFiles.value = []
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (files.length) {
    e.preventDefault()
    attachedFiles.value.push(...files)
  }
}

function handleDrop(e: DragEvent) {
  dragActive.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    attachedFiles.value.push(...Array.from(files))
  }
}

function openFilePicker() {
  fileInputEl.value?.click()
}

function handleFileSelect(e: Event) {
  const el = e.target as HTMLInputElement
  if (el.files?.length) {
    attachedFiles.value.push(...Array.from(el.files))
  }
  el.value = ''
}

function removeFile(index: number) {
  attachedFiles.value.splice(index, 1)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function resetHeight() {
  if (inputEl.value) inputEl.value.style.height = 'auto'
}

function handleClickOutside(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (showMenu.value && !t.closest('.model-picker-wrap')) showMenu.value = false
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

defineExpose({ focus: () => inputEl.value?.focus(), resetHeight })
</script>

<style scoped>
.chat-input-area {
  padding: 0.4rem 2rem 0.75rem;
  border-top: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  max-width: 800px;
  margin: 0 auto 0.4rem;
  padding: 0 0.2rem;
}

.file-chip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.file-chip i.pi-file { font-size: 0.8rem; color: var(--text-muted); }
.file-chip-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-chip-size { color: var(--text-muted); font-size: 0.75rem; }
.file-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 50%;
  font-size: 0.65rem;
  transition: all 0.1s;
}
.file-chip-remove:hover { background: var(--error-bg); color: var(--error-text); }

.chat-input-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin: 0 auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 1.1rem;
  padding: 0.6rem 0.7rem 0.4rem 0.85rem;
  transition: border-color 0.15s ease;
  gap: 0.3rem;
}
.chat-input-wrapper:focus-within { border-color: var(--accent-primary); }
.chat-input-wrapper.drag-active { border-color: var(--accent-primary); background: var(--bg-tertiary); }

.chat-input {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1.1rem;
  font-family: inherit;
  line-height: 1.5;
  resize: none;
  outline: none;
  max-height: 280px;
  overflow-y: auto;
  padding: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border-primary) transparent;
}
.chat-input::-webkit-scrollbar { width: 4px; }
.chat-input::-webkit-scrollbar-track { background: transparent; }
.chat-input::-webkit-scrollbar-thumb { background: var(--border-primary); border-radius: 2px; }
.chat-input::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
.chat-input::placeholder { color: var(--text-muted); }

.input-bottom-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.input-bottom-spacer { flex: 1; }

.attach-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 50%;
  font-size: 1rem;
  transition: all 0.15s;
}
.attach-btn:hover { color: var(--text-secondary); background: var(--bg-tertiary); }

.model-picker-wrap { position: relative; }

.model-picker {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.55rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  white-space: nowrap;
}
.model-picker:hover { color: var(--text-secondary); background: var(--bg-tertiary); }
.model-picker i { font-size: 0.65rem; opacity: 0.6; }

.model-label {
  font-size: 1rem;
  color: var(--text-muted);
}

.model-menu {
  position: absolute;
  bottom: calc(100% + 0.4rem);
  left: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.3rem;
  min-width: 220px;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  animation: slideUp 0.15s ease-out;
}

.model-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.1s;
  gap: 1.2rem;
}
.model-menu-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.model-menu-item.active { color: var(--accent-primary); }

.model-menu-name { white-space: nowrap; }
.model-menu-price {
  font-size: 0.85rem;
  color: var(--text-muted);
  white-space: nowrap;
  font-family: 'Fira Code', 'Consolas', monospace;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--accent-primary);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  font-size: 0.9rem;
}
.send-btn:hover:not(:disabled) { opacity: 0.85; }
.send-btn:disabled { opacity: 0.3; cursor: default; }

.stop-btn {
  background: var(--error-bg);
  color: var(--error-text);
}
.stop-btn:hover { background: #662020; }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
