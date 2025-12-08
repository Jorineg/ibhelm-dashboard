const pad = (n: number) => n.toString().padStart(2, '0')

// Fixed format: dd.mm.yy, hh:mm:ss (independent of locale)
export const formatDateTime = (date: Date | string | null): string => {
  if (!date) return '--.--.-- --:--:--'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--.--.-- --:--:--'
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear() % 100)}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
