<template>
  <SectionCard :title="title" :description="description">
    <div class="placeholder-content">
      <i :class="icon"></i>
      <p>{{ message }}</p>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { SectionCard } from '@/components/common'

interface Props {
  title: string
  description: string
  icon: string
  message: string
}

defineProps<Props>()
</script>

<style scoped>
.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-tertiary);
}

.placeholder-content i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.placeholder-content p {
  margin: 0;
}
</style>

