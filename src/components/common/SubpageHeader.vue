<template>
  <PageHeader
    :title="title"
    show-back
    :user-email="user?.email"
    :show-sign-out="true"
    @back="goHome"
    @sign-out="handleSignOut"
  >
    <template v-if="slots.center" #center>
      <slot name="center" />
    </template>
    <template #actions>
      <slot name="actions-before" />
      <Tooltip text="Home" position="bottom">
        <button type="button" class="subpage-home-btn" @click="goHome">
          <i class="pi pi-home"></i>
        </button>
      </Tooltip>
    </template>
  </PageHeader>
</template>

<script setup lang="ts">
import { useSlots } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from './PageHeader.vue'
import Tooltip from './Tooltip.vue'
import { useAuth } from '@/composables/useAuth'

defineProps<{
  title: string
}>()

const slots = useSlots()
const router = useRouter()
const { user, signOut } = useAuth()

function goHome() {
  router.push('/')
}

async function handleSignOut() {
  await signOut()
  router.push('/login')
}
</script>

<style scoped>
.subpage-home-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s ease;
}

.subpage-home-btn i {
  font-size: 1.5rem;
}

.subpage-home-btn:hover {
  color: var(--text-primary);
}
</style>
