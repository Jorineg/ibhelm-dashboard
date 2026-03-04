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
        <nav class="view-tabs">
          <button class="view-tab" @click="router.push('/')">Items</button>
          <button class="view-tab" @click="router.push('/')">Projects</button>
          <button class="view-tab" @click="router.push('/')">People</button>
          <button class="view-tab active">Chat</button>
        </nav>
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

        <div class="sessions-list thin-scrollbar">
          <div v-if="sessionsLoading" class="sidebar-loading">
            <i class="pi pi-spin pi-spinner"></i>
          </div>
          <template v-else>
            <div
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === currentSessionId }"
              @click="selectSession(session.id)"
            >
              <span class="session-title">{{ session.title || 'Neuer Chat' }}</span>
              <button
                class="session-delete"
                @click.stop="handleDelete(session.id)"
                title="Löschen"
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
            <span class="usage-summary">{{ formatTokens(sessionUsage.input_tokens + sessionUsage.output_tokens) }} tokens</span>
          </button>
          <div v-if="showUsage" class="usage-detail">
            <div class="usage-row"><span>Input</span><span>{{ formatTokens(sessionUsage.input_tokens) }}</span></div>
            <div class="usage-row"><span>Output</span><span>{{ formatTokens(sessionUsage.output_tokens) }}</span></div>
            <div v-if="sessionUsage.cache_read_input_tokens" class="usage-row"><span>Cache read</span><span>{{ formatTokens(sessionUsage.cache_read_input_tokens) }}</span></div>
            <div v-if="sessionUsage.cache_creation_input_tokens" class="usage-row"><span>Cache write</span><span>{{ formatTokens(sessionUsage.cache_creation_input_tokens) }}</span></div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!currentSessionId" class="chat-empty">
          <i class="pi pi-comments"></i>
          <p>Wähle einen Chat oder starte einen neuen</p>
        </div>

        <!-- Messages -->
        <template v-else>
          <div ref="messagesContainer" class="messages-container thin-scrollbar">
            <div v-if="messagesLoading" class="messages-loading">
              <i class="pi pi-spin pi-spinner"></i>
            </div>
            <template v-else>
              <!-- Persisted messages -->
              <div
                v-for="msg in messages"
                :key="msg.id"
                class="message"
                :class="msg.role"
              >
                <div v-if="msg.role === 'user'" class="message-bubble user-bubble">
                  {{ msg.content }}
                </div>
                <div v-else class="message-bubble assistant-bubble">
                  <!-- Tool calls (collapsible) -->
                  <div v-if="msg.tool_calls?.length" class="tool-calls">
                    <details v-for="tc in msg.tool_calls" :key="tc.id" class="tool-call">
                      <summary class="tool-summary">
                        <i class="pi pi-code"></i>
                        Python
                        <span v-if="tc.error" class="tool-error-badge">error</span>
                      </summary>
                      <pre class="tool-code">{{ tc.code }}</pre>
                      <pre v-if="tc.result" class="tool-result">{{ tc.result }}</pre>
                      <pre v-if="tc.error" class="tool-result tool-error">{{ tc.error }}</pre>
                    </details>
                  </div>
                  <div v-if="msg.content" class="markdown-content" v-html="renderMarkdown(msg.content)"></div>
                </div>
              </div>

              <!-- Streaming assistant response -->
              <div v-if="streaming.isStreaming || streaming.text || streaming.toolCalls.length" class="message assistant">
                <div class="message-bubble assistant-bubble">
                  <!-- Streaming tool calls -->
                  <div v-if="streaming.toolCalls.length" class="tool-calls">
                    <details
                      v-for="tc in streaming.toolCalls"
                      :key="tc.id"
                      class="tool-call"
                      :open="tc.id === streaming.currentToolId"
                    >
                      <summary class="tool-summary">
                        <i class="pi pi-code"></i>
                        Python
                        <i v-if="tc.id === streaming.currentToolId" class="pi pi-spin pi-spinner tool-spinner"></i>
                        <span v-if="tc.error" class="tool-error-badge">error</span>
                      </summary>
                      <pre class="tool-code">{{ tc.code }}</pre>
                      <pre v-if="tc.result" class="tool-result">{{ tc.result }}</pre>
                      <pre v-if="tc.error" class="tool-result tool-error">{{ tc.error }}</pre>
                    </details>
                  </div>
                  <!-- Streaming text -->
                  <div v-if="streaming.text" class="markdown-content" v-html="renderMarkdown(streaming.text)"></div>
                  <span v-if="streaming.isStreaming && !streaming.text && !streaming.currentToolId" class="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
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
                placeholder="Nachricht schreiben..."
                rows="1"
                @keydown.enter.exact="handleSend"
                @input="autoResizeInput"
              ></textarea>
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
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import { PageHeader, Tooltip } from '@/components/common'
import { useAuth } from '@/composables/useAuth'
import { useChat } from '@/composables/useChat'

const router = useRouter()
const { user, signOut, isAdmin } = useAuth()
const {
  sessions, currentSessionId, messages, streaming,
  sessionsLoading, messagesLoading, sendingMessage,
  sessionUsage,
  fetchSessions, createSession, deleteSession, selectSession,
  sendMessage, cancelStream,
} = useChat()

const showUsage = ref(false)

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

const inputText = ref('')
const inputEl = ref<HTMLTextAreaElement>()
const messagesContainer = ref<HTMLElement>()

// Markdown renderer
marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

function autoResizeInput() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function handleNewChat() {
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

  scrollToBottom()
  await sendMessage(text)
  scrollToBottom()
}

async function handleSignOut() {
  await signOut()
  router.push('/login')
}

// Auto-scroll on streaming updates
watch(() => streaming.value.text, scrollToBottom)
watch(() => streaming.value.toolCalls.length, scrollToBottom)
watch(() => messages.value.length, scrollToBottom)

onMounted(async () => {
  await fetchSessions()
  // Auto-select most recent session if any
  if (sessions.value.length > 0 && !currentSessionId.value) {
    await selectSession(sessions.value[0].id)
  }
})
</script>

<style scoped>
.chat-view {
  height: 100%;
  background: var(--bg-primary);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Reuse tab style from HomeView */
.view-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.view-tab {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 1rem;
  font-weight: 400;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease;
  position: relative;
}

.view-tab:hover:not(.active) {
  color: var(--text-secondary);
}

.view-tab.active {
  color: var(--text-primary);
  font-weight: 600;
}

.view-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 70%;
  height: 2px;
  background: var(--accent-primary);
  border-radius: 1px;
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
  font-size: 0.85rem;
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

.chat-empty i { font-size: 3rem; color: var(--text-disabled); }

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
}

.message.user { justify-content: flex-end; }
.message.assistant { justify-content: flex-start; }

.message-bubble {
  max-width: min(75%, 700px);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-lg);
  font-size: 0.9rem;
  line-height: 1.6;
  word-wrap: break-word;
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
  margin-bottom: 0.75rem;
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
  padding: 0.4rem 0.6rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--bg-tertiary);
  user-select: none;
}

.tool-summary:hover { color: var(--text-primary); }

.tool-spinner { font-size: 0.75rem; }

.tool-error-badge {
  font-size: 0.7rem;
  color: var(--error-text);
  background: var(--error-bg);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.tool-code {
  padding: 0.6rem 0.75rem;
  font-size: 0.8rem;
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
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
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

/* Markdown content */
.markdown-content :deep(p) { margin: 0.4rem 0; }
.markdown-content :deep(p:first-child) { margin-top: 0; }
.markdown-content :deep(p:last-child) { margin-bottom: 0; }
.markdown-content :deep(ul), .markdown-content :deep(ol) { padding-left: 1.5rem; margin: 0.4rem 0; }
.markdown-content :deep(code) {
  background: var(--bg-tertiary);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85em;
  font-family: 'Fira Code', 'Consolas', monospace;
}
.markdown-content :deep(pre) {
  background: #1a1a2e;
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 0.5rem 0;
}
.markdown-content :deep(pre code) { background: transparent; padding: 0; }
.markdown-content :deep(table) {
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.85em;
}
.markdown-content :deep(th), .markdown-content :deep(td) {
  border: 1px solid var(--border-primary);
  padding: 0.4rem 0.6rem;
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
  padding: 0.6rem 2rem 0.75rem;
  border-top: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.chat-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 700px;
  margin: 0 auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 0.35rem 0.5rem 0.35rem 0.85rem;
  transition: border-color 0.15s ease;
}

.chat-input-wrapper:focus-within {
  border-color: var(--accent-primary);
}

.chat-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1.05rem;
  font-family: inherit;
  line-height: 1.5;
  resize: none;
  outline: none;
  max-height: 200px;
  padding: 0.2rem 0;
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
  gap: 0.35rem;
  padding: 0.2rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}

.usage-toggle:hover { color: var(--text-secondary); }
.usage-toggle i { font-size: 0.8rem; }

.usage-detail {
  position: absolute;
  top: 100%;
  right: 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  min-width: 160px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.usage-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.15rem 0;
}

.usage-row span:last-child {
  font-family: 'Fira Code', 'Consolas', monospace;
  color: var(--text-primary);
}
</style>
