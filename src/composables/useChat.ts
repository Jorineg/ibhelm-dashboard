import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL || `${window.location.origin}/chat`

export interface ChatSession {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ToolCall {
  id: string
  code: string
  result?: string
  error?: string
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string | null
  tool_calls: ToolCall[] | null
  metadata: TokenUsage | null
  created_at: string
}

export interface StreamingState {
  text: string
  toolCalls: ToolCall[]
  currentToolId: string | null
  isStreaming: boolean
}

// Module-level state
const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const streaming = ref<StreamingState>({
  text: '',
  toolCalls: [],
  currentToolId: null,
  isStreaming: false,
})
const sessionsLoading = ref(false)
const messagesLoading = ref(false)
const sendingMessage = ref(false)

let abortController: AbortController | null = null

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

  async function fetchSessions() {
    sessionsLoading.value = true
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${CHAT_SERVICE_URL}/sessions`, { headers })
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
      const res = await fetch(`${CHAT_SERVICE_URL}/sessions`, {
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
      await fetch(`${CHAT_SERVICE_URL}/sessions/${id}`, { method: 'DELETE', headers })
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
      await fetch(`${CHAT_SERVICE_URL}/sessions/${id}`, {
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
    currentSessionId.value = id
    messagesLoading.value = true
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${CHAT_SERVICE_URL}/sessions/${id}/messages`, { headers })
      if (!res.ok) throw new Error(`${res.status}`)
      messages.value = await res.json()
    } catch (e: any) {
      console.error('[useChat] selectSession error:', e)
      messages.value = []
    } finally {
      messagesLoading.value = false
    }
  }

  function cancelStream() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    streaming.value.isStreaming = false
    sendingMessage.value = false
  }

  async function sendMessage(content: string) {
    if (!currentSessionId.value || sendingMessage.value) return

    const sessionId = currentSessionId.value

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      tool_calls: null,
      metadata: null,
      created_at: new Date().toISOString()
    }
    messages.value.push(userMsg)

    streaming.value = { text: '', toolCalls: [], currentToolId: null, isStreaming: true }
    sendingMessage.value = true

    abortController = new AbortController()

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${CHAT_SERVICE_URL}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
        signal: abortController.signal
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`${res.status}: ${text}`)
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

            switch (event.type) {
              case 'text':
                streaming.value.text += event.content
                break

              case 'tool_call':
                streaming.value.currentToolId = event.id
                streaming.value.toolCalls.push({
                  id: event.id,
                  code: event.code,
                })
                break

              case 'tool_result': {
                const tc = streaming.value.toolCalls.find(t => t.id === event.id)
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
                const assistantMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: event.content || streaming.value.text,
                  tool_calls: event.tool_calls || (streaming.value.toolCalls.length > 0 ? [...streaming.value.toolCalls] : null),
                  metadata: event.metadata || null,
                  created_at: new Date().toISOString()
                }
                streaming.value = { text: '', toolCalls: [], currentToolId: null, isStreaming: false }
                messages.value.push(assistantMsg)
                break
              }

              case 'error':
                console.error('[useChat] stream error:', event.message)
                break
            }
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
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

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    streaming,
    sessionsLoading,
    messagesLoading,
    sendingMessage,
    sessionUsage,
    fetchSessions,
    createSession,
    deleteSession,
    renameSession,
    selectSession,
    sendMessage,
    cancelStream,
  }
}
