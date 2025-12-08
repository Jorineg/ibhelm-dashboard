<template>
  <SectionCard
    title="General"
    description="General application settings."
  >
    <div class="general-section">
      <h4>Craft Space ID</h4>
      <p class="section-hint">
        Space ID for Craft document links. Find it in Craft app settings or from a document URL.
      </p>
      <div class="input-row">
        <input
          v-model="localSpaceId"
          type="text"
          class="text-input"
          placeholder="e.g. abc123-def456-..."
          @blur="handleSave"
          @keyup.enter="handleSave"
        />
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { SectionCard } from '@/components/common'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'

const { craftSpaceId, saving, initialize, updateCraftSpaceId } = useAppearanceSettings()

const localSpaceId = ref('')

const handleSave = async () => {
  if (localSpaceId.value !== craftSpaceId.value) {
    await updateCraftSpaceId(localSpaceId.value)
  }
}

watch(craftSpaceId, (newValue) => {
  localSpaceId.value = newValue
}, { immediate: true })

onMounted(async () => {
  await initialize()
  localSpaceId.value = craftSpaceId.value
})
</script>

<style scoped>
.general-section {
  margin-bottom: 2rem;
}

.general-section:last-child {
  margin-bottom: 0;
}

.general-section h4 {
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

.input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.text-input {
  flex: 1;
  max-width: 400px;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: 'JetBrains Mono', monospace;
  transition: border-color 0.15s ease;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.text-input::placeholder {
  color: var(--text-tertiary);
}

.saving-indicator {
  color: var(--accent-primary);
  font-size: 1rem;
}
</style>

