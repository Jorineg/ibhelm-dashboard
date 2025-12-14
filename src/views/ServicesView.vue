<template>
  <div class="services-view">
    <!-- Header -->
    <PageHeader
      title="Services"
      :show-back="true"
      :user-email="user?.email"
      :show-sign-out="true"
      @back="goBack"
      @sign-out="handleSignOut"
    >
      <template #actions>
        <button class="refresh-btn" @click="refreshAll" :disabled="loading" title="Refresh">
          <i class="pi" :class="loading ? 'pi-spin pi-spinner' : 'pi-refresh'" />
        </button>
        <button class="home-btn" @click="goBack" title="Home">
          <i class="pi pi-home"></i>
        </button>
      </template>
    </PageHeader>

    <!-- Scrollable Content -->
    <div class="services-inner">
      <!-- Main Content with Sidebar -->
      <div class="services-layout">
        <!-- Sidebar Navigation -->
        <nav class="services-sidebar">
          <ul class="sidebar-menu">
            <li 
              v-for="section in sections" 
              :key="section.id"
              :class="{ active: activeSection === section.id }"
              @click="activeSection = section.id"
            >
              <i :class="section.icon"></i>
              <span>{{ section.label }}</span>
            </li>
          </ul>
        </nav>

        <!-- Services Content -->
        <div class="services-content">
          <!-- Overview Section -->
          <ServiceOverviewSection
            v-if="activeSection === 'overview'"
            :services="services"
            :loading="loading"
            :error="error"
            :selected-service="selectedService"
            :get-display-name="getServiceDisplayName"
            @select="selectService"
            @refresh="fetchServices"
          />

          <!-- Service Detail Sections -->
          <ServiceDetailSection
            v-else-if="activeSection.startsWith('service-')"
            :service="currentServiceStatus"
            :display-name="currentServiceDisplayName"
            :is-loading="operationLoading[selectedService || ''] || false"
            :logs="currentLogs"
            :logs-loading="logsLoading"
            @start="handleStart"
            @stop="handleStop"
            @restart="handleRestart"
            @update="handleUpdate"
            @refresh-logs="handleRefreshLogs"
          />

          <!-- Configuration Section -->
          <ConfigurationSection
            v-else-if="activeSection === 'configuration'"
            :configs-by-category="configsByCategory"
            :loading="configLoading"
            @create="handleCreateConfig"
            @update="handleUpdateConfig"
            @delete="handleDeleteConfig"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PageHeader } from '@/components/common'
import { ServiceOverviewSection, ServiceDetailSection, ConfigurationSection } from '@/components/services'
import { useAuth } from '@/composables/useAuth'
import { useServices, type ServiceConfig } from '@/composables/useServices'

const router = useRouter()
const { user, signOut } = useAuth()
const {
  services,
  configurations,
  loading,
  configLoading,
  error,
  operationLoading,
  configsByCategory,
  fetchServices,
  fetchConfigurations,
  startService,
  stopService,
  restartService,
  updateService,
  getServiceLogs,
  createConfig,
  updateConfig,
  deleteConfig,
  getServiceDisplayName
} = useServices()

// Navigation sections
const sections = computed(() => [
  { id: 'overview', label: 'Overview', icon: 'pi pi-th-large' },
  ...services.value.map(s => ({
    id: `service-${s.name}`,
    label: getServiceDisplayName(s.name),
    icon: getServiceIcon(s.name)
  })),
  { id: 'configuration', label: 'Configuration', icon: 'pi pi-cog' }
])

const activeSection = ref('overview')
const selectedService = ref<string | null>(null)
const currentLogs = ref('')
const logsLoading = ref(false)

const currentServiceStatus = computed(() => {
  if (!selectedService.value) return null
  return services.value.find(s => s.name === selectedService.value) || null
})

const currentServiceDisplayName = computed(() => {
  if (!selectedService.value) return 'Service Details'
  return getServiceDisplayName(selectedService.value)
})

const getServiceIcon = (name: string) => {
  const icons: Record<string, string> = {
    'teamworkmissiveconnector': 'pi pi-sync',
    'thumbnailtextextractor': 'pi pi-image',
    'mcp': 'pi pi-server',
    'supabase': 'pi pi-database'
  }
  return icons[name] || 'pi pi-box'
}

// Select a service from overview
const selectService = (name: string) => {
  selectedService.value = name
  activeSection.value = `service-${name}`
  loadLogs(name)
}

// Watch for section changes
watch(activeSection, (section) => {
  if (section.startsWith('service-')) {
    const name = section.replace('service-', '')
    selectedService.value = name
    loadLogs(name)
  }
})

// Load logs for a service
const loadLogs = async (name: string, container?: string) => {
  logsLoading.value = true
  try {
    currentLogs.value = await getServiceLogs(name, 200, container)
  } finally {
    logsLoading.value = false
  }
}

// Refresh all data
const refreshAll = async () => {
  await Promise.all([fetchServices(), fetchConfigurations()])
}

// Service operations
const handleStart = async (name: string) => {
  const result = await startService(name)
  if (!result.success) {
    console.error('Start failed:', result.message)
  }
}

const handleStop = async (name: string) => {
  const result = await stopService(name)
  if (!result.success) {
    console.error('Stop failed:', result.message)
  }
}

const handleRestart = async (name: string) => {
  const result = await restartService(name)
  if (!result.success) {
    console.error('Restart failed:', result.message)
  }
}

const handleUpdate = async (name: string) => {
  const result = await updateService(name)
  if (!result.success) {
    console.error('Update failed:', result.message)
  }
}

const handleRefreshLogs = (name: string, container?: string) => {
  loadLogs(name, container)
}

// Config operations
const handleCreateConfig = async (config: Partial<ServiceConfig>) => {
  try {
    await createConfig(config as any)
  } catch (e) {
    console.error('Create config failed:', e)
  }
}

const handleUpdateConfig = async (key: string, updates: Partial<ServiceConfig>) => {
  try {
    await updateConfig(key, updates)
  } catch (e) {
    console.error('Update config failed:', e)
  }
}

const handleDeleteConfig = async (key: string) => {
  try {
    await deleteConfig(key)
  } catch (e) {
    console.error('Delete config failed:', e)
  }
}

// Navigation
const goBack = () => {
  router.push('/')
}

const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

// Initialize
onMounted(async () => {
  await refreshAll()
})
</script>

<style scoped>
.services-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  padding: 2rem;
}

.services-inner {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

/* Services Layout */
.services-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* Sidebar */
.services-sidebar {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 1rem 0;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  height: fit-content;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
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

/* Services Content */
.services-content {
  min-width: 0;
}

/* Action buttons */
.refresh-btn,
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

.refresh-btn i,
.home-btn i {
  font-size: 1.5rem;
}

.refresh-btn:hover:not(:disabled),
.home-btn:hover {
  color: var(--text-primary);
}

.refresh-btn:disabled {
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 900px) {
  .services-layout {
    grid-template-columns: 1fr;
  }
  
  .services-sidebar {
    position: relative;
    top: 0;
    max-height: none;
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

