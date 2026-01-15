<template>
  <div class="settings-view" @click="syncPopupVisible = false">
    <!-- Header -->
    <PageHeader
      title="Settings"
      :show-back="true"
      :user-email="user?.email"
      :show-sign-out="true"
      @back="goBack"
      @sign-out="handleSignOut"
    >
      <template #center>
        <div class="sync-status-wrapper" @click.stop>
          <SyncStatusIndicator 
            :overall-status="overallStatus"
            :tooltip="headerTooltip"
            @click="toggleSyncPopup" 
          />
          <div v-if="syncPopupVisible" class="sync-popup-container">
            <SyncStatusPanel 
              :sync-status="syncStatus" 
              :is-source-outdated="isSourceOutdated"
              :is-files-outdated="isFilesOutdated"
              :is-thumbnails-outdated="isThumbnailsOutdated"
              :is-attachments-outdated="isAttachmentsOutdated"
              :get-queue-ok-tooltip="getQueueOkTooltip"
              :get-queue-pending-tooltip="getQueuePendingTooltip"
              :get-failed-tooltip="getFailedTooltip"
            />
          </div>
        </div>
      </template>
      
      <template #actions>
        <button class="home-btn" @click="goBack" title="Home">
          <i class="pi pi-home"></i>
        </button>
      </template>
    </PageHeader>

    <!-- Scrollable Content -->
    <div class="settings-inner">
      <div class="settings-layout">
      <!-- Sidebar Navigation -->
      <nav class="settings-sidebar">
        <ul class="sidebar-menu">
          <!-- User sections (visible to all) -->
          <li class="section-header">Personal</li>
          <li 
            v-for="section in userSections" 
            :key="section.id"
            :class="{ active: activeSection === section.id }"
            @click="activeSection = section.id"
          >
            <i :class="section.icon"></i>
            <span>{{ section.label }}</span>
          </li>
          
          <!-- Admin sections (visible to admins only) -->
          <template v-if="isAdmin">
            <li class="section-header">Admin</li>
            <li 
              v-for="section in adminSections" 
              :key="section.id"
              :class="{ active: activeSection === section.id }"
              @click="activeSection = section.id"
            >
              <i :class="section.icon"></i>
              <span>{{ section.label }}</span>
            </li>
          </template>
        </ul>
      </nav>

      <!-- Settings Content -->
      <div class="settings-content">
        <!-- User Sections -->
        <DisplaySection v-if="activeSection === 'display'" />
        <KeyBindingsSection v-else-if="activeSection === 'keybindings'" />

        <!-- Admin Sections -->
        <template v-if="isAdmin">
          <AppearanceSection v-if="activeSection === 'appearance'" />
          <GeneralSection v-else-if="activeSection === 'integration'" />
          <TaskTypesSection
            v-else-if="activeSection === 'task-types'"
            :extraction-run="extractionRun"
            :is-extracting="isExtracting"
            @rerun-extraction="handleRerunExtraction"
          />
          <PeopleSection
            v-else-if="activeSection === 'people'"
            :person-linking-run="personLinkingRun"
            :is-linking="isLinking"
            @rerun-linking="handleRerunPersonLinking"
          />
          <EmailsSection
            v-else-if="activeSection === 'emails'"
            :project-linking-run="projectLinkingRun"
            :is-linking="isProjectLinking"
            @rerun-linking="handleRerunProjectLinking"
          />
          <FilesSection
            v-else-if="activeSection === 'files'"
            :file-linking-run="fileLinkingRun"
            :is-linking="isFileLinking"
            @rerun-linking="handleRerunFileLinking"
          />
          <CostGroupsSection
            v-else-if="activeSection === 'cost-groups'"
            :cost-group-linking-run="costGroupLinkingRun"
            :is-linking="isCostGroupLinking"
            @rerun-linking="handleRerunCostGroupLinking"
          />
          <LocationsSection
            v-else-if="activeSection === 'locations'"
            :location-linking-run="locationLinkingRun"
            :is-linking="isLocationLinking"
            @rerun-linking="handleRerunLocationLinking"
          />
          <SyncFiltersSection v-else-if="activeSection === 'sync-filters'" />
        </template>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { PageHeader } from '@/components/common'
import { 
  TaskTypesSection, PeopleSection, EmailsSection, FilesSection, 
  CostGroupsSection, LocationsSection, AppearanceSection, GeneralSection, 
  DisplaySection, KeyBindingsSection, SyncFiltersSection 
} from '@/components/settings'
import SyncStatusIndicator from '@/components/SyncStatusIndicator.vue'
import SyncStatusPanel from '@/components/SyncStatusPanel.vue'
import { useAuth } from '@/composables/useAuth'
import { useUserSettings } from '@/composables/useUserSettings'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { usePeople } from '@/composables/usePeople'
import { useEmails } from '@/composables/useEmails'
import { useFiles } from '@/composables/useFiles'
import { useCostGroups } from '@/composables/useCostGroups'
import { useLocations } from '@/composables/useLocations'
import { useSyncStatus } from '@/composables/useSyncStatus'

const router = useRouter()
const { user, isAdmin, signOut } = useAuth()
const { initialize: initUserSettings } = useUserSettings()
const { syncStatus, overallStatus, isSourceOutdated, isFilesOutdated, isThumbnailsOutdated, isAttachmentsOutdated, headerTooltip, getQueueOkTooltip, getQueuePendingTooltip, getFailedTooltip } = useSyncStatus()

const syncPopupVisible = ref(false)
const toggleSyncPopup = () => { syncPopupVisible.value = !syncPopupVisible.value }

const {
  extractionRun,
  initialize,
  rerunExtraction,
  fetchLatestExtractionRun
} = useTaskTypes()

const {
  personLinkingRun,
  isLinking,
  rerunPersonLinking,
  fetchLatestPersonLinkingRun
} = usePeople()

const {
  projectLinkingRun,
  isLinking: isProjectLinking,
  rerunProjectLinking,
  fetchLatestProjectLinkingRun
} = useEmails()

const {
  fileLinkingRun,
  isLinking: isFileLinking,
  rerunFileLinking,
  fetchLatestFileLinkingRun
} = useFiles()

const {
  costGroupLinkingRun,
  isLinking: isCostGroupLinking,
  rerunCostGroupLinking,
  fetchLatestCostGroupLinkingRun
} = useCostGroups()

const {
  locationLinkingRun,
  isLinking: isLocationLinking,
  rerunLocationLinking,
  fetchLatestLocationLinkingRun
} = useLocations()

// User settings sections (visible to all)
const userSections = [
  { id: 'display', label: 'Display', icon: 'pi pi-sliders-h' },
  { id: 'keybindings', label: 'Key Bindings', icon: 'pi pi-key' }
]

// Admin settings sections (visible to admins only)
const adminSections = [
  { id: 'appearance', label: 'Appearance', icon: 'pi pi-palette' },
  { id: 'integration', label: 'Integration', icon: 'pi pi-cog' },
  { id: 'sync-filters', label: 'Sync Filters', icon: 'pi pi-filter-slash' },
  { id: 'task-types', label: 'Task Types', icon: 'pi pi-tags' },
  { id: 'people', label: 'People', icon: 'pi pi-users' },
  { id: 'emails', label: 'Emails', icon: 'pi pi-envelope' },
  { id: 'files', label: 'Files', icon: 'pi pi-file' },
  { id: 'cost-groups', label: 'Cost Groups', icon: 'pi pi-dollar' },
  { id: 'locations', label: 'Locations', icon: 'pi pi-map-marker' }
]

const activeSection = ref('display')
const isExtracting = ref(false)

// Navigation
const goBack = () => {
  router.push('/')
}

const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

// Extraction
const handleRerunExtraction = async () => {
  isExtracting.value = true
  try {
    const runId = await rerunExtraction()
    console.log('Extraction started with run ID:', runId)
  } catch (error) {
    console.error('Error starting extraction:', error)
  } finally {
    isExtracting.value = false
  }
}

// Person Linking
const handleRerunPersonLinking = async () => {
  try {
    const runId = await rerunPersonLinking()
    console.log('Person linking started with run ID:', runId)
  } catch (error) {
    console.error('Error starting person linking:', error)
  }
}

// Project Linking for Emails
const handleRerunProjectLinking = async () => {
  try {
    const runId = await rerunProjectLinking()
    console.log('Project linking started with run ID:', runId)
  } catch (error) {
    console.error('Error starting project linking:', error)
  }
}

// File Linking
const handleRerunFileLinking = async () => {
  try {
    const runId = await rerunFileLinking()
    console.log('File linking started with run ID:', runId)
  } catch (error) {
    console.error('Error starting file linking:', error)
  }
}

// Cost Group Linking
const handleRerunCostGroupLinking = async () => {
  try {
    const runId = await rerunCostGroupLinking()
    console.log('Cost group linking started with run ID:', runId)
  } catch (error) {
    console.error('Error starting cost group linking:', error)
  }
}

// Location Linking
const handleRerunLocationLinking = async () => {
  try {
    const runId = await rerunLocationLinking()
    console.log('Location linking started with run ID:', runId)
  } catch (error) {
    console.error('Error starting location linking:', error)
  }
}

// Initialize user settings when user becomes available
watch(() => user.value?.id, async (newUserId) => {
  if (newUserId) {
    await initUserSettings(newUserId)
  }
}, { immediate: true })

// Initialize
onMounted(async () => {
  await initialize()
  if (isAdmin.value) {
    await Promise.all([
      fetchLatestExtractionRun(),
      fetchLatestPersonLinkingRun(),
      fetchLatestProjectLinkingRun(),
      fetchLatestFileLinkingRun(),
      fetchLatestCostGroupLinkingRun(),
      fetchLatestLocationLinkingRun()
    ])
  }
})
</script>

<style scoped>
.settings-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  padding: 2rem;
}

.settings-inner {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.settings-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.settings-sidebar {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 1rem 0;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  height: fit-content;
}

.sidebar-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-menu li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.95rem;
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
}

.sidebar-menu li:hover:not(.section-header) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.sidebar-menu li.active {
  background: var(--accent-primary-dark);
  color: var(--text-primary);
  border-left-color: var(--accent-primary);
  font-weight: 500;
}

.sidebar-menu li.section-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  padding: 1rem 1.5rem 0.5rem;
  cursor: default;
  border-left: none;
}

.sidebar-menu li.section-header:first-child {
  padding-top: 0.5rem;
}

.sidebar-menu li i {
  font-size: 1.1rem;
  width: 20px;
}

.settings-content {
  min-width: 0;
}

.sync-status-wrapper {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.sync-popup-container {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 0.5rem;
  z-index: 9999;
}

.home-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s ease;
}

.home-btn i {
  font-size: 1.5rem;
}

.home-btn:hover {
  color: var(--text-primary);
}

@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
  
  .settings-sidebar {
    position: relative;
    top: 0;
  }
  
  .sidebar-menu {
    display: flex;
    flex-wrap: wrap;
    overflow-x: auto;
    padding: 0 1rem;
  }
  
  .sidebar-menu li {
    padding: 0.75rem 1rem;
    border-left: none;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }
  
  .sidebar-menu li.active {
    border-left-color: transparent;
    border-bottom-color: var(--accent-primary);
  }
  
  .sidebar-menu li.section-header {
    width: 100%;
    padding: 0.75rem 1rem 0.25rem;
  }
}
</style>
