<template>
  <a
    v-if="displayExtension"
    href="#"
    class="extension-badge"
    :class="{ large }"
    :style="extensionStyle"
    :title="'Open file'"
    @click="handleClick"
  >
    {{ displayExtension }}
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getExtensionStyle } from '@/lib/extensionColors'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { supabase } from '@/lib/supabase'

interface Props {
  extension?: string | null
  storagePath?: string | null
  large?: boolean
}

const props = defineProps<Props>()

const { filesBucket } = useAppearanceSettings()

const displayExtension = computed(() => {
  const ext = props.extension?.toUpperCase() || ''
  return ext.length > 5 ? ext.slice(0, 4) + '…' : ext
})

const extensionStyle = computed(() => getExtensionStyle(props.extension))

const handleClick = async (event: MouseEvent) => {
  event.stopPropagation()
  event.preventDefault()
  
  if (!props.storagePath) return
  
  const { data, error } = await supabase.storage
    .from(filesBucket.value)
    .createSignedUrl(props.storagePath, 300)
  
  if (error) {
    console.error('Error generating signed URL:', error)
    return
  }
  
  if (data?.signedUrl) {
    window.open(data.signedUrl, '_blank')
  }
}
</script>

<style scoped>
/* Default: matches .gallery-type-badge-link in DataTable.vue */
.extension-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.extension-badge:hover {
  transform: scale(1.08);
  filter: brightness(1.15);
}

/* Large: matches .type-link-button in TypeLinkButton.vue */
.extension-badge.large {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
}

.extension-badge.large:hover {
  transform: translateY(-1px);
}
</style>
