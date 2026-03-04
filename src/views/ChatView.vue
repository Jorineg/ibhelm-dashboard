<template>
  <div class="chat-view">
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
      <ChatSidebar
        :sessions="sessions"
        :active-id="currentSessionId"
        :loading="sessionsLoading"
        :search="sessionSearch"
        @new-chat="handleNewChat"
        @select="selectSession"
        @delete="handleDelete"
        @update:search="handleSearchUpdate"
      />

      <main class="chat-main">
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

        <div ref="messagesContainer" class="messages-container thin-scrollbar">
          <div v-if="messagesLoading" class="messages-loading">
            <i class="pi pi-spin pi-spinner"></i>
          </div>
          <template v-else>
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

            <ChatMessage
              v-for="(msg, mi) in displayMessages"
              :key="msg.id"
              :msg="msg"
              :editing="editingMessageId === msg.id"
              :edit-text="editText"
              :available-models="availableModels"
              :show-retry-menu="retryModelMenuIdx === mi"
              @copy="copyMessage(msg)"
              @start-edit="startEdit(msg)"
              @cancel-edit="cancelEdit"
              @confirm-edit="confirmEdit(msg.id)"
              @update:edit-text="editText = $event"
              @retry="handleRetryMsg(mi)"
              @toggle-retry-menu="retryModelMenuIdx = retryModelMenuIdx === mi ? null : mi"
              @retry-with-model="handleRetryWithModel(mi, $event)"
              @delete="handleDeleteMsg(mi)"
            />

            <ChatMessage
              v-if="streaming.isStreaming || streaming.blocks.length"
              :msg="streamingMsg"
              :is-streaming="streaming.isStreaming"
              :current-tool-id="streaming.currentToolId"
              :available-models="availableModels"
            />
          </template>
        </div>

        <ChatInput
          ref="chatInputRef"
          :model-value="inputText"
          :models="availableModels"
          :selected-model-id="selectedModelId"
          :selected-model="selectedModel"
          :sending="sendingMessage"
          @update:model-value="inputText = $event"
          @send="handleSend"
          @stop="cancelStream"
          @update:selected-model-id="selectedModelId = $event"
        />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { PageHeader, Tooltip, NavigationTabs } from '@/components/common'
import { ChatSidebar, ChatInput, ChatMessage } from '@/components/chat'
import { useAuth } from '@/composables/useAuth'
import { useChat } from '@/composables/useChat'

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
const showUsage = ref(false)
const inputText = ref('')
const messagesContainer = ref<HTMLElement>()
const chatInputRef = ref<InstanceType<typeof ChatInput>>()
const retryModelMenuIdx = ref<number | null>(null)

let searchDebounce: ReturnType<typeof setTimeout> | null = null

function handleSearchUpdate(q: string) {
  sessionSearch.value = q
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => fetchSessions(q.trim() || undefined), 250)
}

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

const streamingMsg = computed(() => ({
  role: 'assistant' as const,
  blocks: streaming.value.blocks,
}))

const displayMessages = computed(() =>
  streaming.value.isStreaming
    ? messages.value.filter(m => m.status !== 'generating')
    : messages.value
)

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
    nextTick(() => chatInputRef.value?.focus())
  }
}

async function handleDelete(id: string) {
  await deleteSession(id)
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || sendingMessage.value) return
  inputText.value = ''
  chatInputRef.value?.resetHeight()
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

.chat-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  min-height: 0;
}

.messages-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

/* Empty state */
.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 1rem;
  max-width: 800px;
  width: 100%;
}
.session-empty { padding-top: 3rem; }
.session-empty p { font-size: 1.4rem; color: var(--text-secondary); }

.example-queries {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-top: 1.25rem;
  max-width: 520px;
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
  font-size: 1rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.example-query:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}
.example-query i { font-size: 1.1rem; color: var(--text-muted); flex-shrink: 0; }
.example-query:hover i { color: var(--accent-primary); }

/* Usage bar */
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
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}
.usage-toggle:hover { color: var(--text-secondary); }
.usage-toggle i { font-size: 0.95rem; }

.usage-detail {
  position: absolute;
  top: 100%;
  right: 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.85rem;
  min-width: 200px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

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
</style>
