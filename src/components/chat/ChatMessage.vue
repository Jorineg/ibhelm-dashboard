<template>
  <div class="message" :class="msg.role">
    <div class="message-col">
      <div v-if="msg.role === 'user' && editing" class="message-bubble user-bubble editing">
        <textarea
          :value="editText"
          class="edit-textarea"
          @input="$emit('update:editText', ($event.target as HTMLTextAreaElement).value)"
          @keydown.enter.exact="$emit('confirm-edit')"
          @keydown.escape="$emit('cancel-edit')"
        ></textarea>
        <div class="edit-actions">
          <button class="edit-btn edit-save" @click="$emit('confirm-edit')">Save &amp; Resend</button>
          <button class="edit-btn edit-cancel" @click="$emit('cancel-edit')">Cancel</button>
        </div>
      </div>

      <div v-else-if="msg.role === 'user'" class="message-bubble user-bubble">
        {{ msg.content }}
        <div v-if="msg.files?.length" class="message-files">
          <div v-for="f in msg.files" :key="f.id" class="message-file-chip">
            <i class="pi pi-file"></i>
            <span>{{ f.filename }}</span>
            <span class="file-size">{{ formatFileSize(f.size_bytes) }}</span>
          </div>
        </div>
      </div>

      <div v-else class="assistant-content">
        <template v-if="groups.length">
          <template v-for="(group, gi) in groups" :key="gi">
            <div v-if="group.type === 'text' && group.text" class="markdown-content" v-html="renderMarkdown(group.text)"></div>

            <div v-else-if="group.type === 'work_group'" class="tool-group">
              <!-- Multi-item group or streaming -->
              <template v-if="isStreaming || group.items!.length > 1">
                <div class="tool-section" :class="{ 'is-open': isOpen(`g-${gi}`) }">
                  <button class="section-trigger" @click="toggle(`g-${gi}`)">
                    <i class="pi pi-code tool-icon"></i>
                    <span>{{ workGroupSummary(group.items!, isStreaming && gi === groups.length - 1) }}</span>
                    <i v-if="isStreaming && gi === groups.length - 1" class="pi pi-spin pi-spinner tool-spinner"></i>
                    <i class="pi pi-chevron-right tool-chevron"></i>
                  </button>
                  <div class="section-body">
                    <div class="section-body-inner">
                      <div class="group-items">
                        <template v-for="(item, ii) in group.items" :key="item.id || ii">
                          <div v-if="item.type === 'tool_call'" class="tool-section nested" :class="{ 'is-open': isOpen(`c-${item.id}`) }">
                            <button class="section-trigger" @click="toggle(`c-${item.id}`)">
                              <i class="pi pi-code tool-icon"></i>
                              <span>Python</span>
                              <span v-if="item.error" class="tool-error-badge">error</span>
                              <i v-if="item.id === currentToolId" class="pi pi-spin pi-spinner tool-spinner"></i>
                              <i class="pi pi-chevron-right tool-chevron"></i>
                            </button>
                            <div class="section-body">
                              <div class="section-body-inner">
                                <ToolCallContent :code="item.code" :result="item.result" :error="item.error" />
                              </div>
                            </div>
                          </div>
                          <div v-else-if="item.type === 'thinking'" class="tool-section nested thinking" :class="{ 'is-open': isOpen(`t-${gi}-${ii}`) }">
                            <button class="section-trigger thinking-trigger" @click="toggle(`t-${gi}-${ii}`)">
                              <i class="pi pi-sparkles tool-icon"></i>
                              <span>Thinking{{ isStreaming ? '...' : '' }}</span>
                              <i class="pi pi-chevron-right tool-chevron"></i>
                            </button>
                            <div class="section-body">
                              <div class="section-body-inner">
                                <div class="thinking-card">
                                  <div class="thinking-text">{{ item.text }}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Single tool call -->
              <template v-else-if="group.items![0].type === 'tool_call'">
                <div class="tool-section" :class="{ 'is-open': isOpen(`c-${group.items![0].id}`) }">
                  <button class="section-trigger" @click="toggle(`c-${group.items![0].id}`)">
                    <i class="pi pi-code tool-icon"></i>
                    <span>Python</span>
                    <span v-if="group.items![0].error" class="tool-error-badge">error</span>
                    <i class="pi pi-chevron-right tool-chevron"></i>
                  </button>
                  <div class="section-body">
                    <div class="section-body-inner">
                      <ToolCallContent :code="group.items![0].code" :result="group.items![0].result" :error="group.items![0].error" />
                    </div>
                  </div>
                </div>
              </template>

              <!-- Single thinking -->
              <template v-else>
                <div class="tool-section thinking" :class="{ 'is-open': isOpen(`t-${gi}`) }">
                  <button class="section-trigger thinking-trigger" @click="toggle(`t-${gi}`)">
                    <i class="pi pi-sparkles tool-icon"></i>
                    <span>Thinking</span>
                    <i class="pi pi-chevron-right tool-chevron"></i>
                  </button>
                  <div class="section-body">
                    <div class="section-body-inner">
                      <div class="thinking-card">
                        <div class="thinking-text">{{ group.items![0].text }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </template>
        <div v-else-if="msg.content" class="markdown-content" v-html="renderMarkdown(msg.content)"></div>

        <span v-if="showTypingIndicator" class="typing-indicator">
          <span></span><span></span><span></span>
        </span>

        <div v-if="msg.files?.length" class="generated-files">
          <a
            v-for="f in msg.files"
            :key="f.id"
            class="generated-file"
            :href="fileUrl(f)"
            target="_blank"
            rel="noopener"
          >
            <i class="pi pi-download"></i>
            <span>{{ f.filename }}</span>
            <span class="file-size">{{ formatFileSize(f.size_bytes) }}</span>
          </a>
        </div>

        <div v-if="msg.status === 'error'" class="generation-error">
          <i class="pi pi-exclamation-triangle"></i> {{ msg.metadata?.error || 'Generation failed' }}
        </div>
      </div>

      <div v-if="!editing && !isStreaming && msg.id" class="msg-actions">
        <span class="msg-actions-time">{{ formatTime(msg.created_at) }}</span>
        <span v-if="msg.role === 'assistant' && modelName" class="msg-model-name">{{ modelName }}</span>
        <div v-if="msg.role === 'assistant' && hasStats" class="msg-stats-wrap">
          <button class="msg-action-btn" title="Usage stats" @click.stop="showStats = !showStats"><i class="pi pi-info-circle"></i></button>
          <div v-if="showStats" class="msg-stats-popover">
            <div class="usage-row"><span>Input</span><span>{{ formatTokens(totalInputTokens) }}</span></div>
            <div class="usage-row"><span>Output</span><span>{{ formatTokens(outputTokens) }}</span></div>
            <div v-if="cacheReadTokens" class="usage-row"><span>Cache read</span><span>{{ formatTokens(cacheReadTokens) }}</span></div>
            <div v-if="cacheWriteTokens" class="usage-row"><span>Cache write</span><span>{{ formatTokens(cacheWriteTokens) }}</span></div>
            <div v-if="toolCost > 0" class="usage-row"><span>Tool cost</span><span>{{ formatUsd(toolCost) }}</span></div>
            <div class="usage-row usage-row-total"><span>Total cost</span><span>{{ formatUsd(totalCost) }}</span></div>
          </div>
        </div>
        <button class="msg-action-btn" title="Copy" @click="$emit('copy')"><i class="pi pi-copy"></i></button>
        <button v-if="msg.role === 'user'" class="msg-action-btn" title="Edit" @click="$emit('start-edit')"><i class="pi pi-pencil"></i></button>
        <button class="msg-action-btn" title="Retry" @click="$emit('retry')"><i class="pi pi-refresh"></i></button>
        <div class="retry-model-wrap">
          <button class="msg-action-btn" title="Retry with different model" @click.stop="$emit('toggle-retry-menu')">
            <i class="pi pi-chevron-down" style="font-size: 0.65rem;"></i>
          </button>
          <div v-if="showRetryMenu" class="retry-model-menu">
            <button
              v-for="m in availableModels" :key="m.id"
              class="retry-model-item" :class="{ active: m.id === msg.metadata?.model }"
              @click="$emit('retry-with-model', m.id)"
            >{{ m.name }}</button>
          </div>
        </div>
        <button class="msg-action-btn msg-action-delete" title="Delete from here" @click="$emit('delete')"><i class="pi pi-trash"></i></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  calcMessageLlmCost,
  calcMessageTotalCost,
  getMessageToolCost,
  getTotalInputTokens,
  type ContentBlock,
  type ChatMessage,
  type ChatModel,
  type ChatFile,
} from '@/composables/useChat'
import { renderMarkdown } from '@/composables/useMarkdown'
import ToolCallContent from './ToolCallContent.vue'

interface MessageProp {
  id?: string
  role: 'user' | 'assistant'
  content?: string | null
  blocks?: ContentBlock[] | null
  status?: ChatMessage['status']
  metadata?: ChatMessage['metadata']
  created_at?: string
  files?: ChatFile[]
}

interface GroupedBlock {
  type: 'text' | 'work_group'
  text?: string
  items?: ContentBlock[]
}

const props = defineProps<{
  msg: MessageProp
  editing?: boolean
  editText?: string
  isStreaming?: boolean
  currentToolId?: string | null
  availableModels?: ChatModel[]
  showRetryMenu?: boolean
}>()

defineEmits<{
  'copy': []
  'start-edit': []
  'cancel-edit': []
  'confirm-edit': []
  'update:editText': [value: string]
  'retry': []
  'toggle-retry-menu': []
  'retry-with-model': [modelId: string]
  'delete': []
}>()

const openSections = ref(new Set<string>())
const showStats = ref(false)

function toggle(key: string) {
  const s = new Set(openSections.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  openSections.value = s
}

function isOpen(key: string): boolean {
  return openSections.value.has(key)
}

function groupBlocks(blocks: ContentBlock[]): GroupedBlock[] {
  const groups: GroupedBlock[] = []
  for (const b of blocks) {
    if (b.type === 'text') {
      groups.push({ type: 'text', text: b.text })
    } else {
      const last = groups[groups.length - 1]
      if (last?.type === 'work_group') {
        last.items!.push(b)
      } else {
        groups.push({ type: 'work_group', items: [b] })
      }
    }
  }
  return groups
}

function workGroupSummary(items: ContentBlock[], running = false): string {
  const toolCount = items.filter(b => b.type === 'tool_call').length
  if (toolCount) {
    const verb = running ? 'Running' : 'Ran'
    return `${verb} ${toolCount} ${toolCount === 1 ? 'query' : 'queries'}`
  }
  const thinkCount = items.filter(b => b.type === 'thinking').length
  return `Thinking (${thinkCount} ${thinkCount === 1 ? 'step' : 'steps'})`
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

const groups = computed(() => {
  const blocks = props.msg.blocks
  if (!blocks?.length) return []
  return groupBlocks(blocks)
})

const showTypingIndicator = computed(() => {
  if (props.isStreaming) return !groups.value.length
  return props.msg.status === 'generating'
})

const modelName = computed(() => {
  const modelId = props.msg.metadata?.model
  if (!modelId) return null
  return props.availableModels?.find(m => m.id === modelId)?.name
    ?? modelId.split('/').pop()?.replace(/-/g, ' ')
    ?? modelId
})

const totalInputTokens = computed(() => getTotalInputTokens(props.msg.metadata))
const outputTokens = computed(() => props.msg.metadata?.output_tokens || 0)
const cacheReadTokens = computed(() => props.msg.metadata?.cache_read_input_tokens || 0)
const cacheWriteTokens = computed(() => props.msg.metadata?.cache_creation_input_tokens || 0)
const llmCost = computed(() => calcMessageLlmCost(props.msg.metadata, props.availableModels || []))
const toolCost = computed(() => getMessageToolCost(props.msg.metadata))
const totalCost = computed(() => calcMessageTotalCost(props.msg.metadata, props.availableModels || []))
const hasStats = computed(() =>
  totalInputTokens.value > 0 || outputTokens.value > 0 || toolCost.value > 0 || llmCost.value > 0
)

import { supabaseUrl } from '@/lib/supabase'

function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileUrl(f: ChatFile): string {
  if (f.bucket === 'chat-files') {
    return `${supabaseUrl}/storage/v1/object/public/chat-files/${f.content_hash}`
  }
  return '#'
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function formatUsd(value: number): string {
  if (value < 0.005) return '<$0.01'
  return '$' + value.toFixed(2)
}

function handleClickOutside(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (showStats.value && !t.closest('.msg-stats-wrap')) showStats.value = false
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
/* ── Layout ── */
.message { display: flex; width: 100%; max-width: 800px; }
.message.user { justify-content: flex-end; }
.message.assistant { justify-content: flex-start; }

.message-col { display: flex; flex-direction: column; min-width: 0; }
.message.user .message-col { max-width: min(85%, 700px); align-items: flex-end; }
.message.assistant .message-col { max-width: 100%; align-items: flex-start; overflow: hidden; }

/* ── User bubble ── */
.message-bubble {
  padding: 0.85rem 1.15rem;
  border-radius: var(--radius-lg);
  font-size: 1.15rem;
  line-height: 1.7;
  word-wrap: break-word;
  min-width: 0;
}
.user-bubble {
  background: var(--accent-primary-dark);
  color: var(--text-primary);
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}

.message-files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.message-file-chip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}
.message-file-chip .file-size { opacity: 0.6; font-size: 0.7rem; }

.generated-files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.generated-file {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.6rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--accent-primary);
  text-decoration: none;
  transition: all 0.15s;
}
.generated-file:hover { background: var(--bg-secondary); border-color: var(--accent-primary); }
.generated-file .file-size { color: var(--text-muted); font-size: 0.75rem; }

/* ── Assistant (no bubble) ── */
.assistant-content {
  font-size: 1.15rem;
  line-height: 1.75;
  color: var(--text-primary);
  overflow-wrap: break-word;
  word-break: break-word;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  padding: 0.25rem 0;
}

/* ── Animated collapsible sections ── */
.tool-group { margin: 0.75rem 0; }

.section-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  transition: color 0.15s, background-color 0.15s;
  width: 100%;
  text-align: left;
  font-family: inherit;
}
.section-trigger:hover { color: var(--text-secondary); background: var(--bg-secondary); }
.is-open > .section-trigger { color: var(--text-secondary); }

.tool-icon { font-size: 0.85rem; opacity: 0.7; }
.tool-spinner { font-size: 0.8rem; }

.tool-error-badge {
  font-size: 0.75rem; color: var(--error-text); background: var(--error-bg);
  padding: 0.1rem 0.4rem; border-radius: 3px;
}

.tool-chevron {
  margin-left: auto;
  font-size: 0.7rem;
  transition: transform 0.3s ease;
}
.is-open > .section-trigger .tool-chevron { transform: rotate(90deg); }

/* Grid-based smooth expand/collapse */
.section-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease-out;
}
.is-open > .section-body {
  grid-template-rows: 1fr;
}
.section-body-inner {
  overflow: hidden;
}

/* Fade content in when expanding */
.section-body-inner > * {
  opacity: 0;
  transition: opacity 0.2s ease-out 0.08s;
}
.is-open .section-body-inner > * {
  opacity: 1;
}

/* Group items (multiple calls/thinking within one group) */
.group-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem 0 0.25rem 0.5rem;
}

/* Nested sections within groups */
.tool-section.nested > .section-trigger {
  padding: 0.4rem 0.65rem;
  font-size: 0.88rem;
  border-radius: var(--radius-sm);
}

/* Thinking block */
.thinking-trigger { font-style: italic; }
.thinking-trigger .tool-icon { font-size: 0.8rem; }

.thinking-card {
  border-left: 2px solid rgba(255, 255, 255, 0.06);
  padding-left: 0.85rem;
}

.thinking-text {
  font-size: 0.95rem;
  color: var(--text-muted);
  font-style: italic;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
  padding: 0.25rem 0;
}

/* ── Typing indicator ── */
.typing-indicator { display: inline-flex; gap: 4px; padding: 0.25rem 0; }
.typing-indicator span {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--text-muted);
  animation: typing 1.2s infinite ease-in-out;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

.generation-error {
  display: flex; align-items: center; gap: 0.4rem;
  color: var(--error-text); font-size: 0.95rem; padding: 0.4rem 0;
}
.generation-error i { font-size: 0.9rem; }

/* ── Message actions ── */
.msg-actions {
  display: flex; align-items: center; gap: 0.15rem;
  margin-top: 0.25rem; padding: 0 0.25rem;
  opacity: 0; transition: opacity 0.15s; height: 1.6rem;
}
.message:hover .msg-actions { opacity: 1; }

.msg-actions-time { font-size: 0.8rem; color: var(--text-muted); margin-right: 0.35rem; }
.msg-model-name { font-size: 0.8rem; color: var(--text-muted); margin-right: 0.2rem; white-space: nowrap; }

.msg-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 1.7rem; height: 1.7rem; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm);
  transition: all 0.1s; font-size: 0.85rem;
}
.msg-action-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
.msg-action-delete:hover { color: var(--error-text); }

.msg-stats-wrap { position: relative; }
.msg-stats-popover {
  position: absolute;
  bottom: calc(100% + 0.3rem);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.85rem;
  min-width: 210px;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  animation: fadeIn 0.15s ease-out;
}

.retry-model-wrap { position: relative; }
.retry-model-menu {
  position: absolute; bottom: calc(100% + 0.3rem); left: 50%; transform: translateX(-50%);
  background: var(--bg-secondary); border: 1px solid var(--border-primary);
  border-radius: var(--radius-md); padding: 0.25rem; min-width: 180px;
  z-index: 20; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  animation: fadeIn 0.15s ease-out;
}
.retry-model-item {
  display: block; width: 100%; padding: 0.45rem 0.7rem; border: none;
  background: transparent; color: var(--text-secondary); font-size: 0.9rem;
  cursor: pointer; border-radius: var(--radius-sm); text-align: left;
  transition: all 0.1s; white-space: nowrap;
}
.retry-model-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.retry-model-item.active { color: var(--accent-primary); }

.usage-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  padding: 0.2rem 0;
}
.usage-row span:last-child {
  font-family: 'Fira Code', 'Consolas', monospace;
  color: var(--text-primary);
}
.usage-row-total {
  border-top: 1px solid var(--border-primary);
  margin-top: 0.2rem;
  padding-top: 0.35rem;
  font-weight: 600;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ── Editing ── */
.message-bubble.editing { padding: 0.6rem; }
.edit-textarea {
  width: 100%; min-height: 3rem; max-height: 200px;
  border: 1px solid var(--border-primary); border-radius: var(--radius-sm);
  background: var(--bg-primary); color: var(--text-primary);
  font-size: 1.1rem; font-family: inherit; line-height: 1.6;
  padding: 0.5rem 0.7rem; resize: vertical; outline: none;
}
.edit-textarea:focus { border-color: var(--accent-primary); }
.edit-actions { display: flex; gap: 0.4rem; margin-top: 0.4rem; justify-content: flex-end; }
.edit-btn {
  padding: 0.35rem 0.75rem; border: none; border-radius: var(--radius-sm);
  font-size: 0.85rem; cursor: pointer; transition: all 0.1s;
}
.edit-save { background: var(--accent-primary); color: #fff; }
.edit-save:hover { opacity: 0.85; }
.edit-cancel { background: transparent; color: var(--text-secondary); }
.edit-cancel:hover { color: var(--text-primary); background: var(--bg-tertiary); }
</style>
