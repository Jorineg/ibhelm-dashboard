import { Logtail } from '@logtail/browser'

const token = import.meta.env.VITE_LOGTAIL_TOKEN
const endpoint = import.meta.env.VITE_LOGTAIL_ENDPOINT

// Only initialize if token is provided (production)
export const logtail = token ? new Logtail(token, { endpoint }) : null

export function initErrorLogging() {
  if (!logtail) return

  window.onerror = (message, source, lineno, colno, error) => {
    logtail.error('Unhandled error', { message, source, lineno, colno, error })
  }

  window.addEventListener('unhandledrejection', (event) => {
    logtail.error('Unhandled promise rejection', { reason: String(event.reason) })
  })
}

