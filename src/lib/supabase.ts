import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// RPC calls to ignore in logging
const IGNORED_RPC = ['get_sync_status']

// Request ID counter and current context for correlating logs
let requestIdCounter = 0
let currentRequestId: number | null = null
export const getNextRequestId = () => ++requestIdCounter
export const setCurrentRequestId = (id: number | null) => { currentRequestId = id }

// Logging fetch wrapper
const loggingFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method || 'GET'
  const body = init?.body ? JSON.parse(init.body as string) : null
  
  // Extract endpoint path (remove base URL)
  const path = url.replace(supabaseUrl, '')
  
  // Check if this is an ignored RPC
  const rpcName = path.includes('/rpc/') ? path.split('/rpc/')[1]?.split('?')[0] : null
  if (rpcName && IGNORED_RPC.includes(rpcName)) {
    return fetch(input, init)
  }
  
  // Capture request ID at start
  const reqId = currentRequestId
  
  // Build query description
  let queryDesc = `${method} ${path}`
  if (body && rpcName) {
    const params = Object.entries(body)
      .filter(([_, v]) => v !== null)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ')
    queryDesc = `RPC ${rpcName}(${params})`
  } else if (path.includes('/rest/v1/')) {
    const table = path.split('/rest/v1/')[1]?.split('?')[0]
    queryDesc = `${method} ${table}`
  }
  
  const start = performance.now()
  const response = await fetch(input, init)
  const networkTime = performance.now() - start
  
  // Clone and parse to measure JSON parsing time (doesn't affect original response)
  const cloned = response.clone()
  const parseStart = performance.now()
  await cloned.json().catch(() => {}) // Ignore parse errors
  const parseTime = performance.now() - parseStart
  const totalTime = performance.now() - start
  
  const prefix = reqId ? `[DB] #${reqId}` : '[DB]'
  if (parseTime > 20) {
    console.log(`${prefix} ${queryDesc} — net:${networkTime.toFixed(0)}ms parse:${parseTime.toFixed(0)}ms total:${totalTime.toFixed(0)}ms`)
  } else {
    console.log(`${prefix} ${queryDesc} — ${totalTime.toFixed(0)}ms`)
  }
  return response
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: loggingFetch }
})

