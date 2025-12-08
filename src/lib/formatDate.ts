const dateOptions: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}

export const formatDateDE = (dateStr: string) =>
  new Date(dateStr).toLocaleString('de-DE', dateOptions)

export const formatDateUS = (dateStr: string) =>
  new Date(dateStr).toLocaleString('en-US', { ...dateOptions, hour12: false })

// Default export for backwards compatibility
export const formatDate = formatDateDE
