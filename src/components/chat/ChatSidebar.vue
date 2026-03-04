<template>
  <aside class="chat-sidebar">
    <button class="new-chat-btn" @click="$emit('new-chat')">
      <i class="pi pi-plus"></i>
      New Chat
    </button>

    <div class="session-search-wrap">
      <i class="pi pi-search session-search-icon"></i>
      <input
        :value="search"
        class="session-search"
        placeholder="Search chats..."
        type="text"
        @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
      />
      <button v-if="search" class="session-search-clear" @click="$emit('update:search', '')">
        <i class="pi pi-times"></i>
      </button>
    </div>

    <div class="sessions-list thin-scrollbar">
      <div v-if="loading" class="sidebar-loading">
        <i class="pi pi-spin pi-spinner"></i>
      </div>
      <template v-else>
        <div v-if="!sessions.length && search" class="sidebar-empty">No matches</div>
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === activeId }"
          @click="$emit('select', session.id)"
        >
          <span class="session-title">{{ session.title || 'New Chat' }}</span>
          <button
            class="session-delete"
            @click.stop="$emit('delete', session.id)"
            title="Delete"
          >
            <i class="pi pi-trash"></i>
          </button>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { ChatSession } from '@/composables/useChat'

defineProps<{
  sessions: ChatSession[]
  activeId: string | null
  loading: boolean
  search: string
}>()

defineEmits<{
  'new-chat': []
  'select': [id: string]
  'delete': [id: string]
  'update:search': [value: string]
}>()
</script>

<style scoped>
.chat-sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-primary);
  padding-right: 0.75rem;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.new-chat-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
}

.session-search-wrap {
  position: relative;
  margin-bottom: 0.5rem;
}

.session-search-icon {
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.85rem;
  color: var(--text-muted);
  pointer-events: none;
}

.session-search {
  width: 100%;
  padding: 0.75rem 0.6rem 0.75rem 2rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
}
.session-search:focus { border-color: var(--accent-primary); }
.session-search::placeholder { color: var(--text-muted); }

.session-search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem;
  font-size: 0.75rem;
  line-height: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.session-search-clear:hover { color: var(--text-primary); background: var(--bg-tertiary); }

.sidebar-empty {
  text-align: center;
  padding: 1rem;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
}

.session-item {
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s ease;
  gap: 0.5rem;
}
.session-item:hover { background: var(--bg-secondary); }
.session-item.active { background: var(--bg-tertiary); }

.session-title {
  flex: 1;
  font-size: 1.05rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-item.active .session-title { color: var(--text-primary); }

.session-delete {
  opacity: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem;
  font-size: 0.8rem;
  transition: all 0.1s ease;
  flex-shrink: 0;
}
.session-item:hover .session-delete { opacity: 1; }
.session-delete:hover { color: var(--error-text); }
</style>
