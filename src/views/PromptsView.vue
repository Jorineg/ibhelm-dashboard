<template>
  <div class="prompts-view">
    <SubpageHeader title="Prompts" />

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
          <Tooltip
            v-for="t in filteredTemplates"
            :key="t.id"
            :text="(t.summary || '').trim()"
            position="right"
            block
          >
            <div
              class="template-item"
              :class="{ active: selected?.id === t.id }"
              @click="selectTemplate(t)"
            >
              <span class="template-title">{{ t.title }}</span>
            </div>
          </Tooltip>
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
              <span v-if="selected.prompt_role" class="role-badge">{{ selected.prompt_role }}</span>
              <span v-if="selected.hidden" class="hidden-badge">hidden</span>
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
              <Tooltip
                v-for="t in cat.items"
                :key="t.id"
                :text="insertItemTooltip(t)"
                position="left"
                block
              >
                <div class="insert-item" @click="insertReference(t.id)">
                  {{ t.title }}
                </div>
              </Tooltip>
            </div>
          </div>

          <!-- Metadata bar -->
          <div v-if="selected.summary || (selected.tags && selected.tags.length) || (selected.db_functions && selected.db_functions.length) || (selected.py_functions && selected.py_functions.length)" class="meta-bar">
            <span v-if="selected.summary" class="meta-bar-summary">{{ selected.summary }}</span>
            <span v-for="tag in (selected.tags || [])" :key="tag" class="meta-tag">{{ tag }}</span>
            <span v-for="fn in (selected.db_functions || [])" :key="'db:'+fn" class="meta-fn db-fn">{{ fn }}</span>
            <span v-for="fn in (selected.py_functions || [])" :key="'py:'+fn" class="meta-fn py-fn">{{ fn }}</span>
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
                  <span>Summary</span>
                  <input v-model="editSummary" class="meta-input" placeholder="Short summary for index listings" />
                </label>
                <div class="meta-row">
                  <label>
                    <span>Tags</span>
                    <input v-model="editTags" class="meta-input" placeholder="comma-separated" />
                  </label>
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="editHidden" />
                    <span>Hidden</span>
                  </label>
                  <label v-if="activeCategory === 'prompt'">
                    <span>Role</span>
                    <select v-model="editPromptRole" class="meta-input">
                      <option :value="null">–</option>
                      <option value="system">system</option>
                      <option value="user">user</option>
                    </select>
                  </label>
                </div>
                <template v-if="activeCategory === 'skill'">
                  <div class="meta-row">
                    <label>
                      <span>DB Functions</span>
                      <input v-model="editDbFunctions" class="meta-input" placeholder="comma-separated" />
                    </label>
                    <label>
                      <span>PY Functions</span>
                      <input v-model="editPyFunctions" class="meta-input" placeholder="comma-separated" />
                    </label>
                  </div>
                </template>
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
import { SubpageHeader, Tooltip } from '@/components/common'
import { useAuth } from '@/composables/useAuth'
import { usePromptTemplates, type PromptTemplate } from '@/composables/usePromptTemplates'
import { renderMarkdown } from '@/composables/useMarkdown'

import { EditorView, keymap, placeholder as cmPlaceholder, ViewPlugin, Decoration, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'

const { isAdmin } = useAuth()
const {
  templates, prompts, skills, docs,
  loading, fetchAll, save, remove, getDependencies, getUsedBy,
} = usePromptTemplates()

type Category = 'prompt' | 'skill' | 'doc'

const categories = [
  { id: 'prompt' as Category, label: 'Prompts', icon: 'pi pi-comments' },
  { id: 'skill' as Category, label: 'Skills', icon: 'pi pi-bolt' },
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
const editSummary = ref('')
const editHidden = ref(false)
const editPromptRole = ref<string | null>(null)
const editTags = ref('')
const editDbFunctions = ref('')
const editPyFunctions = ref('')
const editContent = ref('')

const deps = ref<string[]>([])
const usedBy = ref<string[]>([])

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)

const filteredTemplates = computed(() => {
  const map: Record<Category, PromptTemplate[]> = {
    prompt: prompts.value,
    skill: skills.value,
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
  const s = selected.value
  return (
    editTitle.value !== s.title ||
    editSummary.value !== (s.summary || '') ||
    editHidden.value !== s.hidden ||
    editPromptRole.value !== s.prompt_role ||
    editTags.value !== (s.tags || []).join(', ') ||
    editDbFunctions.value !== (s.db_functions || []).join(', ') ||
    editPyFunctions.value !== (s.py_functions || []).join(', ') ||
    editContent.value !== s.content ||
    (isCreating.value && editId.value !== s.id)
  )
})

const insertCategories = computed(() => [
  { id: 'prompt', label: 'Prompts', items: prompts.value },
  { id: 'skill', label: 'Skills', items: skills.value },
  { id: 'doc', label: 'Docs', items: docs.value },
])

function insertItemTooltip(t: PromptTemplate): string {
  const s = (t.summary || '').trim()
  return s ? `${t.id}\n${s}` : t.id
}

function highlightDirectives(html: string): string {
  html = html.replace(/\{\{(include|sql):([\s\S]*?)\}\}/g, (_, kw, val) => {
    if (kw === 'sql') {
      return `<div class="prompt-dir prompt-sql"><span class="prompt-dir-bk">{{</span><span class="prompt-dir-kw">sql:</span><span class="prompt-dir-val">${val}</span><span class="prompt-dir-bk">}}</span></div>`
    }
    return `<span class="prompt-dir prompt-include"><span class="prompt-dir-bk">{{</span><span class="prompt-dir-kw">include:</span><span class="prompt-dir-val">${val}</span><span class="prompt-dir-bk">}}</span></span>`
  })
  return html.replace(/\$\{(\w+)\}/g, (_, name) =>
    `<span class="prompt-dir prompt-ph"><span class="prompt-dir-bk">\${</span><span class="prompt-dir-val">${name}</span><span class="prompt-dir-bk">}</span></span>`
  )
}

const renderedPreview = computed(() => {
  if (!selected.value) return ''
  return highlightDirectives(renderMarkdown(selected.value.content || '*No content*'))
})

function selectTemplate(t: PromptTemplate) {
  editing.value = false
  isCreating.value = false
  showInsertMenu.value = false
  selected.value = t
  editId.value = t.id
  editTitle.value = t.title
  editSummary.value = t.summary || ''
  editHidden.value = t.hidden
  editPromptRole.value = t.prompt_role
  editTags.value = (t.tags || []).join(', ')
  editDbFunctions.value = (t.db_functions || []).join(', ')
  editPyFunctions.value = (t.py_functions || []).join(', ')
  editContent.value = t.content

  getDependencies(t.id).then(d => deps.value = d).catch(() => deps.value = [])
  getUsedBy(t.id).then(u => usedBy.value = u).catch(() => usedBy.value = [])
}

function startCreate() {
  const newTemplate: PromptTemplate = {
    id: `${activeCategory.value}.new-template`,
    owner_id: null,
    title: 'New Template',
    category: activeCategory.value,
    content: '',
    summary: null,
    hidden: false,
    tags: [],
    prompt_role: null,
    db_functions: [],
    py_functions: [],
    is_system: false,
    db_created_at: new Date().toISOString(),
    db_updated_at: new Date().toISOString(),
  }
  selected.value = newTemplate
  isCreating.value = true
  editing.value = true
  editId.value = newTemplate.id
  editTitle.value = newTemplate.title
  editSummary.value = ''
  editHidden.value = false
  editPromptRole.value = null
  editTags.value = ''
  editDbFunctions.value = ''
  editPyFunctions.value = ''
  editContent.value = ''
  deps.value = []
  usedBy.value = []
}

function toggleEdit() {
  if (editing.value) {
    if (selected.value) selected.value = { ...selected.value, content: editContent.value }
  }
  editing.value = !editing.value
  showInsertMenu.value = false
}

function parseCommaSeparated(s: string): string[] {
  return s ? s.split(',').map(x => x.trim()).filter(Boolean) : []
}

async function handleSave() {
  if (!selected.value) return
  saving.value = true
  try {
    const cat = selected.value.category
    const content = editContent.value
    const updates: Partial<PromptTemplate> & { id: string } = {
      id: isCreating.value ? editId.value : selected.value.id,
      title: editTitle.value,
      summary: editSummary.value || null,
      hidden: editHidden.value,
      tags: parseCommaSeparated(editTags.value),
      content,
      category: cat,
    }
    if (cat === 'prompt') updates.prompt_role = editPromptRole.value || null
    if (cat === 'skill') {
      updates.db_functions = parseCommaSeparated(editDbFunctions.value)
      updates.py_functions = parseCommaSeparated(editPyFunctions.value)
    }
    await save(updates as any)
    if (isCreating.value) {
      await fetchAll()
      const created = templates.value.find(t => t.id === editId.value)
      if (created) selectTemplate(created)
      isCreating.value = false
    } else {
      selected.value = { ...selected.value, ...updates }
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

const bracketMark = Decoration.mark({ class: 'cm-prompt-bracket' })
const placeholderMark = Decoration.mark({ class: 'cm-prompt-placeholder' })
const includeKwMark = Decoration.mark({ class: 'cm-prompt-kw-include' })
const sqlKwMark = Decoration.mark({ class: 'cm-prompt-kw-sql' })
const includeValMark = Decoration.mark({ class: 'cm-prompt-val-include' })
const sqlValMark = Decoration.mark({ class: 'cm-prompt-val-sql' })

function buildPromptDecos(view: EditorView) {
  const text = view.state.doc.toString()
  const ranges: { from: number; to: number; deco: Decoration }[] = []
  let m: RegExpExecArray | null

  const dirRe = /\{\{(include|sql):([\s\S]*?)\}\}/g
  while ((m = dirRe.exec(text))) {
    const s = m.index, e = s + m[0].length, kwEnd = s + 2 + m[1].length + 1
    ranges.push(
      { from: s, to: s + 2, deco: bracketMark },
      { from: s + 2, to: kwEnd, deco: m[1] === 'include' ? includeKwMark : sqlKwMark },
      { from: kwEnd, to: e - 2, deco: m[1] === 'include' ? includeValMark : sqlValMark },
      { from: e - 2, to: e, deco: bracketMark },
    )
  }

  const phRe = /\$\{(\w+)\}/g
  while ((m = phRe.exec(text))) {
    const s = m.index, e = s + m[0].length
    ranges.push(
      { from: s, to: s + 2, deco: bracketMark },
      { from: s + 2, to: e - 1, deco: placeholderMark },
      { from: e - 1, to: e, deco: bracketMark },
    )
  }

  ranges.sort((a, b) => a.from - b.from)
  return Decoration.set(ranges.map(r => r.deco.range(r.from, r.to)))
}

const promptHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = buildPromptDecos(view) }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = buildPromptDecos(update.view)
    }
  },
  { decorations: v => v.decorations }
)

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
      promptHighlightPlugin,
      EditorView.updateListener.of(update => {
        if (update.docChanged) editContent.value = update.state.doc.toString()
      }),
      EditorView.lineWrapping,
      cmPlaceholder('Start typing your template content...'),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
        '.cm-prompt-bracket': { color: '#e5c07b', fontWeight: 'bold' },
        '.cm-prompt-placeholder': { color: '#e06c75' },
        '.cm-prompt-kw-include': { color: '#56b6c2', fontWeight: '600' },
        '.cm-prompt-kw-sql': { color: '#c678dd', fontWeight: '600' },
        '.cm-prompt-val-include': { color: '#61afef' },
        '.cm-prompt-val-sql': { color: '#98c379' },
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
  padding: 0.5rem 0;
}

.template-item {
  display: flex;
  align-items: center;
  padding: 0.875rem 1.25rem;
  margin: 0 0.5rem;
  border-radius: var(--radius-sm);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text-secondary);
  font-size: 0.95rem;
}
.template-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.template-item.active {
  background: var(--accent-primary-dark);
  color: var(--text-primary);
  border-left-color: var(--accent-primary);
  font-weight: 500;
}

.template-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.meta-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.meta-bar-summary {
  flex-basis: 100%;
  font-style: italic;
}
.meta-tag {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
}
.meta-fn {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
}
.db-fn {
  background: rgba(99, 102, 241, 0.1);
  color: var(--accent-primary);
}
.py-fn {
  background: rgba(16, 185, 129, 0.1);
  color: var(--accent-secondary, #10b981);
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
.system-badge, .role-badge, .hidden-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-transform: uppercase;
}
.system-badge {
  color: var(--accent-primary);
  background: var(--accent-primary-transparent, rgba(99, 102, 241, 0.1));
}
.role-badge {
  color: var(--accent-secondary, #10b981);
  background: rgba(16, 185, 129, 0.1);
}
.hidden-badge {
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
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
  color: var(--text-secondary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* Prompt directive highlighting in preview */
.preview-pane :deep(.prompt-dir) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85em;
  border-radius: 4px;
}
.preview-pane :deep(.prompt-dir-bk) {
  opacity: 0.45;
  font-weight: bold;
}
.preview-pane :deep(.prompt-dir-kw) {
  font-weight: 600;
}

/* Inline: placeholders and includes */
.preview-pane :deep(.prompt-ph),
.preview-pane :deep(.prompt-include) {
  display: inline;
  padding: 0.1rem 0.4rem;
}
.preview-pane :deep(.prompt-ph) {
  background: rgba(224, 108, 117, 0.12);
  border: 1px solid rgba(224, 108, 117, 0.25);
  color: #e06c75;
}
.preview-pane :deep(.prompt-include) {
  background: rgba(86, 182, 194, 0.1);
  border: 1px solid rgba(86, 182, 194, 0.25);
}
.preview-pane :deep(.prompt-include .prompt-dir-kw) { color: #56b6c2; }
.preview-pane :deep(.prompt-include .prompt-dir-val) { color: #61afef; }

/* Block: SQL directives */
.preview-pane :deep(.prompt-sql) {
  display: block;
  margin: 0.75rem 0;
  padding: 0.6rem 0.85rem;
  background: rgba(198, 120, 221, 0.08);
  border: 1px solid rgba(198, 120, 221, 0.2);
  border-left: 3px solid rgba(198, 120, 221, 0.5);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
.preview-pane :deep(.prompt-sql .prompt-dir-kw) { color: #c678dd; }
.preview-pane :deep(.prompt-sql .prompt-dir-val) { color: #98c379; }

.editor-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.meta-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}
.meta-fields > label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.meta-fields label span {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
}
.meta-row {
  display: flex;
  gap: 1rem;
  align-items: end;
}
.meta-row > label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}
.checkbox-label {
  flex-direction: row !important;
  align-items: center !important;
  gap: 0.4rem !important;
  flex: 0 !important;
  white-space: nowrap;
  padding-bottom: 0.4rem;
}
.checkbox-label input[type="checkbox"] {
  accent-color: var(--accent-primary);
}
.meta-input, select.meta-input {
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
