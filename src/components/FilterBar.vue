<template>
  <div class="filter-bar">
    <div class="filter-section">
      <h3>Filters</h3>
      
      <!-- Always-visible filters with action buttons in same row -->
      <div class="filters-with-actions">
        <div class="filters-grid">
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
              size="large"
            />
          </div>
        </div>
        
        <!-- Filter action buttons in same grid row -->
        <div class="filter-actions-inline">
          <Button
            label="Add Filter"
            icon="pi pi-plus"
            outlined
            size="small"
            @click="addNewFilter"
            class="filter-action-btn"
          />

          <Button
            label="Clear All"
            icon="pi pi-filter-slash"
            outlined
            severity="secondary"
            size="small"
            @click="clearAllFilters"
            class="filter-action-btn"
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
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.filter-section {
  flex: 1;
}

.filter-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.filters-with-actions {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  flex: 1;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-actions-inline {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding-bottom: 0.25rem;
}

.dynamic-filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.dynamic-filter {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr auto;
  gap: 0.75rem;
  align-items: center;
}

.filter-action-btn {
  font-size: 0.875rem !important;
  white-space: nowrap;
  min-width: 140px;
}
</style>

