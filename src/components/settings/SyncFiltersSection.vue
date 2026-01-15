<template>
  <SectionCard
    title="Sync Filters"
    description="Exclude specific Teamwork companies or projects from being imported. Excluded items will not sync to the database."
  >
    <!-- Excluded Companies -->
    <div class="filter-section">
      <h4>Excluded Companies</h4>
      <p class="section-hint">
        Projects belonging to excluded companies will not be synced. This excludes all tasks, timelogs, and related data.
      </p>
      
      <div class="filter-list">
        <div v-for="company in excludedCompanies" :key="company.id" class="filter-item">
          <span class="filter-name">{{ company.name }}</span>
          <span class="filter-id">#{{ company.id }}</span>
          <button type="button" class="remove-btn" @click="removeCompany(company.id)">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div v-if="excludedCompanies.length === 0" class="empty-state">
          No companies excluded
        </div>
      </div>
      
      <div class="add-row">
        <AutocompleteInput
          v-model="companySearch"
          :suggestions="companySuggestions"
          :loading="companyLoading"
          placeholder="Search companies to exclude..."
          primary-field="name"
          :min-chars="1"
          @search="searchCompanies"
          @select="addCompany"
        />
      </div>
    </div>

    <!-- Excluded Projects -->
    <div class="filter-section">
      <h4>Excluded Projects</h4>
      <p class="section-hint">
        Individually excluded projects. Tasks, timelogs, and related data for these projects will not be synced.
      </p>
      
      <div class="filter-list">
        <div v-for="project in excludedProjects" :key="project.id" class="filter-item">
          <span class="filter-name">{{ project.name }}</span>
          <span class="filter-id">#{{ project.id }}</span>
          <button type="button" class="remove-btn" @click="removeProject(project.id)">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div v-if="excludedProjects.length === 0" class="empty-state">
          No projects excluded
        </div>
      </div>
      
      <div class="add-row">
        <AutocompleteInput
          v-model="projectSearch"
          :suggestions="projectSuggestions"
          :loading="projectLoading"
          placeholder="Search projects to exclude..."
          primary-field="name"
          :min-chars="1"
          @search="searchProjects"
          @select="addProject"
        />
      </div>
    </div>

    <!-- Purge Section -->
    <div class="purge-section">
      <h4>Purge Excluded Data</h4>
      <p class="section-hint">
        Remove all existing data for excluded companies and projects from the database. 
        This will delete tasks, timelogs, tags, and unlink conversations, files, and Craft documents.
      </p>
      
      <div v-if="purgeResult" class="purge-result" :class="{ error: purgeError }">
        <template v-if="purgeError">
          <i class="pi pi-exclamation-triangle"></i>
          {{ purgeResult }}
        </template>
        <template v-else>
          <i class="pi pi-check-circle"></i>
          Purged: {{ purgeResult.projects_deleted }} projects, 
          {{ purgeResult.tasks_deleted }} tasks, 
          {{ purgeResult.timelogs_deleted }} timelogs, 
          {{ purgeResult.tags_deleted }} tags. 
          Unlinked: {{ purgeResult.conversations_unlinked }} conversations, 
          {{ purgeResult.craft_docs_unlinked }} craft docs, 
          {{ purgeResult.files_unlinked }} files.
        </template>
      </div>
      
      <button 
        type="button" 
        class="purge-btn" 
        @click="purgeExcludedData"
        :disabled="isPurging || (excludedCompanyIds.length === 0 && excludedProjectIds.length === 0)"
      >
        <i v-if="isPurging" class="pi pi-spin pi-spinner"></i>
        <i v-else class="pi pi-trash"></i>
        {{ isPurging ? 'Purging...' : 'Purge Excluded Data' }}
      </button>
    </div>

    <span v-if="saving" class="saving-indicator">
      <i class="pi pi-spin pi-spinner"></i>
    </span>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { SectionCard, AutocompleteInput, type AutocompleteSuggestion } from '@/components/common'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
import { supabase } from '@/lib/supabase'

interface Company {
  id: number
  name: string
}

interface Project {
  id: number
  name: string
}

interface PurgeResult {
  projects_deleted: number
  tasks_deleted: number
  timelogs_deleted: number
  tags_deleted: number
  conversations_unlinked: number
  craft_docs_unlinked: number
  files_unlinked: number
}

const {
  excludedCompanyIds,
  excludedProjectIds,
  updateExcludedCompanyIds,
  updateExcludedProjectIds,
  saving,
  initialize
} = useAppearanceSettings()

// Local state
const companySearch = ref('')
const projectSearch = ref('')
const companySuggestions = ref<Company[]>([])
const projectSuggestions = ref<Project[]>([])
const companyLoading = ref(false)
const projectLoading = ref(false)
const excludedCompanies = ref<Company[]>([])
const excludedProjects = ref<Project[]>([])
const isPurging = ref(false)
const purgeResult = ref<PurgeResult | null>(null)
const purgeError = ref(false)

// Load company/project details for display
const loadExcludedDetails = async () => {
  // Load company details
  if (excludedCompanyIds.value.length > 0) {
    const { data } = await supabase.rpc('get_companies_by_ids', {
      p_ids: excludedCompanyIds.value
    })
    excludedCompanies.value = data || []
  } else {
    excludedCompanies.value = []
  }
  
  // Load project details
  if (excludedProjectIds.value.length > 0) {
    const { data } = await supabase.rpc('get_projects_by_ids', {
      p_ids: excludedProjectIds.value
    })
    excludedProjects.value = data || []
  } else {
    excludedProjects.value = []
  }
}

// Search companies
const searchCompanies = async (query: string) => {
  companyLoading.value = true
  try {
    const { data } = await supabase.rpc('search_companies_autocomplete', {
      p_search_text: query,
      p_limit: 20
    })
    companySuggestions.value = (data || []).filter(
      (c: Company) => !excludedCompanyIds.value.includes(c.id)
    )
  } finally {
    companyLoading.value = false
  }
}

// Search projects
const searchProjects = async (query: string) => {
  projectLoading.value = true
  try {
    const { data } = await supabase.rpc('search_projects_autocomplete', {
      p_search_text: query,
      p_limit: 20
    })
    projectSuggestions.value = (data || []).filter(
      (p: Project) => !excludedProjectIds.value.includes(p.id)
    )
  } finally {
    projectLoading.value = false
  }
}

// Add company to exclusion list
const addCompany = async (suggestion: AutocompleteSuggestion) => {
  const company = suggestion as unknown as Company
  if (!excludedCompanyIds.value.includes(company.id)) {
    await updateExcludedCompanyIds([...excludedCompanyIds.value, company.id])
    excludedCompanies.value.push(company)
  }
  companySearch.value = ''
}

// Remove company from exclusion list
const removeCompany = async (id: number) => {
  await updateExcludedCompanyIds(excludedCompanyIds.value.filter(cid => cid !== id))
  excludedCompanies.value = excludedCompanies.value.filter(c => c.id !== id)
}

// Add project to exclusion list
const addProject = async (suggestion: AutocompleteSuggestion) => {
  const project = suggestion as unknown as Project
  if (!excludedProjectIds.value.includes(project.id)) {
    await updateExcludedProjectIds([...excludedProjectIds.value, project.id])
    excludedProjects.value.push(project)
  }
  projectSearch.value = ''
}

// Remove project from exclusion list
const removeProject = async (id: number) => {
  await updateExcludedProjectIds(excludedProjectIds.value.filter(pid => pid !== id))
  excludedProjects.value = excludedProjects.value.filter(p => p.id !== id)
}

// Purge excluded data
const purgeExcludedData = async () => {
  isPurging.value = true
  purgeResult.value = null
  purgeError.value = false
  
  try {
    const { data, error } = await supabase.rpc('purge_excluded_teamwork_data')
    if (error) throw error
    purgeResult.value = data?.[0] || data
  } catch (e) {
    console.error('Error purging excluded data:', e)
    purgeResult.value = `Error: ${(e as Error).message}` as any
    purgeError.value = true
  } finally {
    isPurging.value = false
  }
}

// Watch for changes to reload details
watch([excludedCompanyIds, excludedProjectIds], loadExcludedDetails, { deep: true })

onMounted(async () => {
  await initialize()
  await loadExcludedDetails()
})
</script>

<style scoped>
.filter-section {
  margin-bottom: 2.5rem;
}

.filter-section:last-of-type {
  margin-bottom: 2rem;
}

.filter-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.section-hint {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin: 0 0 1rem 0;
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  max-height: 200px;
  overflow-y: auto;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
}

.filter-name {
  flex: 1;
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

.filter-id {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.remove-btn:hover {
  opacity: 1;
  color: var(--error);
}

.empty-state {
  padding: 1rem;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-primary);
  border-radius: var(--radius-md);
}

.add-row {
  max-width: 400px;
}

.purge-section {
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.purge-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.purge-result {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--success-bg, rgba(16, 185, 129, 0.1));
  border: 1px solid var(--success, #10b981);
  border-radius: var(--radius-md);
  color: var(--success, #10b981);
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.purge-result.error {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
}

.purge-result i {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.purge-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--error, #ef4444);
  border-radius: var(--radius-md);
  color: var(--error, #ef4444);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.purge-btn:hover:not(:disabled) {
  background: var(--error, #ef4444);
  color: white;
}

.purge-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.saving-indicator {
  display: inline-flex;
  align-items: center;
  color: var(--accent-primary);
  font-size: 1rem;
  margin-left: 1rem;
}
</style>

