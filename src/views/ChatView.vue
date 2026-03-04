<template>
  <div class="chat-view">
    <!-- Header -->
    <PageHeader
      title="ibhelm Dashboard"
      :user-email="user?.email"
      :show-sign-out="true"
      @sign-out="handleSignOut"
    >
      <template #after-title>
        <NavigationTabs />
      </template>
      <template #actions>
        <Tooltip v-if="isAdmin" text="Services" position="bottom">
          <button class="icon-btn" @click="router.push('/services')">
            <i class="pi pi-server"></i>
          </button>
        </Tooltip>
        <Tooltip text="Settings" position="bottom">
          <button class="icon-btn" @click="router.push('/settings')">
            <i class="pi pi-cog"></i>
          </button>
        </Tooltip>
      </template>
    </PageHeader>

    <div class="chat-layout">
      <!-- Sidebar: Sessions -->
      <aside class="chat-sidebar">
        <button class="new-chat-btn" @click="handleNewChat">
          <i class="pi pi-plus"></i>
          New Chat
        </button>

        <div class="session-search-wrap">
          <i class="pi pi-search session-search-icon"></i>
          <input
            v-model="sessionSearch"
            class="session-search"
            placeholder="Search chats..."
            type="text"
          />
          <button v-if="sessionSearch" class="session-search-clear" @click="sessionSearch = ''">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <div class="sessions-list thin-scrollbar">
          <div v-if="sessionsLoading" class="sidebar-loading">
            <i class="pi pi-spin pi-spinner"></i>
          </div>
          <template v-else>
            <div v-if="!sessions.length && sessionSearch" class="sidebar-empty">No matches</div>
            <div
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === currentSessionId }"
              @click="selectSession(session.id)"
            >
              <span class="session-title">{{ session.title || 'New Chat' }}</span>
              <button
                class="session-delete"
                @click.stop="handleDelete(session.id)"
                title="Delete"
              >
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </template>
        </div>
      </aside>

      <!-- Main Chat Area -->
      <main class="chat-main">
        <!-- Session token usage indicator -->
        <div v-if="currentSessionId && sessionUsage.input_tokens > 0" class="usage-bar">
          <button class="usage-toggle" @click="showUsage = !showUsage" title="Token usage">
            <i class="pi pi-chart-bar"></i>
            <span class="usage-summary">{{ sessionCost }}</span>
          </button>
          <div v-if="showUsage" class="usage-detail">
            <div class="usage-row"><span>Input</span><span>{{ formatTokens(sessionUsage.input_tokens) }}</span></div>
            <div class="usage-row"><span>Output</span><span>{{ formatTokens(sessionUsage.output_tokens) }}</span></div>
            <div v-if="sessionUsage.cache_read_input_tokens" class="usage-row"><span>Cache read</span><span>{{ formatTokens(sessionUsage.cache_read_input_tokens) }}</span></div>
            <div v-if="sessionUsage.cache_creation_input_tokens" class="usage-row"><span>Cache write</span><span>{{ formatTokens(sessionUsage.cache_creation_input_tokens) }}</span></div>
            <div class="usage-row usage-row-total"><span>Cost</span><span>{{ sessionCost }}</span></div>
          </div>
        </div>

        <!-- Messages area (always visible) -->
          <div ref="messagesContainer" class="messages-container thin-scrollbar">
            <div v-if="messagesLoading" class="messages-loading">
              <i class="pi pi-spin pi-spinner"></i>
            </div>
            <template v-else>
              <!-- Empty state suggestions -->
              <div v-if="!messages.length && !streaming.isStreaming" class="chat-empty session-empty">
                <p>What can I help you with?</p>
                <div class="example-queries">
                  <button class="example-query" @click="handleSendText('Welche Aufgaben sind diese Woche überfällig?')">
                    <i class="pi pi-clock"></i>
                    Überfällige Aufgaben
                  </button>
                  <button class="example-query" @click="handleSendText('Zeige mir die neuesten E-Mails')">
                    <i class="pi pi-envelope"></i>
                    Neueste E-Mails
                  </button>
                  <button class="example-query" @click="handleSendText('Gib mir einen Überblick über die aktiven Projekte')">
                    <i class="pi pi-briefcase"></i>
                    Aktive Projekte
                  </button>
                  <button class="example-query" @click="handleSendText('Erkläre was du alles machen kannst. Was für Arten von Fragen kannst du beantworten?')">
                    <i class="pi pi-question-circle"></i>
                    Was kannst du?
                  </button>
                </div>
              </div>
              <!-- Persisted messages -->
              <div
                v-for="(msg, mi) in displayMessages"
                :key="msg.id"
                class="message"
                :class="msg.role"
              >
                <div class="message-col">
                  <div v-if="msg.role === 'user' && editingMessageId === msg.id" class="message-bubble user-bubble editing">
                    <textarea
                      ref="editInputEl"
                      v-model="editText"
                      class="edit-textarea"
                      @keydown.enter.exact="confirmEdit(msg.id)"
                      @keydown.escape="cancelEdit"
                    ></textarea>
                    <div class="edit-actions">
                      <button class="edit-btn edit-save" @click="confirmEdit(msg.id)">Save & Resend</button>
                      <button class="edit-btn edit-cancel" @click="cancelEdit">Cancel</button>
                    </div>
                  </div>
                  <div v-else-if="msg.role === 'user'" class="message-bubble user-bubble">
                    {{ msg.content }}
                  </div>
                  <div v-else class="message-bubble assistant-bubble">
                    <template v-if="msg.blocks?.length">
                      <template v-for="(group, gi) in groupBlocks(msg.blocks)" :key="gi">
                        <div v-if="group.type === 'text' && group.text" class="markdown-content" v-html="renderMarkdown(group.text)"></div>
                        <div v-else-if="group.type === 'work_group'" class="tool-group">
                          <details v-if="group.items!.length > 1" class="tool-group-details">
                            <summary class="tool-group-summary">
                              <i class="pi pi-code"></i>
                              <span>{{ workGroupSummary(group.items!) }}</span>
                              <span v-if="group.items!.some(c => c.error)" class="tool-error-badge">error</span>
                              <i class="pi pi-chevron-right tool-chevron"></i>
                            </summary>
                            <div class="tool-group-content">
                              <template v-for="item in group.items" :key="item.id || item.text?.slice(0,20)">
                                <details v-if="item.type === 'tool_call'" class="tool-call">
                                  <summary class="tool-summary">
                                    <i class="pi pi-code"></i>
                                    Python
                                    <span v-if="item.error" class="tool-error-badge">error</span>
                                  </summary>
                                  <pre class="tool-code">{{ item.code }}</pre>
                                  <pre v-if="item.result" class="tool-result">{{ item.result }}</pre>
                                  <pre v-if="item.error" class="tool-result tool-error">{{ item.error }}</pre>
                                </details>
                                <details v-else-if="item.type === 'thinking'" class="tool-call thinking-in-group">
                                  <summary class="tool-summary thinking-summary-inline">
                                    <i class="pi pi-sparkles"></i>
                                    Thinking
                                  </summary>
                                  <div class="thinking-content">{{ item.text }}</div>
                                </details>
                              </template>
                            </div>
                          </details>
                          <template v-else>
                            <details v-if="group.items![0].type === 'tool_call'" class="tool-call">
                              <summary class="tool-summary">
                                <i class="pi pi-code"></i>
                                Python
                                <span v-if="group.items![0].error" class="tool-error-badge">error</span>
                              </summary>
                              <pre class="tool-code">{{ group.items![0].code }}</pre>
                              <pre v-if="group.items![0].result" class="tool-result">{{ group.items![0].result }}</pre>
                              <pre v-if="group.items![0].error" class="tool-result tool-error">{{ group.items![0].error }}</pre>
                            </details>
                            <details v-else class="thinking-details">
                              <summary class="thinking-summary">
                                <i class="pi pi-sparkles"></i>
                                Thinking
                              </summary>
                              <div class="thinking-content">{{ group.items![0].text }}</div>
                            </details>
                          </template>
                        </div>
                      </template>
                    </template>
                    <div v-else-if="msg.content" class="markdown-content" v-html="renderMarkdown(msg.content)"></div>
                    <span v-if="msg.status === 'generating' && !streaming.isStreaming" class="typing-indicator">
                      <span></span><span></span><span></span>
                    </span>
                    <div v-if="msg.status === 'error' && !msg.content && !msg.blocks?.length" class="generation-error">
                      <i class="pi pi-exclamation-triangle"></i> Generation failed
                    </div>
                  </div>
                  <!-- Message actions -->
                  <div v-if="editingMessageId !== msg.id" class="msg-actions">
                    <span class="msg-actions-time">{{ formatTime(msg.created_at) }}</span>
                    <span v-if="msg.role === 'assistant' && msg.metadata?.model" class="msg-model-name">{{ getModelName(msg.metadata.model) }}</span>
                    <button class="msg-action-btn" title="Copy" @click="copyMessage(msg)">
                      <i class="pi pi-copy"></i>
                    </button>
                    <button v-if="msg.role === 'user'" class="msg-action-btn" title="Edit" @click="startEdit(msg)">
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button class="msg-action-btn" title="Retry" @click="handleRetryMsg(mi)">
                      <i class="pi pi-refresh"></i>
                    </button>
                    <div v-if="msg.role === 'assistant'" class="retry-model-wrap">
                      <button class="msg-action-btn" title="Retry with different model" @click.stop="retryModelMenuIdx = retryModelMenuIdx === mi ? null : mi">
                        <i class="pi pi-chevron-down" style="font-size: 0.6rem;"></i>
                      </button>
                      <div v-if="retryModelMenuIdx === mi" class="retry-model-menu">
                        <button
                          v-for="m in availableModels"
                          :key="m.id"
                          class="retry-model-item"
                          :class="{ active: m.id === msg.metadata?.model }"
                          @click="handleRetryWithModel(mi, m.id)"
                        >
                          {{ m.name }}
                        </button>
                      </div>
                    </div>
                    <button class="msg-action-btn msg-action-delete" title="Delete from here" @click="handleDeleteMsg(mi)">
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Streaming assistant response -->
              <div v-if="streaming.isStreaming || streaming.blocks.length" class="message assistant">
                <div class="message-col">
                <div class="message-bubble assistant-bubble">
                  <template v-for="(group, gi) in streamingGroups" :key="gi">
                    <div v-if="group.type === 'text' && group.text" class="markdown-content" v-html="renderMarkdown(group.text)"></div>
                    <div v-else-if="group.type === 'work_group'" class="tool-group">
                      <details class="tool-group-details">
                        <summary class="tool-group-summary">
                          <i class="pi pi-code"></i>
                          <span>{{ workGroupSummary(group.items!) }}...</span>
                          <i v-if="streaming.isStreaming && gi === streamingGroups.length - 1" class="pi pi-spin pi-spinner tool-spinner"></i>
                          <i class="pi pi-chevron-right tool-chevron"></i>
                        </summary>
                        <div class="tool-group-content">
                          <template v-for="item in group.items" :key="item.id || item.text?.slice(0,20)">
                            <details v-if="item.type === 'tool_call'" class="tool-call" :open="item.id === streaming.currentToolId">
                              <summary class="tool-summary">
                                <i class="pi pi-code"></i>
                                Python
                                <i v-if="item.id === streaming.currentToolId" class="pi pi-spin pi-spinner tool-spinner"></i>
                                <span v-if="item.error" class="tool-error-badge">error</span>
                              </summary>
                              <pre class="tool-code">{{ item.code }}</pre>
                              <pre v-if="item.result" class="tool-result">{{ item.result }}</pre>
                              <pre v-if="item.error" class="tool-result tool-error">{{ item.error }}</pre>
                            </details>
                            <details v-else-if="item.type === 'thinking'" class="tool-call thinking-in-group">
                              <summary class="tool-summary thinking-summary-inline">
                                <i class="pi pi-sparkles"></i>
                                Thinking...
                              </summary>
                              <div class="thinking-content">{{ item.text }}</div>
                            </details>
                          </template>
                        </div>
                      </details>
                    </div>
                  </template>
                  <span v-if="streaming.isStreaming && !streaming.blocks.length" class="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Input -->
          <div class="chat-input-area">
            <div class="chat-input-wrapper">
              <textarea
                ref="inputEl"
                v-model="inputText"
                class="chat-input"
                placeholder="Message..."
                rows="1"
                @keydown.enter.exact="handleSend"
                @input="autoResizeInput"
              ></textarea>
              <div class="input-bottom-row">
                <div class="model-picker-wrap">
                  <button
                    v-if="availableModels.length > 1"
                    class="model-picker"
                    @click="showModelMenu = !showModelMenu"
                  >
                    {{ selectedModel?.name || 'Model' }}
                    <i class="pi pi-chevron-down"></i>
                  </button>
                  <span v-else-if="selectedModel" class="model-label">{{ selectedModel.name }}</span>
                  <div v-if="showModelMenu" class="model-menu">
                    <button
                      v-for="m in availableModels"
                      :key="m.id"
                      class="model-menu-item"
                      :class="{ active: m.id === selectedModelId }"
                      @click="selectedModelId = m.id; showModelMenu = false"
                    >
                      <span class="model-menu-name">{{ m.name }}</span>
                      <span class="model-menu-price">${{ m.input_price }} / ${{ m.output_price }}</span>
                    </button>
                  </div>
                </div>
                <div class="input-bottom-spacer"></div>
                <button
                  v-if="sendingMessage"
                  class="send-btn stop-btn"
                  @click="cancelStream"
                  title="Stop"
                >
                  <i class="pi pi-stop-circle"></i>
                </button>
                <button
                  v-else
                  class="send-btn"
                  :disabled="!inputText.trim()"
                  @click="handleSend"
                >
                  <i class="pi pi-send"></i>
                </button>
              </div>
            </div>
          </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import 'katex/dist/katex.min.css'
import { PageHeader, Tooltip, NavigationTabs } from '@/components/common'
import { useAuth } from '@/composables/useAuth'
import { useChat, type ContentBlock } from '@/composables/useChat'

const router = useRouter()
const { user, signOut, isAdmin } = useAuth()
const {
  sessions, currentSessionId, messages, streaming,
  sessionsLoading, messagesLoading, sendingMessage,
  sessionUsage, availableModels, selectedModelId, selectedModel,
  fetchModels, fetchSessions, createSession, deleteSession, selectSession,
  sendMessage, cancelStream,
  deleteMessagesFrom, retryFromMessage, editAndResend,
} = useChat()

const editingMessageId = ref<string | null>(null)
const editText = ref('')
const sessionSearch = ref('')
let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(sessionSearch, (q) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => fetchSessions(q.trim() || undefined), 250)
})

const showUsage = ref(false)

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function getModelPricing(modelId?: string) {
  if (modelId) {
    const m = availableModels.value.find(m => m.id === modelId)
    if (m) return m
  }
  return selectedModel.value
}

function calcMessageCost(meta: any): number {
  const m = getModelPricing(meta?.model)
  if (!m || !meta) return 0
  const input = meta.input_tokens || 0
  const output = meta.output_tokens || 0
  const cacheRead = meta.cache_read_input_tokens || 0
  const cacheWrite = meta.cache_creation_input_tokens || 0
  const baseInput = input - cacheRead - cacheWrite
  return (
    baseInput * (m.input_price || 0) +
    output * (m.output_price || 0) +
    cacheRead * (m.cache_read_price || 0) +
    cacheWrite * (m.cache_write_price || 0)
  ) / 1_000_000
}

const sessionCost = computed(() => {
  let total = 0
  for (const msg of messages.value) {
    if (msg.metadata) total += calcMessageCost(msg.metadata)
  }
  if (total < 0.005) return '<$0.01'
  return '$' + total.toFixed(2)
})

interface GroupedBlock {
  type: 'text' | 'work_group'
  text?: string
  items?: ContentBlock[]
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

function workGroupSummary(items: ContentBlock[]): string {
  const toolCount = items.filter(b => b.type === 'tool_call').length
  const thinkCount = items.filter(b => b.type === 'thinking').length
  if (toolCount && thinkCount) return `Ran ${toolCount} ${toolCount === 1 ? 'query' : 'queries'}`
  if (toolCount) return `Ran ${toolCount} ${toolCount === 1 ? 'query' : 'queries'}`
  return `Thinking (${thinkCount} ${thinkCount === 1 ? 'step' : 'steps'})`
}

const streamingGroups = computed(() => groupBlocks(streaming.value.blocks))

const displayMessages = computed(() =>
  streaming.value.isStreaming
    ? messages.value.filter(m => m.status !== 'generating')
    : messages.value
)

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const inputText = ref('')
const inputEl = ref<HTMLTextAreaElement>()
const messagesContainer = ref<HTMLElement>()

// Markdown renderer - links open in new tab + LaTeX support
const renderer = new marked.Renderer()
renderer.link = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener">${text}</a>`
}
marked.use(markedKatex({ throwOnError: false }))
marked.setOptions({ breaks: true, gfm: true, renderer })

function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

function autoResizeInput() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 280) + 'px'
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function handleNewChat() {
  cancelStream()
  const id = await createSession()
  if (id) {
    await selectSession(id)
    nextTick(() => inputEl.value?.focus())
  }
}

async function handleDelete(id: string) {
  await deleteSession(id)
}

async function handleSend(e?: Event) {
  if (e && e instanceof KeyboardEvent && e.shiftKey) return
  e?.preventDefault()

  const text = inputText.value.trim()
  if (!text || sendingMessage.value) return

  inputText.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'

  if (!(await ensureSession())) return
  scrollToBottom()
  await sendMessage(text)
  scrollToBottom()
}

async function copyMessage(msg: any) {
  const text = msg.content || ''
  try { await navigator.clipboard.writeText(text) } catch {}
}

async function handleDeleteMsg(mi: number) {
  const msg = messages.value[mi]
  if (msg) await deleteMessagesFrom(msg.id)
}

async function handleRetryMsg(mi: number) {
  await retryFromMessage(mi)
}

function startEdit(msg: any) {
  editingMessageId.value = msg.id
  editText.value = msg.content || ''
}

function cancelEdit() {
  editingMessageId.value = null
  editText.value = ''
}

async function confirmEdit(msgId: string) {
  const text = editText.value.trim()
  if (!text) return
  editingMessageId.value = null
  editText.value = ''
  await editAndResend(msgId, text)
}

const showModelMenu = ref(false)
const retryModelMenuIdx = ref<number | null>(null)

function getModelName(modelId?: string): string | null {
  if (!modelId) return null
  return availableModels.value.find(m => m.id === modelId)?.name
    ?? modelId.split('/').pop()?.replace(/-/g, ' ')
    ?? modelId
}

async function handleRetryWithModel(mi: number, modelId: string) {
  retryModelMenuIdx.value = null
  await retryFromMessage(mi, modelId)
}

async function ensureSession(): Promise<boolean> {
  if (currentSessionId.value) return true
  const id = await createSession()
  if (!id) return false
  await selectSession(id)
  await nextTick()
  return true
}

async function handleSendText(text: string) {
  if (!text.trim() || sendingMessage.value) return
  if (!(await ensureSession())) return
  await sendMessage(text)
}

async function handleSignOut() {
  await signOut()
  router.push('/login')
}

// Auto-scroll on streaming updates
watch(() => streaming.value.blocks.length, scrollToBottom)
watch(() => {
  const blocks = streaming.value.blocks
  const last = blocks[blocks.length - 1]
  return last?.type === 'text' ? last.text?.length : 0
}, scrollToBottom)
watch(() => messages.value.length, scrollToBottom)

function handleGlobalClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (showUsage.value && !t.closest('.usage-bar')) showUsage.value = false
  if (showModelMenu.value && !t.closest('.model-picker-wrap')) showModelMenu.value = false
  if (retryModelMenuIdx.value !== null && !t.closest('.retry-model-wrap')) retryModelMenuIdx.value = null
}

onMounted(async () => {
  document.addEventListener('click', handleGlobalClick)
  await Promise.all([fetchSessions(), fetchModels()])
  if (sessions.value.length > 0 && !currentSessionId.value) {
    await selectSession(sessions.value[0].id)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})
</script>

<style scoped>
.chat-view {
  position: fixed;
  inset: 0;
  background: var(--bg-primary);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  z-index: 1;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn i { font-size: 1.4rem; }
.icon-btn:hover { color: var(--accent-primary); }

/* Layout */
.chat-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;
  overflow: hidden;
}

/* Sidebar */
.chat-sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-primary);
  padding-right: 0.75rem;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.new-chat-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
}

/* Session search */
.session-search-wrap {
  position: relative;
  margin-bottom: 0.5rem;
}

.session-search-icon {
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  color: var(--text-muted);
  pointer-events: none;
}

.session-search {
  width: 100%;
  padding: 0.75rem 0.6rem 0.75rem 2rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
}
.session-search:focus { border-color: var(--accent-primary); }
.session-search::placeholder { color: var(--text-muted); }

.session-search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem;
  font-size: 0.7rem;
  line-height: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.session-search-clear:hover { color: var(--text-primary); background: var(--bg-tertiary); }

.sidebar-empty {
  text-align: center;
  padding: 1rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

.session-item {
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s ease;
  gap: 0.5rem;
}

.session-item:hover {
  background: var(--bg-secondary);
}

.session-item.active {
  background: var(--bg-tertiary);
}

.session-title {
  flex: 1;
  font-size: 0.95rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item.active .session-title {
  color: var(--text-primary);
}

.session-delete {
  opacity: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem;
  font-size: 0.75rem;
  transition: all 0.1s ease;
  flex-shrink: 0;
}

.session-item:hover .session-delete { opacity: 1; }
.session-delete:hover { color: var(--error-text); }

/* Main Chat */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 1rem;
}

.chat-empty i.pi-comments { font-size: 3rem; color: var(--text-disabled); }
.session-empty { padding-top: 3rem; }
.session-empty p { font-size: 1.2rem; color: var(--text-secondary); }

/* Example queries */
.example-queries {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-top: 1.25rem;
  max-width: 480px;
}

.example-query {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.example-query:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
.example-query i { font-size: 1rem; color: var(--text-muted); flex-shrink: 0; }
.example-query:hover i { color: var(--accent-primary); }

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

.messages-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

/* Messages */
.message {
  display: flex;
  max-width: 100%;
  min-width: 0;
}

.message.user { justify-content: flex-end; }
.message.assistant { justify-content: flex-start; }

.message-bubble {
  max-width: 100%;
  padding: 0.9rem 1.2rem;
  border-radius: var(--radius-lg);
  font-size: 1.12rem;
  line-height: 1.7;
  word-wrap: break-word;
  overflow: hidden;
  min-width: 0;
}

.user-bubble {
  background: var(--accent-primary-dark);
  color: var(--text-primary);
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}

.assistant-bubble {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

/* Tool calls */
.tool-calls {
  margin: 0.75rem 0 0.85rem;
}

.tool-call {
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.tool-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--bg-tertiary);
  user-select: none;
}

.tool-summary:hover { color: var(--text-primary); }

.tool-spinner { font-size: 0.8rem; }

.tool-error-badge {
  font-size: 0.75rem;
  color: var(--error-text);
  background: var(--error-bg);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.tool-code {
  padding: 0.7rem 0.85rem;
  font-size: 0.85rem;
  font-family: 'Fira Code', 'Consolas', monospace;
  background: #1a1a2e;
  color: #a8d8ea;
  overflow-x: auto;
  margin: 0;
  border-top: 1px solid var(--border-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.tool-result {
  padding: 0.7rem 0.85rem;
  font-size: 0.8rem;
  font-family: 'Fira Code', 'Consolas', monospace;
  background: #1a1a1a;
  color: var(--text-secondary);
  overflow-x: auto;
  margin: 0;
  border-top: 1px solid var(--border-primary);
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.tool-error {
  color: var(--error-text);
  background: var(--error-bg);
}

/* Expand/collapse animation for details content */
details[open] > *:not(summary) {
  animation: detailsSlideDown 0.2s ease-out;
}
@keyframes detailsSlideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Markdown content */
.markdown-content :deep(p) { margin: 0.5rem 0; }
.markdown-content :deep(p:first-child) { margin-top: 0; }
.markdown-content :deep(p:last-child) { margin-bottom: 0; }
.markdown-content :deep(ul), .markdown-content :deep(ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
.markdown-content :deep(li) { margin: 0.25rem 0; }
.markdown-content :deep(code) {
  background: var(--bg-tertiary);
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
  font-size: 0.88em;
  font-family: 'Fira Code', 'Consolas', monospace;
}
.markdown-content :deep(pre) {
  background: #1a1a2e;
  padding: 0.85rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 0.6rem 0;
  font-size: 0.9rem;
}
.markdown-content :deep(pre code) { background: transparent; padding: 0; }
.markdown-content :deep(table) {
  border-collapse: collapse;
  margin: 0.6rem 0;
  font-size: 0.92em;
}
.markdown-content :deep(th), .markdown-content :deep(td) {
  border: 1px solid var(--border-primary);
  padding: 0.45rem 0.65rem;
}
.markdown-content :deep(th) { background: var(--bg-tertiary); }
.markdown-content :deep(strong) { color: #fff; }
.markdown-content :deep(a) { color: var(--accent-primary); }

/* Typing indicator */
.typing-indicator {
  display: inline-flex;
  gap: 4px;
  padding: 0.25rem 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: typing 1.2s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

/* Input area */
.chat-input-area {
  padding: 0.4rem 2rem 0.75rem;
  border-top: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.model-label {
  font-size: 0.88rem;
  color: var(--text-muted);
}

.chat-input-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 700px;
  margin: 0 auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 1.1rem;
  padding: 0.6rem 0.7rem 0.4rem 0.85rem;
  transition: border-color 0.15s ease;
  gap: 0.3rem;
}

.chat-input-wrapper:focus-within {
  border-color: var(--accent-primary);
}

.chat-input {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1.05rem;
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

.input-bottom-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.input-bottom-spacer { flex: 1; }

.model-picker-wrap { position: relative; }

.model-picker {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.55rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  white-space: nowrap;
}
.model-picker:hover { color: var(--text-secondary); background: var(--bg-tertiary); }
.model-picker i { font-size: 0.65rem; opacity: 0.6; }

.model-menu {
  position: absolute;
  bottom: calc(100% + 0.4rem);
  left: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.3rem;
  min-width: 200px;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  animation: detailsSlideDown 0.15s ease-out;
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
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.1s;
  gap: 1.2rem;
}
.model-menu-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.model-menu-item.active { color: var(--accent-primary); }

.model-menu-name { white-space: nowrap; }
.model-menu-price {
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
  font-family: 'Fira Code', 'Consolas', monospace;
}

.chat-input::placeholder { color: var(--text-muted); }

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: var(--accent-primary);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  font-size: 0.85rem;
}

.send-btn:hover:not(:disabled) { opacity: 0.85; }
.send-btn:disabled { opacity: 0.3; cursor: default; }

.stop-btn {
  background: var(--error-bg);
  color: var(--error-text);
}

.stop-btn:hover { background: #662020; }

/* Message column wrapper for actions */
.message-col {
  display: flex;
  flex-direction: column;
  max-width: min(80%, 800px);
}
.message.user .message-col { align-items: flex-end; }
.message.assistant .message-col { align-items: flex-start; }

/* Message actions bar */
.msg-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  margin-top: 0.25rem;
  padding: 0 0.25rem;
  opacity: 0;
  transition: opacity 0.15s;
  height: 1.5rem;
}
.message:hover .msg-actions { opacity: 1; }

.msg-actions-time {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-right: 0.35rem;
}

.msg-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.1s;
  font-size: 0.8rem;
}
.msg-action-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
.msg-action-delete:hover { color: var(--error-text); }

.msg-model-name {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-right: 0.2rem;
  white-space: nowrap;
}

.retry-model-wrap { position: relative; }

.retry-model-menu {
  position: absolute;
  bottom: calc(100% + 0.3rem);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.25rem;
  min-width: 160px;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  animation: detailsSlideDown 0.15s ease-out;
}

.retry-model-item {
  display: block;
  width: 100%;
  padding: 0.4rem 0.65rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  text-align: left;
  transition: all 0.1s;
  white-space: nowrap;
}
.retry-model-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.retry-model-item.active { color: var(--accent-primary); }

/* Inline message editing */
.message-bubble.editing {
  padding: 0.6rem;
}

.edit-textarea {
  width: 100%;
  min-height: 3rem;
  max-height: 200px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 1.05rem;
  font-family: inherit;
  line-height: 1.6;
  padding: 0.5rem 0.7rem;
  resize: vertical;
  outline: none;
}
.edit-textarea:focus { border-color: var(--accent-primary); }

.edit-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.4rem;
  justify-content: flex-end;
}

.edit-btn {
  padding: 0.3rem 0.7rem;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.1s;
}

.edit-save {
  background: var(--accent-primary);
  color: #fff;
}
.edit-save:hover { opacity: 0.85; }

.edit-cancel {
  background: transparent;
  color: var(--text-secondary);
}
.edit-cancel:hover { color: var(--text-primary); background: var(--bg-tertiary); }

/* Tool group (multiple consecutive calls) */
.tool-group { margin: 0.75rem 0 0.85rem; }

.tool-group-details {
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tool-group-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--bg-tertiary);
  user-select: none;
  list-style: none;
}
.tool-group-summary::-webkit-details-marker { display: none; }
.tool-group-summary:hover { color: var(--text-primary); }

.tool-chevron {
  margin-left: auto;
  font-size: 0.7rem;
  transition: transform 0.2s ease;
}
.tool-group-details[open] > .tool-group-summary .tool-chevron { transform: rotate(90deg); }

.tool-group-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.tool-group-content .tool-call {
  border-radius: 0;
  border: none;
  border-top: 1px solid var(--border-primary);
  margin-bottom: 0;
}

/* Thinking block */
.thinking-block { margin: 0.75rem 0 0.85rem; }

.thinking-details {
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  overflow: hidden;
  max-height: 450px;
}

.thinking-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  cursor: pointer;
  background: var(--bg-tertiary);
  user-select: none;
  list-style: none;
  font-style: italic;
}
.thinking-summary::-webkit-details-marker { display: none; }
.thinking-summary:hover { color: var(--text-secondary); }
.thinking-summary i { font-size: 0.8rem; }

.thinking-summary-inline {
  font-style: italic;
  color: var(--text-muted);
}
.thinking-summary-inline i { font-size: 0.75rem; }

.generation-error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--error-text);
  font-size: 0.9rem;
  padding: 0.4rem 0;
}
.generation-error i { font-size: 0.85rem; }

.thinking-content {
  padding: 0.7rem 0.85rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  font-style: italic;
  line-height: 1.55;
}

/* Token usage bar */
.usage-bar {
  position: relative;
  display: flex;
  justify-content: flex-end;
  padding: 0.25rem 2rem 0;
  flex-shrink: 0;
}

.usage-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.6rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.88rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}

.usage-toggle:hover { color: var(--text-secondary); }
.usage-toggle i { font-size: 0.9rem; }

.usage-detail {
  position: absolute;
  top: 100%;
  right: 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.85rem;
  min-width: 180px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.usage-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.85rem;
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
</style>
