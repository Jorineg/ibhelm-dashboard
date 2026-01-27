<template>
  <a
    v-if="isVisible"
    :href="url"
    :target="linkTarget"
    rel="noopener noreferrer"
    class="type-link-button"
    :style="buttonStyle"
    :title="tooltip"
    @click="handleClick"
  >
    <i :class="iconClass"></i>
    {{ label }}
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { useLinkTransform } from '@/composables/useLinkTransform'
import { supabase } from '@/lib/supabase'
import type { ViewDataItem, DataItem, PersonItem, ProjectItem } from '@/types'

type ItemType = 'item' | 'person' | 'project'

interface Props {
  item: ViewDataItem
  itemType: ItemType
}

const props = defineProps<Props>()

const { emailColor, craftColor, fileColor, personColor, projectColor, teamworkBaseUrl, filesBucket } = useAppearanceSettings()
const { transformCraftUrl, transformMissiveUrl } = useLinkTransform()

const isFile = computed(() => {
  if (props.itemType !== 'item') return false
  return (props.item as DataItem).type?.toLowerCase() === 'file'
})

const isVisible = computed(() => {
  if (isFile.value) return !!(props.item as DataItem).storage_path
  return url.value && url.value !== '#'
})

const url = computed(() => {
  if (props.itemType === 'person') {
    const email = (props.item as PersonItem).primary_email
    return email ? `mailto:${email}` : '#'
  }
  if (props.itemType === 'project') {
    const baseUrl = teamworkBaseUrl.value
    const projectId = props.item.id
    return baseUrl && projectId ? `${baseUrl.replace(/\/$/, '')}/app/projects/${projectId}` : '#'
  }
  // Items
  const item = props.item as DataItem
  if (item.type?.toLowerCase() === 'file') return '#' // handled via click
  if (item.teamwork_url) return item.teamwork_url
  if (item.missive_url) return transformMissiveUrl(item.missive_url)
  if (item.craft_url) return transformCraftUrl(item.craft_url)
  return '#'
})

const linkTarget = computed(() => {
  return props.itemType === 'person' ? '_self' : '_blank'
})

const label = computed(() => {
  if (props.itemType === 'person') {
    const person = props.item as PersonItem
    if (person.is_company) return 'COMPANY'
    return 'PERSON'
  }
  if (props.itemType === 'project') return 'PROJECT'
  // Items
  const item = props.item as DataItem
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'EMAIL'
  if (itemType === 'craft') return 'CRAFT'
  if (itemType === 'file') return 'FILE'
  return item.task_type_name?.toUpperCase() || 'TASK'
})

const iconClass = computed(() => {
  if (props.itemType === 'person') {
    const person = props.item as PersonItem
    return person.is_company ? 'pi pi-building' : 'pi pi-user'
  }
  if (props.itemType === 'project') return 'pi pi-folder'
  // Items
  const item = props.item as DataItem
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'pi pi-envelope'
  if (itemType === 'craft') return 'pi pi-file-edit'
  if (itemType === 'file') return 'pi pi-file'
  return 'pi pi-check-square'
})

const buttonStyle = computed(() => {
  let color: string
  if (props.itemType === 'person') {
    color = personColor.value
  } else if (props.itemType === 'project') {
    color = projectColor.value
  } else {
    const item = props.item as DataItem
    const itemType = item.type?.toLowerCase()
    const isEmail = itemType === 'email'
    const isCraft = itemType === 'craft'
    const isFileType = itemType === 'file'
    color = isEmail ? emailColor.value : isCraft ? craftColor.value : isFileType ? fileColor.value : (item.task_type_color || '#4ade80')
  }
  return {
    background: `${color}20`,
    color: color,
    borderColor: `${color}40`
  }
})

const tooltip = computed(() => {
  if (props.itemType === 'person') {
    const email = (props.item as PersonItem).primary_email
    return email ? `Send email to ${email}` : 'No email available'
  }
  if (props.itemType === 'project') {
    return teamworkBaseUrl.value ? 'Open in Teamwork' : 'Set Teamwork Base URL in Settings'
  }
  const item = props.item as DataItem
  const itemType = item.type?.toLowerCase()
  if (itemType === 'email') return 'Open in Missive'
  if (itemType === 'craft') return 'Open in Craft'
  if (itemType === 'file') return 'Open file'
  return 'Open in Teamwork'
})

const handleClick = async (event: MouseEvent) => {
  event.stopPropagation()
  
  if (!isFile.value) return // let default link behavior happen
  
  event.preventDefault()
  const item = props.item as DataItem
  if (!item.storage_path) return
  
  const { data, error } = await supabase.storage
    .from(filesBucket.value)
    .createSignedUrl(item.storage_path, 300)
  
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
.type-link-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: 1px solid;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.type-link-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.15);
}

.type-link-button i {
  font-size: 1rem;
}
</style>

