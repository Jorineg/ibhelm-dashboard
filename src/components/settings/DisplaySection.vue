<template>
  <SectionCard
    title="Display"
    description="Personal display preferences for your account."
  >
    <div class="display-section">
      <h4>Default Items Sorting</h4>
      <p class="section-hint">
        Default sorting used for new "Items" view configurations.
      </p>
      <div class="input-row">
        <select
          v-model="localSortField"
          class="select-input"
          @change="handleSaveDefaultSort"
        >
          <option v-for="col in sortableColumns" :key="col.field" :value="col.field">
            {{ col.header }}
          </option>
        </select>
        <select
          v-model="localSortOrder"
          class="select-input order-select"
          @change="handleSaveDefaultSort"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>

    <div class="display-section">
      <h4>Tooltips</h4>
      <p class="section-hint">
        Control the display of tooltips showing keyboard shortcuts and additional information.
      </p>
      <div class="checkbox-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="localTooltipsDisabled"
            @change="handleSaveTooltipsDisabled"
          />
          <span class="checkbox-text">Disable tooltips</span>
        </label>
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
        </span>
      </div>
    </div>

    <div class="display-section">
      <h4>Sticky Toolbar</h4>
      <p class="section-hint">
        Keep filter bar and table toolbar always visible when scrolling. Useful on large screens.
      </p>
      <div class="checkbox-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="localStickyToolbar"
            @change="handleSaveStickyToolbar"
          />
          <span class="checkbox-text">Keep toolbar sticky</span>
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
  defaultSortField,
  defaultSortOrder,
  tooltipsDisabled,
  stickyToolbar,
  saving,
  updateDefaultSortField,
  updateDefaultSortOrder,
  updateTooltipsDisabled,
  updateStickyToolbar
} = useUserSettings()

const localSortField = ref('updated_at')
const localSortOrder = ref<'asc' | 'desc'>('desc')
const localTooltipsDisabled = ref(false)
const localStickyToolbar = ref(false)

const sortableColumns = [
  { field: 'updated_at', header: 'Updated' },
  { field: 'created_at', header: 'Created' },
  { field: 'due_date', header: 'Due Date' },
  { field: 'name', header: 'Name' },
  { field: 'status', header: 'Status' },
  { field: 'priority', header: 'Priority' },
  { field: 'project', header: 'Project' },
  { field: 'customer', header: 'Customer' },
  { field: 'progress', header: 'Progress' },
  { field: 'attachment_count', header: 'Attachments' },
  { field: 'accumulated_estimated_minutes', header: 'Est. Minutes' },
  { field: 'cost_group_code', header: 'Cost Code' }
]

const handleSaveDefaultSort = () => {
  updateDefaultSortField(localSortField.value)
  updateDefaultSortOrder(localSortOrder.value)
}

const handleSaveTooltipsDisabled = () => {
  updateTooltipsDisabled(localTooltipsDisabled.value)
}

const handleSaveStickyToolbar = () => {
  updateStickyToolbar(localStickyToolbar.value)
}

watch(defaultSortField, (val) => { localSortField.value = val }, { immediate: true })
watch(defaultSortOrder, (val) => { localSortOrder.value = val }, { immediate: true })
watch(tooltipsDisabled, (val) => { localTooltipsDisabled.value = val }, { immediate: true })
watch(stickyToolbar, (val) => { localStickyToolbar.value = val }, { immediate: true })
</script>

<style scoped>
.display-section {
  margin-bottom: 2rem;
}

.display-section:last-child {
  margin-bottom: 0;
}

.display-section h4 {
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

.select-input {
  flex: 1;
  max-width: 250px;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  padding-right: 2.5rem;
}

.select-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.order-select {
  max-width: 150px;
}

.saving-indicator {
  color: var(--accent-primary);
  font-size: 1rem;
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
</style>

