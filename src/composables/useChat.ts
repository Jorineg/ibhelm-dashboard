import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL || `${window.location.origin}/chat`

export interface ChatSession {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ContentBlock {
  type: 'text' | 'tool_call' | 'thinking'
  text?: string
  id?: string
  code?: string
  result?: string
  error?: string
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  model?: string
  subcalls?: ChatSubcall[]
  error?: string
}

export interface LlmTurnSubcall {
  kind: 'llm_turn'
  index: number
  stop_reason?: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export interface ToolCostSubcall {
  kind: 'tool'
  index: number
  tool_name: string
  cost_usd: number
}

export type ChatSubcall = LlmTurnSubcall | ToolCostSubcall

export interface ChatFile {
  id: string
  filename: string
  content_hash: string
  bucket: string
  origin: string
  size_bytes: number
  mime_type: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string | null
  blocks: ContentBlock[] | null
  metadata: TokenUsage | null
  status?: 'complete' | 'generating' | 'error' | 'canceled'
  created_at: string
  files?: ChatFile[]
}

export interface StreamingState {
  blocks: ContentBlock[]
  currentToolId: string | null
  isStreaming: boolean
}

export interface ChatModel {
  id: string
  name: string
  provider: string
  default?: boolean
  hidden?: boolean
  context_window?: number
  supports_vision?: boolean
  input_price?: number
  output_price?: number
  cache_read_price?: number
  cache_write_price?: number
  base_url?: string
}

export type ChatMode = 'user' | 'agent'

export function getTotalInputTokens(meta: TokenUsage | null | undefined): number {
  if (!meta) return 0
  return (meta.input_tokens || 0) + (meta.cache_read_input_tokens || 0) + (meta.cache_creation_input_tokens || 0)
}

export function getMessageToolCost(meta: TokenUsage | null | undefined): number {
  if (!meta?.subcalls?.length) return 0
  return meta.subcalls.reduce((sum, sc) => sum + (sc.kind === 'tool' ? (sc.cost_usd || 0) : 0), 0)
}

export function getLastLlmTurn(meta: TokenUsage | null | undefined): LlmTurnSubcall | null {
  if (!meta) return null
  if (meta.subcalls?.length) {
    const llmTurns = meta.subcalls.filter((sc): sc is LlmTurnSubcall => sc.kind === 'llm_turn')
    if (llmTurns.length) return llmTurns[llmTurns.length - 1]
  }
  if (
    meta.input_tokens ||
    meta.output_tokens ||
    meta.cache_read_input_tokens ||
    meta.cache_creation_input_tokens
  ) {
    return {
      kind: 'llm_turn',
      index: 1,
      stop_reason: undefined,
      input_tokens: meta.input_tokens || 0,
      output_tokens: meta.output_tokens || 0,
      cache_read_input_tokens: meta.cache_read_input_tokens || 0,
      cache_creation_input_tokens: meta.cache_creation_input_tokens || 0,
    }
  }
  return null
}

function getModelPricing(modelId: string | undefined, models: ChatModel[], fallbackModel: ChatModel | null = null) {
  if (modelId) {
    const m = models.find(m => m.id === modelId)
    if (m) return m
  }
  return fallbackModel
}

export function calcMessageLlmCost(
  meta: TokenUsage | null | undefined,
  models: ChatModel[],
  fallbackModel: ChatModel | null = null
): number {
  const m = getModelPricing(meta?.model, models, fallbackModel)
  if (!m || !meta) return 0
  return (
    (meta.input_tokens || 0) * (m.input_price || 0) +
    (meta.output_tokens || 0) * (m.output_price || 0) +
    (meta.cache_read_input_tokens || 0) * (m.cache_read_price || 0) +
    (meta.cache_creation_input_tokens || 0) * (m.cache_write_price || 0)
  ) / 1_000_000
}

export function calcMessageTotalCost(
  meta: TokenUsage | null | undefined,
  models: ChatModel[],
  fallbackModel: ChatModel | null = null
): number {
  return calcMessageLlmCost(meta, models, fallbackModel) + getMessageToolCost(meta)
}

// Module-level state
const mode = ref<ChatMode>('user')
const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const streaming = ref<StreamingState>({
  blocks: [],
  currentToolId: null,
  isStreaming: false,
})
const sessionsLoading = ref(false)
const messagesLoading = ref(false)
const sendingMessage = ref(false)
const availableModels = ref<ChatModel[]>([])
const selectedModelId = ref<string | null>(null)

let abortController: AbortController | null = null

function sessionsUrl() {
  return mode.value === 'agent'
    ? `${CHAT_SERVICE_URL}/agent-sessions`
    : `${CHAT_SERVICE_URL}/sessions`
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
}

export function useChat() {
  const currentSession = computed(() =>
    sessions.value.find(s => s.id === currentSessionId.value) ?? null
  )

  const selectedModel = computed(() =>
    availableModels.value.find(m => m.id === selectedModelId.value) ?? null
  )

  const sessionUsage = computed<TokenUsage>(() => {
    const totals: TokenUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    for (const msg of messages.value) {
      if (msg.metadata) {
        totals.input_tokens += msg.metadata.input_tokens || 0
        totals.output_tokens += msg.metadata.output_tokens || 0
        totals.cache_read_input_tokens += msg.metadata.cache_read_input_tokens || 0
        totals.cache_creation_input_tokens += msg.metadata.cache_creation_input_tokens || 0
      }
    }
    return totals
  })

  function switchMode(m: ChatMode) {
    if (mode.value === m) return
    mode.value = m
    sessions.value = []
    currentSessionId.value = null
    messages.value = []
    streaming.value = { blocks: [], currentToolId: null, isStreaming: false }
  }

  async function fetchModels() {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${CHAT_SERVICE_URL}/models`, { headers })
      if (!res.ok) return
      const models: ChatModel[] = await res.json()
      availableModels.value = models
      if (!selectedModelId.value) {
        const def = models.find(m => m.default)
        selectedModelId.value = def?.id || models[0]?.id || null
      }
    } catch (e: any) {
      console.error('[useChat] fetchModels error:', e)
    }
  }

  async function fetchSessions(query?: string) {
    sessionsLoading.value = true
    try {
      const headers = await getAuthHeaders()
      const base = sessionsUrl()
      const url = query ? `${base}?q=${encodeURIComponent(query)}` : base
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`${res.status}`)
      sessions.value = await res.json()
    } catch (e: any) {
      console.error('[useChat] fetchSessions error:', e)
    } finally {
      sessionsLoading.value = false
    }
  }

  async function createSession(): Promise<string | null> {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(sessionsUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const session: ChatSession = await res.json()
      sessions.value.unshift(session)
      return session.id
    } catch (e: any) {
      console.error('[useChat] createSession error:', e)
      return null
    }
  }

  async function deleteSession(id: string) {
    try {
      const headers = await getAuthHeaders()
      await fetch(`${sessionsUrl()}/${id}`, { method: 'DELETE', headers })
      sessions.value = sessions.value.filter(s => s.id !== id)
      if (currentSessionId.value === id) {
        currentSessionId.value = null
        messages.value = []
      }
    } catch (e: any) {
      console.error('[useChat] deleteSession error:', e)
    }
  }

  async function renameSession(id: string, title: string) {
    try {
      const headers = await getAuthHeaders()
      await fetch(`${sessionsUrl()}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ title })
      })
      const s = sessions.value.find(s => s.id === id)
      if (s) s.title = title
    } catch (e: any) {
      console.error('[useChat] renameSession error:', e)
    }
  }

  async function selectSession(id: string) {
    if (streaming.value.isStreaming) cancelStream()
    currentSessionId.value = id
    messagesLoading.value = true
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${sessionsUrl()}/${id}/messages`, { headers })
      if (!res.ok) throw new Error(`${res.status}`)
      messages.value = await res.json()

      // Set model picker to the last model used in this session
      const lastAssistant = [...messages.value].reverse().find(m => m.role === 'assistant' && m.metadata?.model)
      if (lastAssistant?.metadata?.model) {
        const modelExists = availableModels.value.some(m => m.id === lastAssistant.metadata!.model)
        if (modelExists) selectedModelId.value = lastAssistant.metadata!.model
      }

      // Reconnect to active generation if any message is still generating
      const generating = messages.value.find(m => m.status === 'generating')
      if (generating) {
        reconnectToStream(id, generating.id)
      }
    } catch (e: any) {
      console.error('[useChat] selectSession error:', e)
      messages.value = []
    } finally {
      messagesLoading.value = false
    }
  }

  async function reconnectToStream(sessionId: string, assistantMsgId: string) {
    streaming.value = { blocks: [], currentToolId: null, isStreaming: true }
    sendingMessage.value = true
    abortController = new AbortController()

    try {
      const headers = await getAuthHeaders()
      const base = sessionsUrl()
      const res = await fetch(`${base}/${sessionId}/stream`, {
        headers, signal: abortController.signal
      })
      if (!res.ok) {
        const msgRes = await fetch(`${base}/${sessionId}/messages`, { headers })
        if (msgRes.ok) messages.value = await msgRes.json()
        return
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        const msgRes = await fetch(`${base}/${sessionId}/messages`, { headers })
        if (msgRes.ok) messages.value = await msgRes.json()
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)
            if (currentSessionId.value !== sessionId) break

            processStreamEvent(event, sessionId, assistantMsgId)
          } catch { /* ignore malformed */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('[useChat] reconnectToStream error:', e)
      }
    } finally {
      streaming.value.isStreaming = false
      sendingMessage.value = false
      abortController = null
      // Refresh messages from DB to get final state
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`${sessionsUrl()}/${sessionId}/messages`, { headers })
        if (res.ok && currentSessionId.value === sessionId) {
          messages.value = await res.json()
        }
      } catch { /* ignore */ }
    }
  }

  function cancelStream() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    streaming.value.isStreaming = false
    sendingMessage.value = false

    if (currentSessionId.value) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch(`${sessionsUrl()}/${currentSessionId.value}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          }).catch(() => {})
        }
      })
    }
  }

  let activeAssistantMsgId: string | null = null
  let activeUserMsgId: string | null = null
  let pendingAssistantFiles: ChatFile[] = []

  function processStreamEvent(event: any, sessionId: string, assistantMsgId?: string) {
    switch (event.type) {
      case 'user_message_id': {
        activeUserMsgId = event.id
        const pending = messages.value.find(m => m.id?.startsWith('pending_'))
        if (pending) pending.id = event.id
        break
      }

      case 'files_uploaded': {
        const userMsg = activeUserMsgId
          ? messages.value.find(m => m.id === activeUserMsgId)
          : null
        if (userMsg) userMsg.files = event.files
        break
      }

      case 'files_created':
        pendingAssistantFiles.push(...event.files)
        break

      case 'assistant_message_id':
        activeAssistantMsgId = event.id
        break

      case 'text': {
        const blocks = streaming.value.blocks
        const last = blocks[blocks.length - 1]
        if (last && last.type === 'text') {
          last.text = (last.text || '') + event.content
        } else {
          blocks.push({ type: 'text', text: event.content })
        }
        break
      }

      case 'thinking': {
        const blocks = streaming.value.blocks
        const last = blocks[blocks.length - 1]
        if (last && last.type === 'thinking') {
          last.text = (last.text || '') + event.content
        } else {
          blocks.push({ type: 'thinking', text: event.content })
        }
        break
      }

      case 'tool_call':
        streaming.value.currentToolId = event.id
        streaming.value.blocks.push({
          type: 'tool_call',
          id: event.id,
          code: event.code,
        })
        break

      case 'tool_result': {
        const tc = streaming.value.blocks.find(
          b => b.type === 'tool_call' && b.id === event.id
        )
        if (tc) {
          if (event.result !== undefined) tc.result = event.result
          if (event.error !== undefined) tc.error = event.error
        }
        streaming.value.currentToolId = null
        break
      }

      case 'title': {
        const s = sessions.value.find(s => s.id === sessionId)
        if (s) s.title = event.title
        break
      }

      case 'done': {
        const msgId = activeAssistantMsgId || assistantMsgId || crypto.randomUUID()
        const status = event.status || 'complete'
        const meta = { ...(event.metadata || {}) }
        if (event.error) meta.error = event.error
        const assistantMsg: ChatMessage = {
          id: msgId,
          role: 'assistant',
          content: event.content || null,
          blocks: event.blocks || (streaming.value.blocks.length > 0 ? [...streaming.value.blocks] : null),
          metadata: meta,
          status,
          created_at: new Date().toISOString(),
          files: pendingAssistantFiles.length > 0 ? [...pendingAssistantFiles] : undefined,
        }
        pendingAssistantFiles = []
        streaming.value = { blocks: [], currentToolId: null, isStreaming: false }
        const existingIdx = messages.value.findIndex(m => m.id === msgId)
        if (existingIdx >= 0) {
          messages.value[existingIdx] = assistantMsg
        } else {
          messages.value.push(assistantMsg)
        }
        if (event.metadata?.model) {
          const modelExists = availableModels.value.some(m => m.id === event.metadata.model)
          if (modelExists) selectedModelId.value = event.metadata.model
        }
        activeAssistantMsgId = null
        activeUserMsgId = null
        break
      }
    }
  }

  async function uploadFiles(sessionId: string, messageId: string, files: File[]): Promise<ChatFile[]> {
    const uploaded: ChatFile[] = []
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession?.access_token) throw new Error('Not authenticated')

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer()
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuf)
      const hashArr = Array.from(new Uint8Array(hashBuf))
      const contentHash = hashArr.map(b => b.toString(16).padStart(2, '0')).join('')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('message_id', messageId)
      formData.append('content_hash', contentHash)

      const res = await fetch(`${sessionsUrl()}/${sessionId}/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authSession.access_token}` },
        body: formData,
      })
      if (res.ok) {
        uploaded.push(await res.json())
      } else {
        console.error(`[useChat] file upload failed: ${res.status}`, await res.text())
      }
    }
    return uploaded
  }

  async function sendMessage(content: string, modelOverride?: string, files?: File[]) {
    if (!currentSessionId.value) return
    cancelStream()

    const sessionId = currentSessionId.value
    const model = modelOverride || selectedModelId.value

    const userMsg: ChatMessage = {
      id: `pending_${crypto.randomUUID()}`,
      role: 'user',
      content,
      blocks: null,
      metadata: null,
      created_at: new Date().toISOString(),
      files: [],
    }
    messages.value.push(userMsg)

    streaming.value = { blocks: [], currentToolId: null, isStreaming: true }
    sendingMessage.value = true

    abortController = new AbortController()

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('content', content)
      if (model) formData.append('model', model)
      if (files?.length) {
        for (const f of files) formData.append('files', f)
      }

      const res = await fetch(`${sessionsUrl()}/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authSession.access_token}` },
        body: formData,
        signal: abortController.signal
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`${res.status}: ${text}`)
      }

      await _readSSEStream(res, sessionId)
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('[useChat] sendMessage error:', e)
      }
    } finally {
      streaming.value.isStreaming = false
      sendingMessage.value = false
      abortController = null

      const idx = sessions.value.findIndex(s => s.id === sessionId)
      if (idx > 0) {
        const [s] = sessions.value.splice(idx, 1)
        s.updated_at = new Date().toISOString()
        sessions.value.unshift(s)
      }
    }
  }

  async function deleteMessagesFrom(messageId: string) {
    if (!currentSessionId.value) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${sessionsUrl()}/${currentSessionId.value}/messages/from/${messageId}`, {
        method: 'DELETE', headers
      })
      if (!res.ok) {
        console.error(`[useChat] deleteMessagesFrom failed: ${res.status}`)
        return
      }
      const idx = messages.value.findIndex(m => m.id === messageId)
      if (idx >= 0) messages.value.splice(idx)
    } catch (e: any) {
      console.error('[useChat] deleteMessagesFrom error:', e)
    }
  }

  async function updateMessage(messageId: string, content: string) {
    if (!currentSessionId.value) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${sessionsUrl()}/${currentSessionId.value}/messages/${messageId}`, {
        method: 'PATCH', headers, body: JSON.stringify({ content })
      })
      if (!res.ok) {
        console.error(`[useChat] updateMessage failed: ${res.status}`)
        return
      }
      const msg = messages.value.find(m => m.id === messageId)
      if (msg) msg.content = content
    } catch (e: any) {
      console.error('[useChat] updateMessage error:', e)
    }
  }

  async function _readSSEStream(res: Response, sessionId: string) {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6)
        if (!jsonStr) continue
        try {
          const event = JSON.parse(jsonStr)
          if (currentSessionId.value !== sessionId) break
          processStreamEvent(event, sessionId)
        } catch { /* ignore malformed */ }
      }
    }
  }

  async function retryFromMessage(index: number, modelId?: string) {
    const msg = messages.value[index]
    if (!msg || !currentSessionId.value) return
    const userIndex = msg.role === 'user' ? index : index - 1
    const userMsg = messages.value[userIndex]
    if (!userMsg || userMsg.role !== 'user') return

    const assistantMsg = msg.role === 'assistant' ? msg : messages.value[index + 1]
    const resolvedModel = modelId || assistantMsg?.metadata?.model || undefined

    cancelStream()
    const sessionId = currentSessionId.value

    // Remove assistant messages after the user message locally
    const spliceFrom = userIndex + 1
    if (spliceFrom < messages.value.length) messages.value.splice(spliceFrom)

    streaming.value = { blocks: [], currentToolId: null, isStreaming: true }
    sendingMessage.value = true
    abortController = new AbortController()

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${sessionsUrl()}/${sessionId}/regenerate`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: userMsg.id, model: resolvedModel }),
        signal: abortController.signal,
      })
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      await _readSSEStream(res, sessionId)
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('[useChat] retryFromMessage error:', e)
    } finally {
      streaming.value.isStreaming = false
      sendingMessage.value = false
      abortController = null
    }
  }

  async function editAndResend(messageId: string, newContent: string) {
    if (!currentSessionId.value) return
    const idx = messages.value.findIndex(m => m.id === messageId)
    if (idx < 0) return

    await updateMessage(messageId, newContent)
    // Update local content
    const msg = messages.value[idx]
    if (msg) msg.content = newContent

    cancelStream()
    const sessionId = currentSessionId.value

    // Remove everything after the edited user message locally
    if (idx + 1 < messages.value.length) messages.value.splice(idx + 1)

    streaming.value = { blocks: [], currentToolId: null, isStreaming: true }
    sendingMessage.value = true
    abortController = new AbortController()

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${sessionsUrl()}/${sessionId}/regenerate`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId }),
        signal: abortController.signal,
      })
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      await _readSSEStream(res, sessionId)
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('[useChat] editAndResend error:', e)
    } finally {
      streaming.value.isStreaming = false
      sendingMessage.value = false
      abortController = null
    }
  }

  return {
    mode,
    sessions,
    currentSessionId,
    currentSession,
    messages,
    streaming,
    sessionsLoading,
    messagesLoading,
    sendingMessage,
    sessionUsage,
    availableModels,
    selectedModelId,
    selectedModel,
    switchMode,
    fetchModels,
    fetchSessions,
    createSession,
    deleteSession,
    renameSession,
    selectSession,
    sendMessage,
    cancelStream,
    deleteMessagesFrom,
    updateMessage,
    retryFromMessage,
    editAndResend,
  }
}
