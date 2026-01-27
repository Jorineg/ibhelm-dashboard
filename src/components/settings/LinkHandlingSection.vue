<template>
  <SectionCard
    title="Link Handling"
    description="Choose how external links to Craft and Missive are opened."
  >
    <div class="link-section">
      <h4>Craft Documents</h4>
      <p class="section-hint">
        Open Craft document links in the web browser instead of the native app.
      </p>
      <div class="checkbox-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="localOpenCraftInBrowser"
            @change="handleSaveCraft"
          />
          <span class="checkbox-text">Open in browser</span>
        </label>
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>

    <div class="link-section">
      <h4>Missive Conversations</h4>
      <p class="section-hint">
        Open Missive conversation links in the web browser instead of the native app.
      </p>
      <div class="checkbox-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="localOpenMissiveInBrowser"
            @change="handleSaveMissive"
          />
          <span class="checkbox-text">Open in browser</span>
        </label>
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { SectionCard } from '@/components/common'
import { useUserSettings } from '@/composables/useUserSettings'

const {
  openCraftInBrowser,
  openMissiveInBrowser,
  saving,
  updateOpenCraftInBrowser,
  updateOpenMissiveInBrowser
} = useUserSettings()

const localOpenCraftInBrowser = ref(false)
const localOpenMissiveInBrowser = ref(false)

const handleSaveCraft = () => {
  updateOpenCraftInBrowser(localOpenCraftInBrowser.value)
}

const handleSaveMissive = () => {
  updateOpenMissiveInBrowser(localOpenMissiveInBrowser.value)
}

watch(openCraftInBrowser, (val) => { localOpenCraftInBrowser.value = val }, { immediate: true })
watch(openMissiveInBrowser, (val) => { localOpenMissiveInBrowser.value = val }, { immediate: true })
</script>

<style scoped>
.link-section {
  margin-bottom: 2rem;
}

.link-section:last-child {
  margin-bottom: 0;
}

.link-section h4 {
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

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--accent-primary);
  cursor: pointer;
}

.checkbox-text {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.saving-indicator {
  color: var(--accent-primary);
  font-size: 1rem;
}
</style>
