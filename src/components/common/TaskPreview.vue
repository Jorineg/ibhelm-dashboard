<template>
  <div class="task-preview" :class="[taskTypeClass, { completed: isCompleted }]" :style="accentStyle">
    <!-- Completed indicator icon (top right) -->
    <div v-if="isCompleted" class="completed-indicator">
      <i class="pi pi-check-circle" />
    </div>
    
    <!-- Main content area -->
    <div class="task-content">
      <!-- Task name (always shown) -->
      <div class="task-name" :title="name">{{ name }}</div>
      
      <!-- Description (for all types if present) -->
      <div v-if="description && description.trim()" class="task-description" :title="description">
        {{ description }}
      </div>
      
      <!-- TASK type (other): Assignee, Due Date, Progress -->
      <template v-if="isTaskType">
        <div class="task-meta">
          <div v-if="assigneeName" class="meta-row assignee">
            <i class="pi pi-user" />
            <span>{{ assigneeName }}</span>
          </div>
          <div v-if="dueDate" class="meta-row due-date" :class="{ overdue: isOverdue, soon: isDueSoon }">
            <i class="pi pi-calendar" />
            <span>{{ formattedDueDate }}</span>
            <span v-if="isOverdue && !isCompleted" class="overdue-badge">ÜBERFÄLLIG</span>
          </div>
        </div>
        
        <!-- Progress bar -->
        <div v-if="hasProgress" class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <span class="progress-label">{{ progress }}%</span>
        </div>
      </template>
      
      <!-- ANFORDERUNG (info) / HINWEIS (todo): Tags are the focus -->
      <template v-else>
        <div v-if="isTodoType && createdAt" class="meta-row created-date">
          <i class="pi pi-clock" />
          <span>{{ formattedCreatedDate }}</span>
        </div>
        <div v-if="displayTags.length > 0" class="tags-section">
          <span 
            v-for="tag in displayTags" 
            :key="tag.id" 
            class="tag"
            :style="tagStyle(tag)"
            :title="tag.name"
          >
            {{ truncateTag(tag.name) }}
          </span>
        </div>
        <div v-if="hasPriority" class="priority-badge" :class="priority">
          <i class="pi pi-exclamation-triangle" />
          <span>{{ priority?.toUpperCase() }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Tag {
  id: number
  name: string
  color?: string | null
}

interface Assignee {
  id: number
  first_name?: string
  last_name?: string
  email?: string
}

interface Props {
  name: string
  description?: string | null
  taskTypeSlug?: string | null
  taskTypeColor?: string | null
  status?: string | null
  priority?: string | null
  progress?: number | null
  dueDate?: string | null
  createdAt?: string | null
  tags?: Tag[] | string | null
  assignedTo?: Assignee[] | string | null
}

const props = defineProps<Props>()

// Task type detection based on actual slugs: other=Task, info=Anforderung, todo=Hinweis
const isTaskType = computed(() => props.taskTypeSlug === 'other' || !props.taskTypeSlug)
const isInfoType = computed(() => props.taskTypeSlug === 'info')
const isTodoType = computed(() => props.taskTypeSlug === 'todo')

const isCompleted = computed(() => props.status === 'completed')

// Parse JSON strings if needed
const parsedTags = computed<Tag[]>(() => {
  if (!props.tags) return []
  if (typeof props.tags === 'string') {
    try { return JSON.parse(props.tags) } catch { return [] }
  }
  return props.tags
})

const parsedAssignees = computed<Assignee[]>(() => {
  if (!props.assignedTo) return []
  if (typeof props.assignedTo === 'string') {
    try { return JSON.parse(props.assignedTo) } catch { return [] }
  }
  return props.assignedTo
})

// Filter out task type tags from display
const displayTags = computed(() => {
  const typeTagNames = ['anforderung', 'hinweis', 'task', 'protokoll', 'preprotokoll']
  return parsedTags.value.filter(tag => 
    !typeTagNames.includes(tag.name.toLowerCase())
  ).slice(0, 4)
})

const assigneeName = computed(() => {
  const assignee = parsedAssignees.value[0]
  if (!assignee) return null
  const name = [assignee.first_name, assignee.last_name].filter(Boolean).join(' ')
  return name || assignee.email || null
})

const hasProgress = computed(() => 
  props.progress !== null && props.progress !== undefined && props.progress > 0 && props.progress < 100
)

const hasPriority = computed(() => 
  props.priority && props.priority !== 'none' && props.priority !== ''
)

const taskTypeClass = computed(() => {
  if (isInfoType.value) return 'type-info'
  if (isTodoType.value) return 'type-todo'
  return 'type-other'
})

const accentStyle = computed(() => {
  const color = props.taskTypeColor || '#00d5ff'
  return { '--accent-color': color }
})

// Date formatting
const formattedDueDate = computed(() => {
  if (!props.dueDate) return null
  const date = new Date(props.dueDate)
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
})

const formattedCreatedDate = computed(() => {
  if (!props.createdAt) return null
  const date = new Date(props.createdAt)
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
})

const isOverdue = computed(() => {
  if (!props.dueDate || isCompleted.value) return false
  return new Date(props.dueDate) < new Date()
})

const isDueSoon = computed(() => {
  if (!props.dueDate || isCompleted.value || isOverdue.value) return false
  const dueDate = new Date(props.dueDate)
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  return dueDate <= threeDaysFromNow
})

// Tag helpers
const tagStyle = (tag: Tag) => {
  const color = tag.color || '#6b7280'
  return {
    backgroundColor: `${color}22`,
    color: color,
    borderColor: `${color}44`
  }
}

const truncateTag = (name: string) => {
  if (name.length <= 18) return name
  return name.substring(0, 16) + '…'
}
</script>

<style scoped>
.task-preview {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 1.25rem;
  background: var(--bg-secondary);
  position: relative;
  overflow: hidden;
}

/* Accent bar at top */
.task-preview::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent-color);
}

/* Completed indicator icon */
.completed-indicator {
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: #22c55e;
  font-size: 1.5rem;
  z-index: 1;
}

/* Completed tasks - muted style with icon */
.task-preview.completed {
  opacity: 0.65;
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  flex: 1;
  min-height: 0;
}

.task-name {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

/* Prevent overlap with completed icon */
.completed .task-name {
  padding-right: 2rem;
}

/* For Anforderung (info) / Hinweis (todo) - more text lines, slightly smaller */
.type-info .task-name,
.type-todo .task-name {
  -webkit-line-clamp: 4;
  font-size: 1.2rem;
}

/* Task type (other) - space for meta info */
.type-other .task-name {
  -webkit-line-clamp: 2;
}

/* Description */
.task-description {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.type-other .task-description {
  -webkit-line-clamp: 2;
}

.type-info .task-description,
.type-todo .task-description {
  -webkit-line-clamp: 3;
}

/* Meta rows */
.task-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  color: var(--text-secondary);
}

.meta-row i {
  font-size: 0.95rem;
  flex-shrink: 0;
  opacity: 0.8;
}

.meta-row.assignee {
  color: var(--text-primary);
  font-weight: 500;
}

.meta-row.due-date.overdue {
  color: #ef4444;
  font-weight: 500;
}

.meta-row.due-date.soon {
  color: #f59e0b;
}

.overdue-badge {
  font-size: 0.8rem;
  font-weight: 700;
  background: #ef444422;
  color: #ef4444;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.meta-row.created-date {
  font-size: 0.95rem;
  color: var(--text-tertiary);
}

/* Progress bar */
.progress-section {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: auto;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  font-weight: 600;
  min-width: 35px;
}

/* Tags section */
.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: auto;
}

.tag {
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.3rem 0.65rem;
  border-radius: 4px;
  border: 1px solid;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Priority badge */
.priority-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 0.35rem 0.7rem;
  border-radius: 4px;
  width: fit-content;
  margin-top: auto;
}

.priority-badge i {
  font-size: 0.85rem;
}

.priority-badge.high {
  background: #ef444422;
  color: #ef4444;
}

.priority-badge.medium {
  background: #f59e0b22;
  color: #f59e0b;
}

.priority-badge.low {
  background: #3b82f622;
  color: #3b82f6;
}
</style>
