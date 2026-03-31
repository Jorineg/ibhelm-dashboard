<template>
  <SectionCard
    title="Project NAS folders"
    description="Map Teamwork projects to the directory name used on the NAS. Shown here only when a custom path is set. Excluded sync-filter projects are not listed in the picker."
  >
    <table v-if="manualRows.length" class="nas-table">
      <thead>
        <tr>
          <th>Project</th>
          <th>NAS folder name</th>
          <th class="actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in manualRows" :key="row.id">
          <td class="name-cell">{{ row.name }}</td>
          <td><code class="path-code">{{ row.nas_folder_path }}</code></td>
          <td class="actions">
            <button type="button" class="icon-btn" title="Edit" @click="startEdit(row)">
              <i class="pi pi-pencil"></i>
            </button>
            <button type="button" class="icon-btn danger" title="Remove mapping" @click="removeMapping(row)">
              <i class="pi pi-trash"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty-state">No custom NAS paths configured.</p>

    <h4 class="form-section-title">{{ editingProjectId != null ? 'Edit mapping' : 'Add mapping' }}</h4>
    <div class="add-row-line">
      <Dropdown
        v-model="selectedProjectId"
        :options="dropdownProjects"
        option-label="name"
        option-value="id"
        placeholder="Project"
        filter
        show-clear
        class="project-dd"
        :disabled="editingProjectId != null"
        :loading="overviewLoading"
      >
        <template #option="slotProps">
          <div class="project-dd-option">
            <Tooltip
              v-if="(slotProps.option.file_count ?? 0) === 0"
              text="No files found for this project in the database (files.project_id)."
              position="right"
            >
              <i class="pi pi-exclamation-triangle no-files-icon" aria-hidden="true" />
            </Tooltip>
            <span v-else class="no-files-spacer" />
            <span class="project-dd-name">{{ slotProps.option.name }}</span>
          </div>
        </template>
        <template #value="slotProps">
          <span v-if="slotProps.value" class="project-dd-value">
            <Tooltip
              v-if="selectedProjectNoFiles"
              text="No files found for this project in the database (files.project_id)."
              position="top"
            >
              <i class="pi pi-exclamation-triangle no-files-icon" aria-hidden="true" />
            </Tooltip>
            {{ projectLabelById(slotProps.value) }}
          </span>
          <span v-else class="placeholder">{{ slotProps.placeholder }}</span>
        </template>
      </Dropdown>

      <div class="path-autocomplete-wrap">
        <AutocompleteInput
          v-model="nasInput"
          :suggestions="filteredFolderSuggestions"
          :loading="suggestLoading"
          placeholder="NAS folder name"
          primary-field="name"
          :min-chars="0"
          :debounce-ms="0"
          @search="onPathSearch"
        />
      </div>
      <Button
        label="Save"
        icon="pi pi-check"
        :loading="saving"
        :disabled="selectedProjectId == null"
        @click="saveMapping"
      />
      <Button
        v-if="editingProjectId != null"
        label="Cancel"
        icon="pi pi-times"
        severity="secondary"
        @click="cancelEdit"
      />
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Dropdown from 'primevue/dropdown'
import Button from 'primevue/button'
import { SectionCard, AutocompleteInput, Tooltip, type AutocompleteSuggestion } from '@/components/common'
import { supabase } from '@/lib/supabase'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import type { ProjectItem } from '@/types'

type OverviewRow = ProjectItem & { nas_folder_path?: string | null }

interface ManualRow {
  id: number
  name: string
  nas_folder_path: string
}

interface DropdownProject {
  id: number
  name: string
  file_count: number
}

interface FolderSugg extends AutocompleteSuggestion {
  id: string
  name: string
  score: number
}

const { settings, initialize: initAppSettings } = useAppearanceSettings()

const overviewLoading = ref(false)
const overviewRows = ref<OverviewRow[]>([])
const manualRows = ref<ManualRow[]>([])
const selectedProjectId = ref<number | null>(null)
const nasInput = ref('')
const editingProjectId = ref<number | null>(null)
const saving = ref(false)
const suggestLoading = ref(false)
const folderSuggestionsRaw = ref<FolderSugg[]>([])
const filteredFolderSuggestions = ref<FolderSugg[]>([])

const excludedCompanyIds = computed(() => settings.value.excluded_tw_company_ids || [])
const excludedProjectIds = computed(() => settings.value.excluded_tw_project_ids || [])

const syncAllowedOverview = computed(() =>
  overviewRows.value.filter(
    (r) =>
      !excludedProjectIds.value.includes(r.id) &&
      (r.company_id == null || !excludedCompanyIds.value.includes(r.company_id))
  )
)

/** Picker: not sync-excluded; when adding, only projects without a custom NAS path */
const dropdownProjects = computed(() => {
  let rows = syncAllowedOverview.value.slice()
  if (editingProjectId.value != null) {
    rows = rows.filter((r) => r.id === editingProjectId.value)
  } else {
    rows = rows.filter((r) => !hasNasPath(r))
  }
  const noFiles = rows.filter((r) => (r.file_count ?? 0) === 0)
  const withFiles = rows.filter((r) => (r.file_count ?? 0) > 0)
  noFiles.sort((a, b) => a.name.localeCompare(b.name))
  withFiles.sort((a, b) => a.name.localeCompare(b.name))
  const sorted = [...noFiles, ...withFiles]
  return sorted.map((r) => ({
    id: r.id,
    name: r.name,
    file_count: r.file_count ?? 0,
  })) as DropdownProject[]
})

const selectedProjectNoFiles = computed(() => {
  if (selectedProjectId.value == null) return false
  const p = overviewRows.value.find((r) => r.id === selectedProjectId.value)
  return (p?.file_count ?? 0) === 0
})

function hasNasPath(r: OverviewRow) {
  const p = (r.nas_folder_path || '').trim()
  return p.length > 0
}

function projectLabelById(id: number) {
  return overviewRows.value.find((r) => r.id === id)?.name ?? `#${id}`
}

async function loadOverview() {
  overviewLoading.value = true
  try {
    const { data, error } = await supabase
      .from('project_overview')
      .select('id,name,company_id,file_count,nas_folder_path')
      .order('name')
    if (error) throw error
    overviewRows.value = (data || []) as OverviewRow[]
    rebuildManualRows()
  } finally {
    overviewLoading.value = false
  }
}

function rebuildManualRows() {
  manualRows.value = overviewRows.value
    .filter((r) => hasNasPath(r))
    .map((r) => ({
      id: r.id,
      name: r.name,
      nas_folder_path: (r.nas_folder_path || '').trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function ensureFolderSuggestions(projectId: number) {
  suggestLoading.value = true
  try {
    const { data, error } = await supabase.rpc('suggest_nas_folder_names_for_project', {
      p_tw_project_id: projectId,
      p_limit: 200,
    })
    if (error) throw error
    const rows = (data || []) as { folder_name: string; score: number }[]
    folderSuggestionsRaw.value = rows.map((row) => ({
      id: row.folder_name,
      name: row.folder_name,
      score: row.score,
    }))
    applyPathFilter(nasInput.value)
  } finally {
    suggestLoading.value = false
  }
}

function applyPathFilter(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) {
    filteredFolderSuggestions.value = folderSuggestionsRaw.value.slice(0, 80)
    return
  }
  filteredFolderSuggestions.value = folderSuggestionsRaw.value
    .filter((s) => s.name.toLowerCase().includes(q))
    .slice(0, 80)
}

async function onPathSearch(value: string) {
  if (selectedProjectId.value == null) {
    filteredFolderSuggestions.value = []
    return
  }
  if (!folderSuggestionsRaw.value.length) {
    await ensureFolderSuggestions(selectedProjectId.value)
  }
  applyPathFilter(value)
}

watch(selectedProjectId, async (id, prev) => {
  folderSuggestionsRaw.value = []
  filteredFolderSuggestions.value = []
  if (id == null) return
  if (editingProjectId.value == null && prev != null && prev !== id) {
    nasInput.value = ''
  }
  await ensureFolderSuggestions(id)
  applyPathFilter(nasInput.value)
})

function startEdit(row: ManualRow) {
  editingProjectId.value = row.id
  selectedProjectId.value = row.id
  nasInput.value = row.nas_folder_path
}

function cancelEdit() {
  editingProjectId.value = null
  selectedProjectId.value = null
  nasInput.value = ''
  folderSuggestionsRaw.value = []
  filteredFolderSuggestions.value = []
}

async function saveMapping() {
  if (selectedProjectId.value == null) return
  const raw = nasInput.value.trim()
  saving.value = true
  try {
    const { error } = await supabase.from('project_extensions').upsert(
      {
        tw_project_id: selectedProjectId.value,
        nas_folder_path: raw.length ? raw : null,
      },
      { onConflict: 'tw_project_id' }
    )
    if (error) throw error
    await loadOverview()
    cancelEdit()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

async function removeMapping(row: ManualRow) {
  saving.value = true
  try {
    const { error } = await supabase.from('project_extensions').upsert(
      { tw_project_id: row.id, nas_folder_path: null },
      { onConflict: 'tw_project_id' }
    )
    if (error) throw error
    if (editingProjectId.value === row.id) cancelEdit()
    await loadOverview()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await initAppSettings()
  await loadOverview()
})
</script>

<style scoped>
.nas-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

.nas-table th {
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-primary);
}

.nas-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-primary);
}

.nas-table tr:last-child td {
  border-bottom: none;
}

.nas-table .actions {
  text-align: right;
  white-space: nowrap;
}

.name-cell {
  font-weight: 500;
}

.path-code {
  font-size: 0.85rem;
  word-break: break-all;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.icon-btn.danger:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.empty-state {
  text-align: center;
  color: var(--text-tertiary);
  padding: 1.25rem 0;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.form-section-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  margin: 0 0 0.65rem;
}

.add-row-line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
}

.project-dd {
  flex: 0 0 min(320px, 100%);
  max-width: 320px;
}

:deep(.project-dd .p-dropdown) {
  width: 100%;
}

.path-autocomplete-wrap {
  flex: 1 1 200px;
  min-width: 160px;
}

.path-autocomplete-wrap :deep(.autocomplete-container) {
  width: 100%;
}

.project-dd-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.project-dd-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-files-icon {
  color: #eab308;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.no-files-spacer {
  width: 1.1rem;
  flex-shrink: 0;
}

.project-dd-value {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.placeholder {
  color: var(--text-tertiary);
}
</style>
