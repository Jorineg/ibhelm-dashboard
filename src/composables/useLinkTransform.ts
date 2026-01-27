import { computed } from 'vue'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { useUserSettings } from '@/composables/useUserSettings'

export function useLinkTransform() {
  const { craftSpaceId } = useAppearanceSettings()
  const { openCraftInBrowser, openMissiveInBrowser } = useUserSettings()

  // Transform craft URL based on user preference
  const transformCraftUrl = (url: string): string => {
    if (!url || !craftSpaceId.value) return url
    const blockIdMatch = url.match(/blockId=([^&]+)/)
    if (!blockIdMatch) return url
    
    const blockId = blockIdMatch[1]
    
    if (openCraftInBrowser.value) {
      // Web browser URL: https://docs.craft.do/editor/d/<spaceId>/<blockId>
      return `https://docs.craft.do/editor/d/${craftSpaceId.value}/${blockId}`
    }
    
    // Native app URL: craftdocs://open?spaceId=<spaceId>&blockId=<blockId>
    return `craftdocs://open?spaceId=${craftSpaceId.value}&blockId=${blockIdMatch[1]}`
  }

  // Transform missive URL based on user preference
  const transformMissiveUrl = (url: string): string => {
    if (!url) return url
    
    if (openMissiveInBrowser.value) {
      // Strip missive:// prefix for browser: mail.missiveapp.com/...
      return url.replace(/^missive:\/\//, 'https://')
    }
    
    // Keep as-is for native app
    return url
  }

  return {
    transformCraftUrl,
    transformMissiveUrl,
    openCraftInBrowser: computed(() => openCraftInBrowser.value),
    openMissiveInBrowser: computed(() => openMissiveInBrowser.value)
  }
}
