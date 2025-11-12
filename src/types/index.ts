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
export type ItemType = 'task' | 'email'

export interface DataItem {
  id: string
  type: ItemType
  name: string
  description?: string
  status?: string
  project?: string
  customer?: string
  building?: string
  floor?: string
  room?: string
  kostengruppe?: string
  due_date?: string
  created_at?: string
  updated_at?: string
  // Any other fields for display
  [key: string]: any
}

export type FilterOperator = 
  | 'eq' 
  | 'neq' 
  | 'contains' 
  | 'not_contains' 
  | 'is_empty' 
  | 'is_not_empty' 
  | 'before' 
  | 'after'

export interface ColumnFilter {
  id: string
  column: string
  operator: FilterOperator
  value: string
}

export interface FilterConfiguration {
  id: string
  name: string
  showTasks: boolean
  showEmails: boolean
  viewMode: 'list' | 'gallery'
  alwaysVisibleFilters: {
    project?: string
    customer?: string
    building?: string
    floor?: string
    room?: string
    kostengruppe?: string
  }
  dynamicFilters: ColumnFilter[]
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

