<template>
  <SectionCard
    title="Appearance"
    description="Customize the visual appearance of items in the dashboard."
  >
    <div class="appearance-section">
      <h4>Email Color</h4>
      <p class="section-hint">Color for email type badges, link buttons, and color bars.</p>
      <ColorPickerField
        :model-value="emailColor"
        badge-label="EMAIL"
        icon-class="pi pi-envelope"
        @update:model-value="updateEmailColor"
      />
    </div>

    <div class="appearance-section">
      <h4>Craft Document Color</h4>
      <p class="section-hint">Color for Craft document badges, link buttons, and color bars.</p>
      <ColorPickerField
        :model-value="craftColor"
        badge-label="CRAFT"
        icon-class="pi pi-file-edit"
        @update:model-value="updateCraftColor"
      />
    </div>

    <div class="appearance-section">
      <h4>File Color</h4>
      <p class="section-hint">Color for file type badges, link buttons, and color bars.</p>
      <ColorPickerField
        :model-value="fileColor"
        badge-label="FILE"
        icon-class="pi pi-file"
        @update:model-value="updateFileColor"
      />
    </div>

    <div class="appearance-section">
      <h4>Person Color</h4>
      <p class="section-hint">Color for person type badges and link buttons in the People view.</p>
      <ColorPickerField
        :model-value="personColor"
        badge-label="PERSON"
        icon-class="pi pi-user"
        @update:model-value="updatePersonColor"
      />
    </div>

    <div class="appearance-section">
      <h4>Project Color</h4>
      <p class="section-hint">Color for project type badges and link buttons in the Projects view.</p>
      <ColorPickerField
        :model-value="projectColor"
        badge-label="PROJECT"
        icon-class="pi pi-folder"
        @update:model-value="updateProjectColor"
      />
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { SectionCard, ColorPickerField } from '@/components/common'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'

const {
  emailColor, craftColor, fileColor, personColor, projectColor,
  initialize,
  updateEmailColor, updateCraftColor, updateFileColor, updatePersonColor, updateProjectColor
} = useAppearanceSettings()

onMounted(() => initialize())
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
