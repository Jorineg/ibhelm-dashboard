<template>
  <header class="page-header">
    <div class="header-left">
      <button v-if="showBack" class="back-btn" @click="$emit('back')">
        <i class="pi pi-arrow-left"></i>
      </button>
      <h1>{{ title }}</h1>
      <slot name="after-title" />
    </div>
    
    <slot name="center" />
    
    <div class="header-actions">
      <slot name="actions" />
      <span v-if="userEmail" class="user-email">{{ userEmail }}</span>
      <Button
        v-if="showSignOut"
        label="Sign Out"
        icon="pi pi-sign-out"
        @click="$emit('sign-out')"
        outlined
        class="sign-out-btn"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

interface Props {
  title: string
  showBack?: boolean
  userEmail?: string
  showSignOut?: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'back'): void
  (e: 'sign-out'): void
}>()
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem 2rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.user-email {
  font-size: 0.9rem;
  color: var(--text-secondary);
}
</style>

