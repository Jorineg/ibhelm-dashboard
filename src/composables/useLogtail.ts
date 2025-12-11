import { Logtail } from '@logtail/browser'

const token = import.meta.env.VITE_LOGTAIL_TOKEN
const endpoint = import.meta.env.VITE_LOGTAIL_ENDPOINT

// Only initialize if token is provided (production)
export const logtail = token ? new Logtail(token, { endpoint }) : null

export async function initErrorLogging() {
  console.log('[Logtail] token present:', !!token, 'endpoint:', endpoint)

  if (!logtail) return

  window.onerror = (message, source, lineno, colno, error) => {
    logtail.error('Unhandled error', { message, source, lineno, colno, error })
  }

  window.addEventListener('unhandledrejection', (event) => {
    logtail.error('Unhandled promise rejection', { reason: String(event.reason) })
  })

  // Test log with explicit flush to verify connection
  logtail.info('Frontend initialized', { url: window.location.href })
  try {
    await logtail.flush()
    console.log('[Logtail] Flush successful - logs should appear in BetterStack')
  } catch (e) {
    console.error('[Logtail] Flush failed:', e)
  }
}

