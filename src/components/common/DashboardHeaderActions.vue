<template>
  <Tooltip v-if="isAdmin" text="Prompts" position="bottom">
    <button type="button" class="hdr-action-btn" @click="router.push('/prompts')">
      <i class="pi pi-file-edit"></i>
    </button>
  </Tooltip>
  <Tooltip v-if="isAdmin" text="Supabase Studio" position="bottom">
    <a :href="studioUrl" target="_blank" rel="noopener" class="hdr-action-btn">
      <i class="pi pi-database"></i>
    </a>
  </Tooltip>
  <Tooltip text="Settings" position="bottom">
    <button type="button" class="hdr-action-btn hdr-action-btn--settings" @click="router.push('/settings')">
      <i class="pi pi-cog"></i>
    </button>
  </Tooltip>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Tooltip from './Tooltip.vue'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { isAdmin } = useAuth()
const studioUrl = `${window.location.protocol}//studio.${window.location.hostname}`
</script>

<style scoped>
.hdr-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
}

.hdr-action-btn i {
  font-size: 1.4rem;
}

.hdr-action-btn:hover {
  color: var(--accent-primary);
}

.hdr-action-btn--settings i {
  font-size: 1.5rem;
}

.hdr-action-btn--settings:hover {
  color: var(--text-primary);
  transform: rotate(45deg);
}
</style>
