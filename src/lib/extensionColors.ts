// Extension colors based on file type category
const extensionColors: Record<string, string> = {
  // Documents
  pdf: '#e53935',
  doc: '#1976d2', docx: '#1976d2',
  xls: '#2e7d32', xlsx: '#2e7d32', csv: '#2e7d32',
  ppt: '#d84315', pptx: '#d84315',
  txt: '#78909c', md: '#78909c', rtf: '#78909c',
  // Images
  jpg: '#9c27b0', jpeg: '#9c27b0', png: '#9c27b0', 
  gif: '#9c27b0', webp: '#9c27b0', svg: '#9c27b0',
  psd: '#00bcd4', ai: '#ff9800',
  // Video/Audio
  mp4: '#ff5722', mov: '#ff5722', avi: '#ff5722', mkv: '#ff5722',
  mp3: '#e91e63', wav: '#e91e63', flac: '#e91e63',
  // Archives
  zip: '#ffc107', rar: '#ffc107', '7z': '#ffc107', tar: '#ffc107', gz: '#ffc107',
  // Code
  js: '#ffca28', ts: '#1976d2', vue: '#42b883', 
  py: '#3776ab', html: '#e44d26', css: '#264de4',
  json: '#78909c', xml: '#78909c',
  // CAD/Technical
  dwg: '#c62828', dxf: '#c62828', ifc: '#0d47a1', rvt: '#0d47a1',
}

export function getExtensionStyle(ext: string | null | undefined): { backgroundColor?: string; color?: string; borderColor?: string } {
  const normalizedExt = ext?.toLowerCase() || ''
  if (!normalizedExt) return {}
  const color = extensionColors[normalizedExt] || '#607d8b'
  return { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
}

