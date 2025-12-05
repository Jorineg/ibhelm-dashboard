<template>
  <section class="section-card">
    <div v-if="title || description" class="section-header">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="description" class="section-description">{{ description }}</p>
      <slot name="header-info" />
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  description?: string
}

defineProps<Props>()
</script>

<style scoped>
.section-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: var(--shadow-md);
}

.section-header {
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.section-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
}
</style>

