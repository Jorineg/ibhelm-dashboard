<template>
  <div class="filter-bar">
    <div class="filter-section">
      <h3>Filters</h3>
      
      <!-- Always-visible filters -->
      <div class="always-visible-filters">
        <div 
          v-for="filterName in alwaysVisibleFilterNames" 
          :key="filterName"
          class="filter-item"
        >
          <label :for="filterName">{{ formatFilterName(filterName) }}</label>
          <InputText
            :id="filterName"
            :model-value="activeConfig?.alwaysVisibleFilters[filterName as keyof typeof activeConfig.alwaysVisibleFilters] || ''"
            @update:model-value="(value: string) => updateAlwaysVisibleFilter(filterName, value)"
            :placeholder="`Filter by ${formatFilterName(filterName)}`"
          />
        </div>
      </div>

      <!-- Dynamic filters -->
      <div class="dynamic-filters">
        <div v-for="filter in activeConfig?.dynamicFilters" :key="filter.id" class="dynamic-filter">
          <Dropdown
            v-model="filter.column"
            :options="availableColumns"
            option-label="header"
            option-value="field"
            placeholder="Select column"
            @change="updateDynamicFilter(filter.id, { column: filter.column })"
          />
          
          <Dropdown
            v-model="filter.operator"
            :options="filterOperators"
            option-label="label"
            option-value="value"
            @change="updateDynamicFilter(filter.id, { operator: filter.operator })"
          />
          
          <InputText
            v-if="!['is_empty', 'is_not_empty'].includes(filter.operator)"
            v-model="filter.value"
            placeholder="Value"
            @update:model-value="updateDynamicFilter(filter.id, { value: filter.value })"
          />
          
          <Button
            icon="pi pi-times"
            severity="danger"
            text
            rounded
            @click="removeDynamicFilter(filter.id)"
          />
        </div>
      </div>

      <Button
        label="Add Filter"
        icon="pi pi-plus"
        outlined
        size="small"
        @click="addNewFilter"
        class="add-filter-btn"
      />

      <Button
        label="Clear All Filters"
        icon="pi pi-filter-slash"
        outlined
        severity="secondary"
        size="small"
        @click="clearAllFilters"
        class="clear-filters-btn"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Button from 'primevue/button'
import type { Column, ColumnFilter, FilterOperator } from '@/types'
import { useFilterConfigs } from '@/composables/useFilterConfigs'

interface Props {
  availableColumns: Column[]
}

const props = defineProps<Props>()

const {
  activeConfig,
  DEFAULT_ALWAYS_VISIBLE_FILTERS,
  addDynamicFilter,
  removeDynamicFilter,
  updateDynamicFilter,
  updateAlwaysVisibleFilter,
  clearAllFilters
} = useFilterConfigs()

const alwaysVisibleFilterNames = DEFAULT_ALWAYS_VISIBLE_FILTERS

const filterOperators = [
  { label: 'Equals', value: 'eq' },
  { label: 'Not Equals', value: 'neq' },
  { label: 'Contains', value: 'contains' },
  { label: 'Does Not Contain', value: 'not_contains' },
  { label: 'Is Empty', value: 'is_empty' },
  { label: 'Is Not Empty', value: 'is_not_empty' },
  { label: 'Before', value: 'before' },
  { label: 'After', value: 'after' }
]

const formatFilterName = (name: string) => {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ')
}

const addNewFilter = () => {
  const newFilter: ColumnFilter = {
    id: crypto.randomUUID(),
    column: props.availableColumns[0]?.field || 'name',
    operator: 'contains' as FilterOperator,
    value: ''
  }
  addDynamicFilter(newFilter)
}
</script>

<style scoped>
.filter-bar {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #333;
}

.always-visible-filters {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-item label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #555;
}

.dynamic-filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.dynamic-filter {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr auto;
  gap: 0.5rem;
  align-items: center;
}

.add-filter-btn,
.clear-filters-btn {
  width: 100%;
  margin-top: 0.5rem;
}
</style>

