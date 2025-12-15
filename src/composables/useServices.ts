import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

// Types
export interface ContainerStatus {
  name: string
  status: string
  container_id: string | null
  image: string | null
  started_at: string | null
  health_status: string | null
  exit_code: number | null
  restart_count: number
  cpu_percent: number | null
  memory_mb: number | null
  memory_limit_mb: number | null
  error: string | null
}

export interface ServiceStatus {
  name: string
  status: string
  total_memory_mb: number | null
  error: string | null
  containers: ContainerStatus[]
}

export interface ServiceConfig {
  id: string
  key: string
  value: string
  is_secret: boolean
  scope: string[]
  category: string | null
  description: string | null
  updated_at: string
}

// Service Agent URL - should match your deployment
const SERVICE_AGENT_URL = import.meta.env.VITE_SERVICE_AGENT_URL || 'http://localhost:8100'

// State
const services = ref<ServiceStatus[]>([])
const configurations = ref<ServiceConfig[]>([])
const loading = ref(false)
const configLoading = ref(false)
const error = ref<string | null>(null)
const operationLoading = ref<Record<string, boolean>>({})

export function useServices() {
  // Get auth token for API calls
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      console.error('[useServices] No session/token available')
      throw new Error('Not authenticated')
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  // Check if current user is admin
  const isAdmin = computed(() => {
    // This will be populated from the user's app_metadata
    return true // For now, assume admin - will be checked by agent anyway
  })

  // Fetch all services status
  const fetchServices = async () => {
    loading.value = true
    error.value = null
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${SERVICE_AGENT_URL}/services`, { headers })
      
      if (!response.ok) {
        const text = await response.text()
        console.error('[useServices] fetchServices failed:', response.status, text)
        throw new Error(`Failed to fetch services: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      services.value = data.services
    } catch (e: any) {
      error.value = e.message
      console.error('[useServices] Error fetching services:', e)
    } finally {
      loading.value = false
    }
  }

  // Fetch all configurations
  const fetchConfigurations = async () => {
    configLoading.value = true
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${SERVICE_AGENT_URL}/config`, { headers })
      
      if (!response.ok) {
        const text = await response.text()
        console.error('[useServices] fetchConfigurations failed:', response.status, text)
        if (response.status === 403) {
          console.warn('[useServices] User is not admin, hiding configurations')
          configurations.value = []
          return
        }
        throw new Error(`Failed to fetch configurations: ${response.status}`)
      }
      
      const data = await response.json()
      configurations.value = data.configurations || []
    } catch (e: any) {
      console.error('[useServices] Error fetching configurations:', e)
      configurations.value = []
    } finally {
      configLoading.value = false
    }
  }

  // Service operations
  const startService = async (name: string): Promise<{ success: boolean; message: string }> => {
    operationLoading.value[name] = true
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${SERVICE_AGENT_URL}/services/${name}/start`, {
        method: 'POST',
        headers
      })
      
      const result = await response.json()
      await fetchServices() // Refresh status
      return result
    } finally {
      operationLoading.value[name] = false
    }
  }

  const stopService = async (name: string): Promise<{ success: boolean; message: string }> => {
    operationLoading.value[name] = true
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${SERVICE_AGENT_URL}/services/${name}/stop`, {
        method: 'POST',
        headers
      })
      
      const result = await response.json()
      await fetchServices()
      return result
    } finally {
      operationLoading.value[name] = false
    }
  }

  const restartService = async (name: string): Promise<{ success: boolean; message: string }> => {
    operationLoading.value[name] = true
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${SERVICE_AGENT_URL}/services/${name}/restart`, {
        method: 'POST',
        headers
      })
      
      const result = await response.json()
      await fetchServices()
      return result
    } finally {
      operationLoading.value[name] = false
    }
  }

  const updateService = async (name: string): Promise<{ success: boolean; message: string }> => {
    operationLoading.value[name] = true
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${SERVICE_AGENT_URL}/services/${name}/update`, {
        method: 'POST',
        headers
      })
      
      const result = await response.json()
      await fetchServices()
      return result
    } finally {
      operationLoading.value[name] = false
    }
  }

  // Get service logs
  const getServiceLogs = async (name: string, lines: number = 100, container?: string): Promise<string> => {
    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ lines: lines.toString() })
      if (container) params.append('container', container)
      
      const response = await fetch(`${SERVICE_AGENT_URL}/services/${name}/logs?${params}`, { headers })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.logs
    } catch (e: any) {
      console.error('Error fetching logs:', e)
      return `Error: ${e.message}`
    }
  }

  // Configuration operations
  const createConfig = async (config: Omit<ServiceConfig, 'id' | 'updated_at'>): Promise<ServiceConfig> => {
    const headers = await getAuthHeaders()
    const response = await fetch(`${SERVICE_AGENT_URL}/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to create config: ${response.statusText}`)
    }
    
    const result = await response.json()
    await fetchConfigurations()
    return result
  }

  const updateConfig = async (key: string, updates: Partial<ServiceConfig>): Promise<ServiceConfig> => {
    const headers = await getAuthHeaders()
    const response = await fetch(`${SERVICE_AGENT_URL}/config/${key}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to update config: ${response.statusText}`)
    }
    
    const result = await response.json()
    await fetchConfigurations()
    return result
  }

  const deleteConfig = async (key: string): Promise<void> => {
    const headers = await getAuthHeaders()
    const response = await fetch(`${SERVICE_AGENT_URL}/config/${key}`, {
      method: 'DELETE',
      headers
    })
    
    if (!response.ok) {
      throw new Error(`Failed to delete config: ${response.statusText}`)
    }
    
    await fetchConfigurations()
  }

  // Group configurations by category
  const configsByCategory = computed(() => {
    const grouped: Record<string, ServiceConfig[]> = {}
    for (const config of configurations.value) {
      const category = config.category || 'uncategorized'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(config)
    }
    return grouped
  })

  // Get service display info
  const getServiceDisplayName = (name: string): string => {
    const names: Record<string, string> = {
      'teamworkmissiveconnector': 'Teamwork Missive Connector',
      'thumbnailtextextractor': 'Thumbnail Text Extractor',
      'mcp': 'MCP Server',
      'supabase': 'Supabase'
    }
    return names[name] || name
  }

  return {
    // State
    services,
    configurations,
    loading,
    configLoading,
    error,
    operationLoading,
    isAdmin,
    configsByCategory,
    
    // Methods
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
  }
}

