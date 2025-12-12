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
  position: relative;
  z-index: 200;
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
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s ease;
  font-size: 1.25rem;
  padding: 0;
}

.back-btn:hover {
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

