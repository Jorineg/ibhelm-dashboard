// Database types based on schema
export interface Task {
  id: number
  task_id: string
  name: string | null
  description: string | null
  status: string | null
  priority: string | null
  progress: number | null
  project_id: number | null
  tasklist_id: number | null
  created_by_id: number | null
  updated_by_id: number | null
  parent_task: string | null
  start_date: string | null
  due_date: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  estimate_minutes: number | null
  accumulated_estimated_minutes: number | null
  source_links: any
  raw_data: any
  db_created_at: string | null
  db_updated_at: string | null
  
  // Relations (joined data)
  project?: Project
  tasklist?: Tasklist
  assignees?: User[]
  tags?: Tag[]
}

export interface Email {
  id: string
  conversation_id: string
  subject: string | null
  preview: string | null
  body: string | null
  type: string | null
  email_message_id: string | null
  from_contact_id: number | null
  delivered_at: string | null
  created_at: string | null
  updated_at: string | null
  raw_data: any
  db_created_at: string | null
  db_updated_at: string | null
  
  // Relations
  conversation?: Conversation
  from_contact?: Contact
  recipients?: MessageRecipient[]
  attachments?: Attachment[]
}

export interface Project {
  id: number
  name: string
  description: string | null
  company_id: number | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  
  // Relations
  company?: Company
}

export interface Company {
  id: number
  name: string
  email_one: string | null
  phone: string | null
  address_one: string | null
  city: string | null
}

export interface Tasklist {
  id: number
  name: string
  description: string | null
  project_id: number | null
}

export interface User {
  id: number
  first_name: string | null
  last_name: string | null
  email: string | null
  company_id: number | null
}

export interface Tag {
  id: number
  name: string
  color: string | null
}

export interface Conversation {
  id: string
  subject: string | null
  latest_message_subject: string | null
  team_id: string | null
  last_activity_at: string | null
}

export interface Contact {
  id: number
  name: string | null
  email: string
}

export interface MessageRecipient {
  id: number
  message_id: string
  recipient_type: string
  contact_id: number | null
  contact?: Contact
}

export interface Attachment {
  id: string
  message_id: string
  filename: string | null
  extension: string | null
  url: string | null
  size: number | null
}

// UI types
export type ItemType = 'task' | 'email' | 'craft' | 'file'
export type ViewType = 'items' | 'projects' | 'people'

// Task Types (configurable categories)
export interface TaskType {
  id: string
  name: string
  slug: string
  description?: string
  color?: string
  icon?: string
  is_default: boolean
  display_order: number
  db_created_at?: string
  db_updated_at?: string
}

export interface TaskTypeRule {
  id: string
  task_type_id: string
  teamwork_tag_name: string
  db_created_at?: string
}

// Re-export run types from composables
export type { ExtractionRun } from '@/composables/useTaskTypes'
export type { PersonLinkingRun } from '@/composables/usePeople'
export type { ProjectLinkingRun } from '@/composables/useEmails'
export type { CostGroupLinkingRun } from '@/composables/useCostGroups'
export type { LocationLinkingRun } from '@/composables/useLocations'

export interface AppSettings {
  email_color: string
  craft_color: string
  file_color: string
  craft_space_id?: string
  person_color: string
  project_color: string
  teamwork_base_url?: string
  cost_group_prefixes?: string[]
  location_prefix?: string
  files_bucket?: string
}

export interface DataItem {
  id: string
  type: ItemType
  name: string
  description?: string
  status?: string
  project?: string
  customer?: string  // Company from project (kept for display)
  location?: string
  location_path?: string
  cost_group?: string
  cost_group_code?: string
  due_date?: string
  created_at?: string
  updated_at?: string
  // Task type fields
  task_type_id?: string
  task_type_name?: string
  task_type_slug?: string
  task_type_color?: string
  // File storage
  storage_path?: string
  thumbnail_path?: string
  // Any other fields for display
  [key: string]: any
}

export interface ProjectItem {
  id: number
  name: string
  description?: string
  status?: string
  start_date?: string
  end_date?: string
  company_name?: string
  client_name?: string
  client_email?: string
  nas_folder_path?: string
  internal_notes?: string
  default_location_name?: string
  default_location_path?: string
  default_cost_group_name?: string
  default_cost_group_code?: string
  file_count?: number
  contractor_count?: number
  conversation_count?: number
  task_count?: number
  completed_task_count?: number
  created_at?: string
  updated_at?: string
  extension_created_at?: string
  extension_updated_at?: string
  [key: string]: any
}

export interface PersonItem {
  id: string
  display_name: string
  primary_email?: string
  preferred_contact_method?: string
  is_internal?: boolean
  is_company?: boolean
  notes?: string
  tw_company_id?: number
  tw_company_name?: string
  tw_company_website?: string
  tw_user_id?: number
  tw_user_first_name?: string
  tw_user_last_name?: string
  tw_user_email?: string
  m_contact_id?: number
  m_contact_email?: string
  m_contact_name?: string
  db_created_at?: string
  db_updated_at?: string
  [key: string]: any
}

export type ViewDataItem = DataItem | ProjectItem | PersonItem

// ===== UNIFIED FILTER TYPES =====
// All filters use explicit typed parameters - no dynamic JSONB

// Quick filters (always visible in UI, text inputs)
export interface QuickFilters {
  project?: string
  involved_person?: string
  location?: string
  kostengruppe?: string
  tags?: string
}

// Typed column filters (from "Add Filter" UI)
export interface ColumnFilters {
  // Text contains filters
  name_contains?: string
  description_contains?: string
  customer_contains?: string
  tasklist_contains?: string
  creator_contains?: string
  assigned_to_contains?: string
  
  // Enum filters (in/not in)
  status_in?: string[]
  status_not_in?: string[]
  priority_in?: string[]
  priority_not_in?: string[]
  
  // Date range filters
  due_date_min?: string
  due_date_max?: string
  due_date_is_null?: boolean
  created_at_min?: string
  created_at_max?: string
  updated_at_min?: string
  updated_at_max?: string
  
  // Number range filters
  progress_min?: number
  progress_max?: number
  attachment_count_min?: number
  attachment_count_max?: number
}

// Column type determines which filter controls to show in UI
export type FilterColumnType = 'text' | 'enum' | 'date' | 'number'

// Definition for a filterable column
export interface FilterableColumn {
  field: string
  label: string
  type: FilterColumnType
  // For enum types: list of possible values
  enumValues?: string[]
  // For text: whether it's a contains filter or exact match
  // For number/date: default min/max bounds if any
}

// All filterable columns for unified_items view
// Field is the base name - actual filter keys are derived: {field}_contains, {field}_in, etc.
export const FILTERABLE_COLUMNS: FilterableColumn[] = [
  // Text contains filters
  { field: 'name', label: 'Name', type: 'text' },
  { field: 'description', label: 'Description', type: 'text' },
  { field: 'customer', label: 'Customer', type: 'text' },
  { field: 'tasklist', label: 'Tasklist', type: 'text' },
  { field: 'creator', label: 'Creator', type: 'text' },
  { field: 'assigned_to', label: 'Assigned To', type: 'text' },
  // Enum filters (in/not_in)
  { field: 'status', label: 'Status', type: 'enum', enumValues: ['new', 'active', 'completed', 'reopened', 'deleted'] },
  { field: 'priority', label: 'Priority', type: 'enum', enumValues: ['none', 'low', 'medium', 'high'] },
  // Date range filters (min/max/is_null)
  { field: 'due_date', label: 'Due Date', type: 'date' },
  { field: 'created_at', label: 'Created', type: 'date' },
  { field: 'updated_at', label: 'Updated', type: 'date' },
  // Number range filters (min/max)
  { field: 'progress', label: 'Progress', type: 'number' },
  { field: 'attachment_count', label: 'Attachments', type: 'number' },
]

export interface FilterConfiguration {
  id: string
  name: string
  viewType: ViewType
  showTasks: boolean
  showEmails: boolean
  showCraft: boolean
  showFiles: boolean
  selectedTaskTypes?: string[]  // Task type IDs to show (undefined = all)
  viewMode: 'list' | 'gallery'
  sortConfig?: SortConfig
  // Quick filters (always visible text inputs)
  quickFilters: QuickFilters
  quickFilterOrder?: (keyof QuickFilters)[]  // Custom order for quick filters
  // Typed column filters
  columnFilters: ColumnFilters
  visibleColumns: string[]
  columnOrder: string[]
  columnWidths?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface Column {
  field: string
  header: string
  sortable?: boolean
  filterable?: boolean
  visible?: boolean
  width?: string
}

export interface SortConfig {
  field: string
  order: 'asc' | 'desc'
}

