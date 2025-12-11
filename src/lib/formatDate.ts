const pad = (n: number) => n.toString().padStart(2, '0')

// Fixed format: dd.mm.yy, hh:mm:ss (independent of locale)
export const formatDateTime = (date: Date | string | null): string => {
  if (!date) return '--.--.-- --:--:--'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--.--.-- --:--:--'
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear() % 100)}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Relative time: "x seconds/minutes/hours/days ago"
export const formatRelativeTime = (date: Date | string | null): string => {
  if (!date) return '--'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--'
  
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

// Fixed format: mm/dd/yy, hh:mm:ss (US style)
export const formatDateTimeUS = (date: Date | string | null): string => {
  if (!date) return '--/--/-- --:--:--'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--/--/-- --:--:--'
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${pad(d.getFullYear() % 100)}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Backwards compatibility
export const formatDate = (dateStr: string) => formatDateTime(dateStr)
