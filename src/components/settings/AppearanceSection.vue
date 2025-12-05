<template>
  <SectionCard
    title="Appearance"
    description="Customize the visual appearance of items in the dashboard."
  >
    <div class="appearance-section">
      <h4>Email Color</h4>
      <p class="section-hint">Color for email type badges, link buttons, and color bars.</p>
      <ColorPickerField
        ref="emailPicker"
        :model-value="emailColor"
        badge-label="EMAIL"
        icon-class="pi pi-envelope"
        :saving="saving"
        @update:model-value="updateEmailColor"
      />
    </div>

    <div class="appearance-section">
      <h4>Craft Document Color</h4>
      <p class="section-hint">Color for Craft document badges, link buttons, and color bars.</p>
      <ColorPickerField
        ref="craftPicker"
        :model-value="craftColor"
        badge-label="CRAFT"
        icon-class="pi pi-file-edit"
        :saving="saving"
        @update:model-value="updateCraftColor"
      />
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { SectionCard, ColorPickerField } from '@/components/common'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'

const { emailColor, craftColor, saving, initialize, updateEmailColor, updateCraftColor } = useAppearanceSettings()

const emailPicker = ref<InstanceType<typeof ColorPickerField> | null>(null)
const craftPicker = ref<InstanceType<typeof ColorPickerField> | null>(null)

const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.color-setting')) {
    emailPicker.value?.closePicker()
    craftPicker.value?.closePicker()
  }
}

onMounted(async () => {
  await initialize()
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
.appearance-section {
  margin-bottom: 2rem;
}

.appearance-section:last-child {
  margin-bottom: 0;
}

.appearance-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.section-hint {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin: 0 0 1.25rem 0;
}
</style>
