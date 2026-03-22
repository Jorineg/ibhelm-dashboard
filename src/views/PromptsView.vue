<template>
  <div class="prompts-view">
    <PageHeader title="Prompts" :show-back="true" @back="router.push('/')">
      <template #actions>
        <Tooltip text="Home" position="bottom">
          <button class="home-btn" @click="router.push('/')">
            <i class="pi pi-home"></i>
          </button>
        </Tooltip>
      </template>
    </PageHeader>

    <div class="prompts-layout">
      <!-- Sidebar -->
      <nav class="prompts-sidebar">
        <div class="category-tabs">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="cat-tab"
            :class="{ active: activeCategory === cat.id }"
            @click="activeCategory = cat.id"
          >
            <i :class="cat.icon"></i>
            {{ cat.label }}
          </button>
        </div>

        <div class="template-list">
          <div
            v-for="t in filteredTemplates"
            :key="t.id"
            class="template-item"
            :class="{ active: selected?.id === t.id }"
            @click="selectTemplate(t)"
          >
            <span class="template-id">{{ t.id }}</span>
            <span class="template-title">{{ t.title }}</span>
          </div>
          <div v-if="!filteredTemplates.length && !loading" class="empty-list">
            No templates in this category
          </div>
        </div>

        <button v-if="isAdmin" class="new-btn" @click="startCreate">
          <i class="pi pi-plus"></i> New Template
        </button>
      </nav>

      <!-- Content Area -->
      <div class="prompts-content">
        <template v-if="selected">
          <!-- Toolbar -->
          <div class="content-toolbar">
            <div class="toolbar-left">
              <h2>{{ selected.title }}</h2>
              <span class="template-badge">{{ selected.id }}</span>
              <span v-if="selected.is_system" class="system-badge">system</span>
            </div>
            <div class="toolbar-right">
              <div v-if="deps.length" class="deps-info">
                <span class="deps-label">includes:</span>
                <span
                  v-for="d in deps"
                  :key="d"
                  class="dep-link"
                  @click="jumpTo(d)"
                >{{ d }}</span>
              </div>
              <div v-if="usedBy.length" class="deps-info">
                <span class="deps-label">used by:</span>
                <span
                  v-for="u in usedBy"
                  :key="u"
                  class="dep-link"
                  @click="jumpTo(u)"
                >{{ u }}</span>
              </div>
              <button
                v-if="canEdit"
                class="mode-btn"
                :class="{ active: editing }"
                @click="toggleEdit"
              >
                <i :class="editing ? 'pi pi-eye' : 'pi pi-pencil'"></i>
                {{ editing ? 'Preview' : 'Edit' }}
              </button>
              <button
                v-if="editing && hasChanges"
                class="save-btn"
                @click="handleSave"
                :disabled="saving"
              >
                <i class="pi pi-check"></i>
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
              <button
                v-if="editing"
                class="insert-btn"
                @click="showInsertMenu = !showInsertMenu"
              >
                <i class="pi pi-link"></i>
                Insert
              </button>
            </div>
          </div>

          <!-- Insert menu dropdown -->
          <div v-if="showInsertMenu" class="insert-dropdown">
            <div class="insert-section" v-for="cat in insertCategories" :key="cat.id">
              <div class="insert-section-header">{{ cat.label }}</div>
              <div
                v-for="t in cat.items"
                :key="t.id"
                class="insert-item"
                @click="insertReference(t.id)"
              >
                {{ t.id }}
              </div>
            </div>
          </div>

          <!-- Edit / Preview pane -->
          <div class="content-pane">
            <div v-if="editing" class="editor-pane">
              <!-- Metadata fields -->
              <div class="meta-fields">
                <label>
                  <span>ID</span>
                  <input v-model="editId" :disabled="!isCreating" class="meta-input" />
                </label>
                <label>
                  <span>Title</span>
                  <input v-model="editTitle" class="meta-input" />
                </label>
                <label>
                  <span>Description</span>
                  <input v-model="editDescription" class="meta-input" />
                </label>
              </div>
              <div ref="editorContainer" class="cm-container"></div>
            </div>
            <div v-else class="preview-pane" v-html="renderedPreview"></div>
          </div>
        </template>
        <div v-else class="no-selection">
          <i class="pi pi-file-edit"></i>
          <p>Select a template from the sidebar</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { PageHeader, Tooltip } from '@/components/common'
import { useAuth } from '@/composables/useAuth'
import { usePromptTemplates, type PromptTemplate } from '@/composables/usePromptTemplates'
import { renderMarkdown } from '@/composables/useMarkdown'

import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'

const router = useRouter()
const { isAdmin } = useAuth()
const {
  templates, prompts, components, docs,
  loading, fetchAll, save, remove, getDependencies, getUsedBy,
} = usePromptTemplates()

type Category = 'prompt' | 'component' | 'doc'

const categories = [
  { id: 'prompt' as Category, label: 'Prompts', icon: 'pi pi-comments' },
  { id: 'component' as Category, label: 'Components', icon: 'pi pi-th-large' },
  { id: 'doc' as Category, label: 'Docs', icon: 'pi pi-book' },
]

const activeCategory = ref<Category>('prompt')
const selected = ref<PromptTemplate | null>(null)
const editing = ref(false)
const saving = ref(false)
const isCreating = ref(false)
const showInsertMenu = ref(false)

const editId = ref('')
const editTitle = ref('')
const editDescription = ref('')
const editContent = ref('')

const deps = ref<string[]>([])
const usedBy = ref<string[]>([])

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)

const filteredTemplates = computed(() => {
  const map: Record<Category, PromptTemplate[]> = {
    prompt: prompts.value,
    component: components.value,
    doc: docs.value,
  }
  return map[activeCategory.value] || []
})

const canEdit = computed(() => {
  if (!selected.value) return false
  if (selected.value.owner_id === null) return isAdmin.value
  return true
})

const hasChanges = computed(() => {
  if (!selected.value) return false
  const currentContent = editorView.value?.state.doc.toString() ?? editContent.value
  return (
    editTitle.value !== selected.value.title ||
    editDescription.value !== (selected.value.description || '') ||
    currentContent !== selected.value.content ||
    (isCreating.value && editId.value !== selected.value.id)
  )
})

const insertCategories = computed(() => [
  { id: 'component', label: 'Components', items: components.value },
  { id: 'doc', label: 'Docs', items: docs.value },
])

const renderedPreview = computed(() => {
  if (!selected.value) return ''
  return renderMarkdown(selected.value.content || '*No content*')
})

function selectTemplate(t: PromptTemplate) {
  editing.value = false
  isCreating.value = false
  showInsertMenu.value = false
  selected.value = t
  editId.value = t.id
  editTitle.value = t.title
  editDescription.value = t.description || ''
  editContent.value = t.content

  getDependencies(t.id).then(d => deps.value = d).catch(() => deps.value = [])
  getUsedBy(t.id).then(u => usedBy.value = u).catch(() => usedBy.value = [])
}

function startCreate() {
  const newTemplate: PromptTemplate = {
    id: `${activeCategory.value}.new_template`,
    owner_id: null,
    title: 'New Template',
    category: activeCategory.value,
    content: '',
    description: '',
    is_system: false,
    db_created_at: new Date().toISOString(),
    db_updated_at: new Date().toISOString(),
  }
  selected.value = newTemplate
  isCreating.value = true
  editing.value = true
  editId.value = newTemplate.id
  editTitle.value = newTemplate.title
  editDescription.value = ''
  editContent.value = ''
  deps.value = []
  usedBy.value = []
}

function toggleEdit() {
  if (editing.value) {
    // Switching to preview — update selected content from editor
    if (editorView.value) {
      const content = editorView.value.state.doc.toString()
      if (selected.value) selected.value = { ...selected.value, content }
    }
  }
  editing.value = !editing.value
  showInsertMenu.value = false
}

async function handleSave() {
  if (!selected.value) return
  saving.value = true
  try {
    const content = editorView.value?.state.doc.toString() ?? editContent.value
    await save({
      id: isCreating.value ? editId.value : selected.value.id,
      title: editTitle.value,
      description: editDescription.value || null,
      content,
      category: selected.value.category,
    } as any)
    if (isCreating.value) {
      await fetchAll()
      const created = templates.value.find(t => t.id === editId.value)
      if (created) selectTemplate(created)
      isCreating.value = false
    } else {
      selected.value = { ...selected.value, title: editTitle.value, description: editDescription.value, content }
    }
  } catch (e: any) {
    alert('Save failed: ' + e.message)
  } finally {
    saving.value = false
  }
}

function insertReference(templateId: string) {
  if (!editorView.value) return
  const directive = `{{include:${templateId}}}`
  const pos = editorView.value.state.selection.main.head
  editorView.value.dispatch({
    changes: { from: pos, insert: directive },
    selection: { anchor: pos + directive.length },
  })
  showInsertMenu.value = false
  editorView.value.focus()
}

function jumpTo(templateId: string) {
  const t = templates.value.find(x => x.id === templateId)
  if (t) {
    activeCategory.value = t.category
    nextTick(() => selectTemplate(t))
  }
}

function initEditor() {
  if (!editorContainer.value) return
  editorView.value?.destroy()

  const state = EditorState.create({
    doc: editContent.value,
    extensions: [
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      markdown(),
      sql(),
      oneDark,
      EditorView.lineWrapping,
      cmPlaceholder('Start typing your template content...'),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
      }),
    ],
  })

  editorView.value = new EditorView({
    state,
    parent: editorContainer.value,
  })
}

watch(editing, (isEditing) => {
  if (isEditing) {
    nextTick(initEditor)
  } else {
    editorView.value?.destroy()
    editorView.value = null
  }
})

watch(selected, () => {
  if (editing.value) {
    nextTick(initEditor)
  }
})

onMounted(() => {
  fetchAll()
})
</script>

<style scoped>
.prompts-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 2rem 2rem 0;
  overflow: hidden;
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
  font-size: 1.3rem;
}
.home-btn:hover { color: var(--text-primary); }

.prompts-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 1px;
  background: var(--border-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* Sidebar */
.prompts-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.category-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-primary);
}

.cat-tab {
  flex: 1;
  padding: 0.75rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
.cat-tab:hover { color: var(--text-secondary); }
.cat-tab.active {
  color: var(--text-primary);
  background: var(--bg-primary);
  font-weight: 600;
}

.template-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.template-item {
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s ease;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.template-item:hover { background: var(--bg-tertiary); }
.template-item.active {
  background: var(--accent-primary-transparent, rgba(99, 102, 241, 0.12));
  border-left: 3px solid var(--accent-primary);
}

.template-id {
  font-size: 0.8rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: var(--text-secondary);
}
.template-title {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
}

.empty-list {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.new-btn {
  margin: 0.5rem;
  padding: 0.6rem;
  border: 1px dashed var(--border-secondary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: all 0.15s ease;
}
.new-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

/* Content */
.prompts-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  position: relative;
}

.content-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.toolbar-left h2 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.template-badge {
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
}
.system-badge {
  font-size: 0.7rem;
  color: var(--accent-primary);
  background: var(--accent-primary-transparent, rgba(99, 102, 241, 0.1));
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-transform: uppercase;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.deps-info {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
.deps-label { font-weight: 500; }
.dep-link {
  color: var(--accent-primary);
  cursor: pointer;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.dep-link:hover { text-decoration: underline; }

.mode-btn, .save-btn, .insert-btn {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: all 0.15s ease;
}
.mode-btn:hover, .insert-btn:hover {
  border-color: var(--text-tertiary);
  color: var(--text-primary);
}
.mode-btn.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.save-btn {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
.save-btn:hover {
  background: var(--accent-primary);
  color: white;
}
.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Insert dropdown */
.insert-dropdown {
  position: absolute;
  top: 3.5rem;
  right: 1.25rem;
  z-index: 100;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  max-height: 300px;
  overflow-y: auto;
  min-width: 200px;
}
.insert-section-header {
  padding: 0.5rem 0.75rem 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.insert-item {
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: var(--text-secondary);
  cursor: pointer;
}
.insert-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Content pane */
.content-pane {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.preview-pane {
  padding: 1.5rem 2rem;
  line-height: 1.7;
  color: var(--text-primary);
}
.preview-pane :deep(h1) { font-size: 1.4rem; margin: 1.5rem 0 0.75rem; }
.preview-pane :deep(h2) { font-size: 1.2rem; margin: 1.25rem 0 0.6rem; }
.preview-pane :deep(h3) { font-size: 1.05rem; margin: 1rem 0 0.5rem; }
.preview-pane :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: var(--bg-tertiary);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.85em;
}
.preview-pane :deep(pre) {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  padding: 1rem;
  overflow-x: auto;
}
.preview-pane :deep(pre code) {
  background: none;
  padding: 0;
}
.preview-pane :deep(ul), .preview-pane :deep(ol) {
  padding-left: 1.5rem;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.meta-fields {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}
.meta-fields label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}
.meta-fields label span {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
}
.meta-input {
  padding: 0.4rem 0.6rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
}
.meta-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}
.meta-input:disabled {
  opacity: 0.5;
}

.cm-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* No selection placeholder */
.no-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  gap: 0.75rem;
}
.no-selection i { font-size: 3rem; }
.no-selection p { font-size: 1rem; }
</style>
