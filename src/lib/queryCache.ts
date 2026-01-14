// LRU Query Cache with in-memory storage and lazy localStorage persistence
// Reads are instant (Map lookup), writes persist asynchronously with LZ compression

import { compressToUTF16, decompressFromUTF16 } from 'lz-string'

const CACHE_KEY = 'ibhelm_query_cache_v2' // v2: compressed
const MAX_ENTRIES = 100
const PERSIST_DEBOUNCE_MS = 1000

export interface CachedQuery<T = unknown> {
  key: string
  data: T
  count: number | null
  timestamp: number
}

// In-memory cache (Map preserves insertion order for LRU)
const cache = new Map<string, CachedQuery>()
let persistTimeout: ReturnType<typeof setTimeout> | null = null
let initialized = false

// Load cache from localStorage once on first access
function ensureInitialized(): void {
  if (initialized) return
  initialized = true
  
  // Clean up old uncompressed cache
  localStorage.removeItem('ibhelm_query_cache_v1')
  
  try {
    const compressed = localStorage.getItem(CACHE_KEY)
    if (compressed) {
      const raw = decompressFromUTF16(compressed)
      if (raw) {
        const parsed = JSON.parse(raw)
        const entries: CachedQuery[] = parsed.entries || []
        for (const entry of entries) {
          cache.set(entry.key, entry)
        }
        console.log(`[CACHE] Loaded ${cache.size} cached queries from storage (compressed)`)
      }
    }
  } catch (e) {
    console.warn('[CACHE] Failed to load from storage:', e)
  }
}

// Debounced persistence to localStorage with compression
function schedulePersist(): void {
  if (persistTimeout) clearTimeout(persistTimeout)
  persistTimeout = setTimeout(() => {
    persistTimeout = null
    try {
      const entries = Array.from(cache.values())
      const json = JSON.stringify({ entries })
      const compressed = compressToUTF16(json)
      localStorage.setItem(CACHE_KEY, compressed)
    } catch (e) {
      console.warn('[CACHE] Persist failed:', e)
    }
  }, PERSIST_DEBOUNCE_MS)
}

// Generate cache key from query params
export function generateQueryKey(params: Record<string, unknown>): string {
  const sorted = Object.keys(params).sort().reduce((acc, key) => {
    const val = params[key]
    if (val !== null && val !== undefined) acc[key] = val
    return acc
  }, {} as Record<string, unknown>)
  return JSON.stringify(sorted)
}

export function getCachedQuery<T>(key: string): CachedQuery<T> | null {
  ensureInitialized()
  
  const entry = cache.get(key)
  if (!entry) return null
  
  // Move to end for LRU (delete and re-add)
  cache.delete(key)
  cache.set(key, entry)
  
  // Don't persist on reads - too frequent, LRU order will be saved on next write
  return entry as CachedQuery<T>
}

export function setCachedQuery<T>(key: string, data: T, count: number | null): void {
  ensureInitialized()
  
  // Remove existing entry if present
  cache.delete(key)
  
  // Add new entry
  cache.set(key, {
    key,
    data,
    count,
    timestamp: Date.now()
  })
  
  // Evict oldest entries if over limit (Map iteration is in insertion order)
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  
  // Schedule async persistence
  schedulePersist()
}

export function clearQueryCache(): void {
  cache.clear()
  if (persistTimeout) {
    clearTimeout(persistTimeout)
    persistTimeout = null
  }
  localStorage.removeItem(CACHE_KEY)
}

// Format timestamp as relative time
export function formatCacheAge(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
