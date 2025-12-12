/**
 * Global auto-select for all text inputs on focus
 * Works automatically for all current and future inputs without any markup
 */
export function setupGlobalSelectOnFocus() {
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement
    if (
      target instanceof HTMLInputElement && 
      (target.type === 'text' || target.type === 'search' || target.type === 'url' || target.type === 'email' || target.type === 'number')
    ) {
      target.select()
    } else if (target instanceof HTMLTextAreaElement) {
      target.select()
    }
  })
}
