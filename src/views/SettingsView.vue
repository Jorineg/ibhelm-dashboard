<template>
  <div class="settings-view">
    <!-- Header -->
    <PageHeader
      title="Settings"
      :show-back="true"
      :user-email="user?.email"
      :show-sign-out="true"
      @back="goBack"
      @sign-out="handleSignOut"
    />

    <!-- Main Content with Sidebar -->
    <div class="settings-layout">
      <!-- Sidebar Navigation -->
      <nav class="settings-sidebar">
        <ul class="sidebar-menu">
          <li 
            v-for="section in settingsSections" 
            :key="section.id"
            :class="{ active: activeSection === section.id }"
            @click="activeSection = section.id"
          >
            <i :class="section.icon"></i>
            <span>{{ section.label }}</span>
          </li>
        </ul>
      </nav>

      <!-- Settings Content -->
      <div class="settings-content">
        <!-- Task Types Section -->
        <TaskTypesSection
          v-if="activeSection === 'task-types'"
          :extraction-run="extractionRun"
          :is-extracting="isExtracting"
          @rerun-extraction="handleRerunExtraction"
        />

        <!-- People Section -->
        <PeopleSection
          v-else-if="activeSection === 'people'"
          :person-linking-run="personLinkingRun"
          :is-linking="isLinking"
          @rerun-linking="handleRerunPersonLinking"
        />

        <!-- Emails Section -->
        <EmailsSection
          v-else-if="activeSection === 'emails'"
          :project-linking-run="projectLinkingRun"
          :is-linking="isProjectLinking"
          @rerun-linking="handleRerunProjectLinking"
        />

        <!-- Placeholder sections -->
        <PlaceholderSection
          v-else-if="activeSection === 'general'"
          title="General"
          description="General application settings."
          icon="pi pi-cog"
          message="General settings will be available soon."
        />

        <!-- Appearance Section -->
        <AppearanceSection
          v-else-if="activeSection === 'appearance'"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { PageHeader } from '@/components/common'
import { TaskTypesSection, PeopleSection, EmailsSection, AppearanceSection, PlaceholderSection } from '@/components/settings'
import { useAuth } from '@/composables/useAuth'
import { useTaskTypes } from '@/composables/useTaskTypes'
import { usePeople } from '@/composables/usePeople'
import { useEmails } from '@/composables/useEmails'

const router = useRouter()
const { user, signOut } = useAuth()
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

// Settings navigation
const settingsSections = [
  { id: 'task-types', label: 'Task Types', icon: 'pi pi-tags' },
  { id: 'people', label: 'People', icon: 'pi pi-users' },
  { id: 'emails', label: 'Emails', icon: 'pi pi-envelope' },
  { id: 'general', label: 'General', icon: 'pi pi-cog' },
  { id: 'appearance', label: 'Appearance', icon: 'pi pi-palette' }
]
const activeSection = ref('task-types')
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

// Initialize
onMounted(async () => {
  await initialize()
  await Promise.all([
    fetchLatestExtractionRun(),
    fetchLatestPersonLinkingRun(),
    fetchLatestProjectLinkingRun()
  ])
})
</script>

<style scoped>
.settings-view {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 2rem;
}

/* Settings Layout */
.settings-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* Sidebar */
.settings-sidebar {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 1rem 0;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 2rem;
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

.sidebar-menu li:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.sidebar-menu li.active {
  background: var(--accent-primary-dark);
  color: var(--text-primary);
  border-left-color: var(--accent-primary);
  font-weight: 500;
}

.sidebar-menu li i {
  font-size: 1.1rem;
  width: 20px;
}

/* Settings Content */
.settings-content {
  min-width: 0;
}

/* Responsive */
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
}
</style>
