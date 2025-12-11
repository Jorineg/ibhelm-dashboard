<template>
  <div class="filter-bar">
    <div class="filter-section">

      <!-- Quick filters with action buttons -->
      <div class="filters-with-actions">
        <div class="filters-grid">
          <div 
            v-for="filterName in quickFilterFields" 
            :key="filterName"
            class="filter-item"
          >
            <label :for="filterName">{{ formatFilterName(filterName) }}</label>
            
            <!-- Project autocomplete -->
            <div v-if="filterName === 'project'" class="filter-input-with-info">
              <AutocompleteInput
                :id="filterName"
                :model-value="activeConfig?.quickFilters[filterName] || ''"
                :suggestions="projectSuggestions"
                :loading="projectLoading"
                :placeholder="`Filter by ${formatFilterName(filterName)}`"
                primary-field="name"
                secondary-field="company_name"
                @update:model-value="(value: string) => updateQuickFilter(filterName, value)"
                @search="handleProjectSearch"
                @select="handleProjectSelect"
                @clear="handleProjectClear"
              >
                <template #option="{ suggestion }">
                  <div class="project-option">
                    <span class="project-name">{{ suggestion.name }}</span>
                    <span v-if="suggestion.company_name" class="project-company">{{ suggestion.company_name }}</span>
                    <span v-if="suggestion.status" class="project-status" :class="suggestion.status">{{ suggestion.status }}</span>
                  </div>
                </template>
              </AutocompleteInput>
              <InfoTooltip position="bottom">
                <strong>Searches in:</strong>
                <ul>
                  <li>Project name</li>
                  <li>Company name</li>
                  <li>Project description</li>
                </ul>
              </InfoTooltip>
            </div>
            
            <!-- Involved person autocomplete -->
            <div v-else-if="filterName === 'involved_person'" class="filter-input-with-info">
              <AutocompleteInput
                :id="filterName"
                :model-value="activeConfig?.quickFilters[filterName] || ''"
                :suggestions="personSuggestions"
                :loading="personLoading"
                :placeholder="`Filter by ${formatFilterName(filterName)}`"
                primary-field="display_name"
                secondary-field="primary_email"
                @update:model-value="(value: string) => updateQuickFilter(filterName, value)"
                @search="handlePersonSearch"
                @select="handlePersonSelect"
                @clear="handlePersonClear"
              >
                <template #option="{ suggestion }">
                  <div class="person-option">
                    <div class="person-info">
                      <span class="person-name">{{ suggestion.display_name }}</span>
                      <span v-if="suggestion.primary_email" class="person-email">{{ suggestion.primary_email }}</span>
                    </div>
                    <span v-if="suggestion.is_internal" class="person-badge internal">Internal</span>
                  </div>
                </template>
              </AutocompleteInput>
              <InfoTooltip position="bottom">
                <strong>Searches in:</strong>
                <ul>
                  <li>Unified person names &amp; emails</li>
                  <li>Teamwork users &amp; companies</li>
                  <li>Missive contacts</li>
                </ul>
                <strong style="margin-top: 0.5rem;">Shows items where person is:</strong>
                <ul>
                  <li><em>Tasks:</em> assignee, creator, or updater</li>
                  <li><em>Emails:</em> sender, recipient, conversation assignee, author, or commentator</li>
                </ul>
              </InfoTooltip>
            </div>
            
            <!-- Cost group autocomplete -->
            <div v-else-if="filterName === 'kostengruppe'" class="filter-input-with-info">
              <AutocompleteInput
                :id="filterName"
                :model-value="activeConfig?.quickFilters[filterName] || ''"
                :suggestions="costGroupSuggestions"
                :loading="costGroupLoading"
                :placeholder="`Filter by ${formatFilterName(filterName)}`"
                primary-field="code"
                secondary-field="name"
                @update:model-value="(value: string) => updateQuickFilter(filterName, value)"
                @search="handleCostGroupSearch"
                @select="handleCostGroupSelect"
                @clear="handleCostGroupClear"
              >
                <template #option="{ suggestion }">
                  <div class="cost-group-option">
                    <span class="cost-group-code">{{ suggestion.code }}</span>
                    <span v-if="suggestion.name" class="cost-group-name">{{ suggestion.name }}</span>
                  </div>
                </template>
              </AutocompleteInput>
              <InfoTooltip position="bottom">
                <strong>Hierarchical search:</strong>
                <ul>
                  <li>Enter <code>4</code> to find all 4xx</li>
                  <li>Enter <code>45</code> to find all 45x</li>
                  <li>Enter <code>456</code> to find exact match</li>
                </ul>
                <strong style="margin-top: 0.5rem;">Or search by name</strong>
              </InfoTooltip>
            </div>
            
            <!-- Location autocomplete -->
            <div v-else-if="filterName === 'location'" class="filter-input-with-info">
              <AutocompleteInput
                :id="filterName"
                :model-value="activeConfig?.quickFilters[filterName] || ''"
                :suggestions="locationSuggestions"
                :loading="locationLoading"
                :placeholder="`Filter by ${formatFilterName(filterName)}`"
                primary-field="name"
                secondary-field="path"
                @update:model-value="(value: string) => updateQuickFilter(filterName, value)"
                @search="handleLocationSearch"
                @select="handleLocationSelect"
                @clear="handleLocationClear"
              >
                <template #option="{ suggestion }">
                  <div class="location-option">
                    <span class="location-name">{{ suggestion.name }}</span>
                    <span class="location-type" :class="suggestion.type">{{ suggestion.type }}</span>
                    <span v-if="suggestion.path && suggestion.path !== suggestion.name" class="location-path">{{ suggestion.path }}</span>
                  </div>
                </template>
              </AutocompleteInput>
              <InfoTooltip position="bottom">
                <strong>Hierarchical search:</strong>
                <ul>
                  <li>Search for a building to find all items in that building</li>
                  <li>Search for a level to find all items on that level</li>
                  <li>Search for a room for exact match</li>
                </ul>
              </InfoTooltip>
            </div>
            
            <!-- Tag autocomplete -->
            <div v-else-if="filterName === 'tags'" class="filter-input-with-info">
              <AutocompleteInput
                :id="filterName"
                :model-value="activeConfig?.quickFilters[filterName] || ''"
                :suggestions="tagSuggestions"
                :loading="tagLoading"
                :placeholder="`Filter by ${formatFilterName(filterName)}`"
                primary-field="name"
                secondary-field="source"
                @update:model-value="(value: string) => updateQuickFilter(filterName, value)"
                @search="handleTagSearch"
                @select="handleTagSelect"
                @clear="handleTagClear"
              >
                <template #option="{ suggestion }">
                  <div class="tag-option">
                    <span v-if="suggestion.color" class="tag-color" :style="{ backgroundColor: suggestion.color }"></span>
                    <span class="tag-name">{{ suggestion.name }}</span>
                    <span class="tag-source">{{ suggestion.source }}</span>
                  </div>
                </template>
              </AutocompleteInput>
              <InfoTooltip position="bottom">
                <strong>Searches in:</strong>
                <ul>
                  <li>Teamwork task tags</li>
                  <li>Missive conversation labels</li>
                </ul>
                <strong style="margin-top: 0.5rem;">Matches items with any tag containing the search text</strong>
              </InfoTooltip>
            </div>
            
            <!-- Regular input for other filters -->
            <InputText
              v-else
              :id="filterName"
              :model-value="activeConfig?.quickFilters[filterName] || ''"
              @update:model-value="(value: string) => updateQuickFilter(filterName, value)"
              :placeholder="`Filter by ${formatFilterName(filterName)}`"
              size="large"
            />
          </div>
        </div>
        
        <!-- Filter action buttons -->
        <div class="filter-actions-inline">
          <div class="add-filter-container" ref="addFilterRef">
            <Button
              label="Add Filter"
              icon="pi pi-plus"
              outlined
              size="small"
              @click="toggleAddFilterMenu"
              class="filter-action-btn"
            />
            <Transition name="dropdown">
              <div v-if="showAddFilter && availableFilters.length > 0" class="add-filter-dropdown dropdown-panel">
                <div
                  v-for="col in availableFilters"
                  :key="col.field"
                  class="dropdown-item"
                  @click="selectFilter(col)"
                >
                  <i :class="getTypeIcon(col.type)" class="filter-icon"></i>
                  <span>{{ col.label }}</span>
                </div>
              </div>
            </Transition>
          </div>

          <Button
            v-if="hasActiveFilters"
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

      <!-- Column filters (typed) - grouped by base field -->
      <div v-if="activeBaseFields.length > 0" class="column-filters">
        <div v-for="baseField in activeBaseFields" :key="baseField" class="column-filter">
          <div class="column-filter-header">
            <span class="column-filter-label">{{ getColumnLabelByBase(baseField) }}</span>
            <Button
              icon="pi pi-times"
              severity="danger"
              text
              rounded
              size="small"
              @click="removeAllColumnFilters(baseField)"
            />
          </div>
          
          <!-- Text filter -->
          <div v-if="getColumnTypeByBase(baseField) === 'text'" class="column-filter-control">
            <InputText
              :model-value="getTextFilterValue(baseField)"
              @update:model-value="(v: string) => setTextFilter(baseField, v)"
              placeholder="Contains..."
              size="small"
            />
          </div>
          
          <!-- Enum filter (in/not in) -->
          <div v-else-if="getColumnTypeByBase(baseField) === 'enum'" class="column-filter-control enum-control">
            <div class="enum-section">
              <label>Include:</label>
              <MultiSelect
                :model-value="getEnumInValues(baseField)"
                :options="getEnumOptions(baseField)"
                @update:model-value="(v: string[]) => setEnumInFilter(baseField, v)"
                placeholder="Any"
                display="chip"
                :max-selected-labels="3"
                class="enum-select"
              />
            </div>
            <div class="enum-section">
              <label>Exclude:</label>
              <MultiSelect
                :model-value="getEnumNotInValues(baseField)"
                :options="getEnumOptions(baseField)"
                @update:model-value="(v: string[]) => setEnumNotInFilter(baseField, v)"
                placeholder="None"
                display="chip"
                :max-selected-labels="3"
                class="enum-select"
              />
            </div>
          </div>
          
          <!-- Date filter (range + null) -->
          <div v-else-if="getColumnTypeByBase(baseField) === 'date'" class="column-filter-control date-control">
            <div class="date-range">
              <div class="date-field">
                <label>From:</label>
                <Calendar
                  :model-value="getDateMin(baseField)"
                  @update:model-value="(v: Date | null) => setDateMin(baseField, v)"
                  dateFormat="yy-mm-dd"
                  :show-icon="true"
                  :show-button-bar="true"
                  placeholder="Any"
                />
              </div>
              <div class="date-field">
                <label>To:</label>
                <Calendar
                  :model-value="getDateMax(baseField)"
                  @update:model-value="(v: Date | null) => setDateMax(baseField, v)"
                  dateFormat="yy-mm-dd"
                  :show-icon="true"
                  :show-button-bar="true"
                  placeholder="Any"
                />
              </div>
            </div>
            <div class="date-null-option">
              <TriStateCheckbox
                :model-value="getDateIsNull(baseField)"
                @update:model-value="(v: boolean | null) => setDateIsNull(baseField, v)"
              />
              <span>{{ getDateNullLabel(baseField) }}</span>
            </div>
          </div>
          
          <!-- Number filter (range) -->
          <div v-else-if="getColumnTypeByBase(baseField) === 'number'" class="column-filter-control number-control">
            <div class="number-field">
              <label>Min:</label>
              <InputNumber
                :model-value="getNumberMin(baseField)"
                @update:model-value="(v: number | null) => setNumberMin(baseField, v)"
                placeholder="Any"
                :min="0"
              />
            </div>
            <div class="number-field">
              <label>Max:</label>
              <InputNumber
                :model-value="getNumberMax(baseField)"
                @update:model-value="(v: number | null) => setNumberMax(baseField, v)"
                placeholder="Any"
                :min="0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import Calendar from 'primevue/calendar'
import TriStateCheckbox from 'primevue/tristatecheckbox'
import { AutocompleteInput, InfoTooltip } from '@/components/common'
import type { QuickFilters, ColumnFilters, FilterableColumn } from '@/types'
import { FILTERABLE_COLUMNS } from '@/types'
import { useFilterConfigs } from '@/composables/useFilterConfigs'
import { useProjectAutocomplete, usePersonAutocomplete, useCostGroupAutocomplete, useLocationAutocomplete, useTagAutocomplete } from '@/composables/useAutocomplete'
import type { ProjectSuggestion, PersonSuggestion, CostGroupSuggestion, LocationSuggestion, TagSuggestion } from '@/composables/useAutocomplete'

const {
  activeConfig,
  quickFilterFields,
  hasActiveFilters,
  activeColumnFilterKeys,
  updateQuickFilter,
  updateColumnFilter,
  removeColumnFilter,
  clearAllFilters
} = useFilterConfigs()

// Computed: unique base fields that have active filters
const activeBaseFields = computed(() => {
  const fields = new Set<string>()
  activeColumnFilterKeys.value.forEach(key => {
    fields.add(getBaseField(key))
  })
  return Array.from(fields)
})

// Autocomplete composables
const { suggestions: projectSuggestions, loading: projectLoading, search: searchProjects, clear: clearProjectSuggestions } = useProjectAutocomplete()
const { suggestions: personSuggestions, loading: personLoading, search: searchPersons, clear: clearPersonSuggestions } = usePersonAutocomplete()
const { suggestions: costGroupSuggestions, loading: costGroupLoading, search: searchCostGroups, clear: clearCostGroupSuggestions } = useCostGroupAutocomplete()
const { suggestions: locationSuggestions, loading: locationLoading, search: searchLocations, clear: clearLocationSuggestions } = useLocationAutocomplete()
const { suggestions: tagSuggestions, loading: tagLoading, search: searchTags, clear: clearTagSuggestions } = useTagAutocomplete()

// Add filter dropdown state
const addFilterRef = ref<HTMLElement | null>(null)
const showAddFilter = ref(false)

const toggleAddFilterMenu = () => {
  showAddFilter.value = !showAddFilter.value
}

const handleClickOutside = (event: MouseEvent) => {
  if (addFilterRef.value && !addFilterRef.value.contains(event.target as Node)) {
    showAddFilter.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

const formatFilterName = (name: string) => {
  const labels: Record<string, string> = {
    project: 'Project',
    involved_person: 'Involved Person',
    location: 'Ort',
    kostengruppe: 'Cost Group',
    tags: 'Tags'
  }
  return labels[name] || name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ')
}

// Column filter helpers
const getBaseField = (filterKey: keyof ColumnFilters): string => {
  return filterKey
    .replace(/_contains$/, '')
    .replace(/_in$/, '')
    .replace(/_not_in$/, '')
    .replace(/_min$/, '')
    .replace(/_max$/, '')
    .replace(/_is_null$/, '')
}

const getColumnDef = (filterKey: keyof ColumnFilters): FilterableColumn | undefined => {
  const baseField = getBaseField(filterKey)
  return FILTERABLE_COLUMNS.find(c => c.field === baseField)
}

const getColumnLabel = (filterKey: keyof ColumnFilters): string => {
  const def = getColumnDef(filterKey)
  return def?.label || getBaseField(filterKey)
}

const getColumnLabelByBase = (baseField: string): string => {
  const def = FILTERABLE_COLUMNS.find(c => c.field === baseField)
  return def?.label || baseField
}

const getColumnType = (filterKey: keyof ColumnFilters): string => {
  const def = getColumnDef(filterKey)
  return def?.type || 'text'
}

const getColumnTypeByBase = (baseField: string): string => {
  const def = FILTERABLE_COLUMNS.find(c => c.field === baseField)
  return def?.type || 'text'
}

// Remove all filter keys for a base field
const removeAllColumnFilters = (baseField: string) => {
  const def = FILTERABLE_COLUMNS.find(c => c.field === baseField)
  if (!def) return
  
  switch (def.type) {
    case 'text':
      removeColumnFilter(`${baseField}_contains` as keyof ColumnFilters)
      break
    case 'enum':
      removeColumnFilter(`${baseField}_in` as keyof ColumnFilters)
      removeColumnFilter(`${baseField}_not_in` as keyof ColumnFilters)
      break
    case 'date':
      removeColumnFilter(`${baseField}_min` as keyof ColumnFilters)
      removeColumnFilter(`${baseField}_max` as keyof ColumnFilters)
      removeColumnFilter(`${baseField}_is_null` as keyof ColumnFilters)
      break
    case 'number':
      removeColumnFilter(`${baseField}_min` as keyof ColumnFilters)
      removeColumnFilter(`${baseField}_max` as keyof ColumnFilters)
      break
  }
}

// Text filter helpers (work with base field name)
const getTextFilterValue = (baseField: string): string => {
  const key = `${baseField}_contains` as keyof ColumnFilters
  return (activeConfig.value?.columnFilters[key] as string) || ''
}

const setTextFilter = (baseField: string, value: string) => {
  const key = `${baseField}_contains` as keyof ColumnFilters
  updateColumnFilter(key, value || undefined)
}

// Enum filter helpers (work with base field name)
const getEnumOptions = (baseField: string): string[] => {
  const def = FILTERABLE_COLUMNS.find(c => c.field === baseField)
  return def?.enumValues || []
}

const getEnumInValues = (baseField: string): string[] => {
  const inKey = `${baseField}_in` as keyof ColumnFilters
  return (activeConfig.value?.columnFilters[inKey] as string[]) || []
}

const getEnumNotInValues = (baseField: string): string[] => {
  const notInKey = `${baseField}_not_in` as keyof ColumnFilters
  return (activeConfig.value?.columnFilters[notInKey] as string[]) || []
}

const setEnumInFilter = (baseField: string, values: string[]) => {
  const inKey = `${baseField}_in` as keyof ColumnFilters
  updateColumnFilter(inKey, values.length > 0 ? values : undefined)
}

const setEnumNotInFilter = (baseField: string, values: string[]) => {
  const notInKey = `${baseField}_not_in` as keyof ColumnFilters
  updateColumnFilter(notInKey, values.length > 0 ? values : undefined)
}

// Date filter helpers (work with base field name)
const getDateMin = (baseField: string): Date | null => {
  const minKey = `${baseField}_min` as keyof ColumnFilters
  const val = activeConfig.value?.columnFilters[minKey] as string | undefined
  return val ? new Date(val) : null
}

const getDateMax = (baseField: string): Date | null => {
  const maxKey = `${baseField}_max` as keyof ColumnFilters
  const val = activeConfig.value?.columnFilters[maxKey] as string | undefined
  return val ? new Date(val) : null
}

const getDateIsNull = (baseField: string): boolean | null => {
  const nullKey = `${baseField}_is_null` as keyof ColumnFilters
  return activeConfig.value?.columnFilters[nullKey] as boolean | undefined ?? null
}

const setDateMin = (baseField: string, value: Date | null) => {
  const minKey = `${baseField}_min` as keyof ColumnFilters
  updateColumnFilter(minKey, value ? value.toISOString() : undefined)
}

const setDateMax = (baseField: string, value: Date | null) => {
  const maxKey = `${baseField}_max` as keyof ColumnFilters
  updateColumnFilter(maxKey, value ? value.toISOString() : undefined)
}

const setDateIsNull = (baseField: string, value: boolean | null) => {
  const nullKey = `${baseField}_is_null` as keyof ColumnFilters
  updateColumnFilter(nullKey, value ?? undefined)
}

const getDateNullLabel = (baseField: string): string => {
  const isNull = getDateIsNull(baseField)
  if (isNull === true) return 'Only empty'
  if (isNull === false) return 'Only non-empty'
  return 'Include empty'
}

// Number filter helpers (work with base field name)
const getNumberMin = (baseField: string): number | null => {
  const minKey = `${baseField}_min` as keyof ColumnFilters
  return activeConfig.value?.columnFilters[minKey] as number | undefined ?? null
}

const getNumberMax = (baseField: string): number | null => {
  const maxKey = `${baseField}_max` as keyof ColumnFilters
  return activeConfig.value?.columnFilters[maxKey] as number | undefined ?? null
}

const setNumberMin = (baseField: string, value: number | null) => {
  const minKey = `${baseField}_min` as keyof ColumnFilters
  updateColumnFilter(minKey, value ?? undefined)
}

const setNumberMax = (baseField: string, value: number | null) => {
  const maxKey = `${baseField}_max` as keyof ColumnFilters
  updateColumnFilter(maxKey, value ?? undefined)
}

// Available filters (columns not already active)
const availableFilters = computed(() => {
  const activeFields = new Set(activeColumnFilterKeys.value.map(key => getBaseField(key)))
  return FILTERABLE_COLUMNS.filter(col => !activeFields.has(col.field))
})

const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'text': return 'pi pi-align-left'
    case 'enum': return 'pi pi-list'
    case 'date': return 'pi pi-calendar'
    case 'number': return 'pi pi-hashtag'
    default: return 'pi pi-filter'
  }
}

const selectFilter = (col: FilterableColumn) => {
  showAddFilter.value = false
  switch (col.type) {
    case 'text':
      updateColumnFilter(`${col.field}_contains` as keyof ColumnFilters, '')
      break
    case 'enum':
      updateColumnFilter(`${col.field}_in` as keyof ColumnFilters, [])
      break
    case 'date':
      updateColumnFilter(`${col.field}_min` as keyof ColumnFilters, undefined)
      break
    case 'number':
      updateColumnFilter(`${col.field}_min` as keyof ColumnFilters, undefined)
      break
  }
}

// Autocomplete handlers
const handleProjectSearch = (searchText: string) => searchProjects(searchText)
const handleProjectSelect = (suggestion: ProjectSuggestion) => updateQuickFilter('project', suggestion.name)
const handleProjectClear = () => { updateQuickFilter('project', ''); clearProjectSuggestions() }

const handlePersonSearch = (searchText: string) => searchPersons(searchText)
const handlePersonSelect = (suggestion: PersonSuggestion) => updateQuickFilter('involved_person', suggestion.display_name)
const handlePersonClear = () => { updateQuickFilter('involved_person', ''); clearPersonSuggestions() }

const handleCostGroupSearch = (searchText: string) => searchCostGroups(searchText)
const handleCostGroupSelect = (suggestion: CostGroupSuggestion) => updateQuickFilter('kostengruppe', String(suggestion.code))
const handleCostGroupClear = () => { updateQuickFilter('kostengruppe', ''); clearCostGroupSuggestions() }

const handleLocationSearch = (searchText: string) => searchLocations(searchText)
const handleLocationSelect = (suggestion: LocationSuggestion) => updateQuickFilter('location', suggestion.name)
const handleLocationClear = () => { updateQuickFilter('location', ''); clearLocationSuggestions() }

const handleTagSearch = (searchText: string) => searchTags(searchText)
const handleTagSelect = (suggestion: TagSuggestion) => updateQuickFilter('tags', suggestion.name)
const handleTagClear = () => { updateQuickFilter('tags', ''); clearTagSuggestions() }
</script>

<style scoped>
.filter-bar {
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 160;
}

.filter-section {
  flex: 1;
}

.filters-with-actions {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;
}

.filters-grid {
  display: flex;
  flex-wrap: nowrap;
  gap: 1.5rem;
  flex: 1;
  min-width: 0;
}

.filters-grid > .filter-item {
  flex: 0 1 200px;
  min-width: 120px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-input-with-info {
  position: relative;
}

.filter-input-with-info > :deep(.info-tooltip-wrapper) {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
}

.filter-input-with-info :deep(.autocomplete-input) {
  padding-right: 3.25rem !important;
}

.filter-input-with-info :deep(.autocomplete-clear),
.filter-input-with-info :deep(.autocomplete-loading) {
  right: 1.75rem;
}

.filter-actions-inline {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding-bottom: 0.25rem;
  flex-shrink: 0;
}

.filter-action-btn {
  font-size: 0.875rem !important;
  white-space: nowrap;
}

/* Add filter dropdown */
.add-filter-container {
  position: relative;
}

.add-filter-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  min-width: 180px;
  z-index: 1000;
}

.add-filter-dropdown .dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-icon {
  color: var(--text-tertiary);
  width: 1rem;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Column filters */
.column-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.column-filter {
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 1rem;
  min-width: 250px;
  max-width: 350px;
}

.column-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.column-filter-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.column-filter-control {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Enum filter */
.enum-control {
  gap: 0.75rem;
}

.enum-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.enum-section label {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.enum-select {
  width: 100%;
}

/* Date filter */
.date-control {
  gap: 0.75rem;
}

.date-range {
  display: flex;
  gap: 0.75rem;
}

.date-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.date-field label {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.date-null-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Number filter */
.number-control {
  flex-direction: row;
  gap: 0.75rem;
}

.number-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.number-field label {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

/* Autocomplete option styling */
.project-option, .person-option, .cost-group-option, .tag-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.project-name, .person-name, .tag-name {
  color: var(--text-primary);
  font-weight: 500;
}

.project-company, .person-email {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.project-status, .person-badge, .tag-source {
  margin-left: auto;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.project-status.active {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.project-status.completed {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-tertiary);
}

.person-badge.internal {
  background: rgba(74, 158, 255, 0.15);
  color: var(--accent-primary);
}

.tag-source {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-tertiary);
}

.person-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.cost-group-code {
  color: var(--accent-primary);
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  min-width: 3ch;
}

.cost-group-name {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.tag-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Location option styling */
.location-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.location-name {
  color: var(--text-primary);
  font-weight: 500;
}

.location-type {
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.location-type.building {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.location-type.level {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}

.location-type.room {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.location-path {
  color: var(--text-tertiary);
  font-size: 0.8rem;
  flex-basis: 100%;
}
</style>
