<template>
  <SectionCard
    title="General"
    description="General application settings."
  >
    <div class="general-section">
      <h4>Cost Group Prefixes</h4>
      <p class="section-hint">
        Tag prefixes used for cost group extraction. Tags matching the pattern "PREFIX CODE NAME" 
        (e.g., "KGR 456 Demo Kostengruppe") will be auto-linked to cost groups.
      </p>
      <div class="prefixes-container">
        <div class="prefix-tags">
          <span 
            v-for="(prefix, index) in localPrefixes" 
            :key="index"
            class="prefix-tag"
          >
            {{ prefix }}
            <button type="button" class="prefix-remove" @click="removePrefix(index)">
              <i class="pi pi-times"></i>
            </button>
          </span>
        </div>
        <div class="prefix-input-row">
          <input
            v-model="newPrefix"
            type="text"
            class="text-input prefix-input"
            placeholder="Add prefix..."
            @keyup.enter="addPrefix"
          />
          <button type="button" class="add-prefix-btn" @click="addPrefix" :disabled="!newPrefix.trim()">
            <i class="pi pi-plus"></i>
          </button>
        </div>
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>

    <div class="general-section">
      <h4>Location Prefix</h4>
      <p class="section-hint">
        Tag prefix used for location extraction. Tags matching patterns like "O-Gebäude-Raum", "O-Raum", 
        or "O-Gebäude-Level-Raum" will be auto-linked to locations.
      </p>
      <div class="input-row">
        <input
          v-model="localLocationPrefix"
          type="text"
          class="text-input prefix-input-single"
          placeholder="O-"
          @blur="handleSaveLocationPrefix"
          @keyup.enter="handleSaveLocationPrefix"
        />
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>

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
          @blur="handleSaveSpaceId"
          @keyup.enter="handleSaveSpaceId"
        />
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>

    <div class="general-section">
      <h4>Teamwork Base URL</h4>
      <p class="section-hint">
        Base URL for Teamwork project links (e.g., https://yourcompany.teamwork.com).
      </p>
      <div class="input-row">
        <input
          v-model="localTeamworkUrl"
          type="text"
          class="text-input"
          placeholder="https://yourcompany.teamwork.com"
          @blur="handleSaveTeamworkUrl"
          @keyup.enter="handleSaveTeamworkUrl"
        />
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>

    <div class="general-section">
      <h4>Hide Completed Tasks</h4>
      <p class="section-hint">
        When enabled, tasks with status "completed" will be hidden from the Items view by default.
      </p>
      <div class="checkbox-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="localHideCompletedTasks"
            @change="handleSaveHideCompletedTasks"
          />
          <span class="checkbox-text">Hide completed tasks</span>
        </label>
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

const { 
  craftSpaceId, 
  teamworkBaseUrl, 
  costGroupPrefixes,
  locationPrefix,
  hideCompletedTasks,
  saving, 
  initialize, 
  updateCraftSpaceId, 
  updateTeamworkBaseUrl,
  updateCostGroupPrefixes,
  updateLocationPrefix,
  updateHideCompletedTasks
} = useAppearanceSettings()

const localSpaceId = ref('')
const localTeamworkUrl = ref('')
const localPrefixes = ref<string[]>([])
const localLocationPrefix = ref('')
const localHideCompletedTasks = ref(false)
const newPrefix = ref('')

const handleSaveSpaceId = async () => {
  if (localSpaceId.value !== craftSpaceId.value) {
    await updateCraftSpaceId(localSpaceId.value)
  }
}

const handleSaveTeamworkUrl = async () => {
  if (localTeamworkUrl.value !== teamworkBaseUrl.value) {
    await updateTeamworkBaseUrl(localTeamworkUrl.value)
  }
}

const handleSaveLocationPrefix = async () => {
  if (localLocationPrefix.value !== locationPrefix.value) {
    await updateLocationPrefix(localLocationPrefix.value)
  }
}

const handleSaveHideCompletedTasks = async () => {
  if (localHideCompletedTasks.value !== hideCompletedTasks.value) {
    await updateHideCompletedTasks(localHideCompletedTasks.value)
  }
}

const addPrefix = async () => {
  const prefix = newPrefix.value.trim().toUpperCase()
  if (prefix && !localPrefixes.value.includes(prefix)) {
    localPrefixes.value = [...localPrefixes.value, prefix]
    await updateCostGroupPrefixes(localPrefixes.value)
  }
  newPrefix.value = ''
}

const removePrefix = async (index: number) => {
  localPrefixes.value = localPrefixes.value.filter((_, i) => i !== index)
  await updateCostGroupPrefixes(localPrefixes.value)
}

watch(craftSpaceId, (newValue) => {
  localSpaceId.value = newValue
}, { immediate: true })

watch(teamworkBaseUrl, (newValue) => {
  localTeamworkUrl.value = newValue
}, { immediate: true })

watch(costGroupPrefixes, (newValue) => {
  localPrefixes.value = [...newValue]
}, { immediate: true })

watch(locationPrefix, (newValue) => {
  localLocationPrefix.value = newValue
}, { immediate: true })

watch(hideCompletedTasks, (newValue) => {
  localHideCompletedTasks.value = newValue
}, { immediate: true })

onMounted(async () => {
  await initialize()
  localSpaceId.value = craftSpaceId.value
  localTeamworkUrl.value = teamworkBaseUrl.value
  localPrefixes.value = [...costGroupPrefixes.value]
  localLocationPrefix.value = locationPrefix.value
  localHideCompletedTasks.value = hideCompletedTasks.value
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

/* Prefixes */
.prefixes-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prefix-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.prefix-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: var(--accent-primary-dark);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-md);
  color: var(--accent-primary);
  font-size: 0.85rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.prefix-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: none;
  color: var(--accent-primary);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.prefix-remove:hover {
  opacity: 1;
}

.prefix-remove i {
  font-size: 0.7rem;
}

.prefix-input-row {
  display: flex;
  gap: 0.5rem;
  max-width: 300px;
}

.prefix-input {
  flex: 1;
  max-width: none;
}

.prefix-input-single {
  max-width: 120px;
}

/* Checkbox */
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

.add-prefix-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-prefix-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-secondary);
}

.add-prefix-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

