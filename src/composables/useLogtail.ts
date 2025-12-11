import { Logtail } from '@logtail/browser'

const token = import.meta.env.VITE_LOGTAIL_TOKEN
const endpoint = import.meta.env.VITE_LOGTAIL_ENDPOINT

// Only initialize if token is provided (production)
export const logtail = token ? new Logtail(token, { endpoint }) : null

// Serialize error objects properly
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  if (typeof err === 'object' && err !== null) {
    return { ...err as object }
  }
  return { value: String(err) }
}

// Log error to BetterStack (use this in catch blocks)
export function logError(message: string, context?: Record<string, unknown>) {
  if (!logtail) return
  logtail.error(message, context)
}

export function initErrorLogging() {
  if (!logtail) return

  // Intercept console.error - captures ALL console.error calls
  const originalError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    originalError(...args)
    const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(serializeError(a))).join(' ')
    logtail.error('console.error', { message, args: args.map(serializeError) })
  }

  // Intercept console.warn for warnings
  const originalWarn = console.warn.bind(console)
  console.warn = (...args: unknown[]) => {
    originalWarn(...args)
    const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(serializeError(a))).join(' ')
    logtail.warn('console.warn', { message })
  }

  // Catch uncaught errors
  window.onerror = (message, source, lineno, colno, error) => {
    logtail.error('Uncaught error', { message, source, lineno, colno, error: serializeError(error) })
  }

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logtail.error('Unhandled promise rejection', { reason: serializeError(event.reason) })
  })

  logtail.info('Frontend initialized', { url: window.location.href, userAgent: navigator.userAgent })
}

