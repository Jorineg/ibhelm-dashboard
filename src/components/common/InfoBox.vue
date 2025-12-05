<template>
  <div :class="['info-box', variant]">
    <i :class="iconClass"></i>
    <div class="info-box-content">
      <strong v-if="title">{{ title }}</strong>
      <p v-if="$slots.default"><slot /></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'info' | 'warning' | 'success' | 'error'
  title?: string
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info'
})

const iconClass = computed(() => {
  if (props.icon) return props.icon
  
  switch (props.variant) {
    case 'warning': return 'pi pi-exclamation-circle'
    case 'success': return 'pi pi-check-circle'
    case 'error': return 'pi pi-times-circle'
    default: return 'pi pi-info-circle'
  }
})
</script>

<style scoped>
.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
}

.info-box.info {
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid rgba(74, 158, 255, 0.2);
}

.info-box.info i {
  color: var(--accent-primary);
}

.info-box.warning {
  background: rgba(245, 166, 35, 0.1);
  border: 1px solid rgba(245, 166, 35, 0.2);
}

.info-box.warning i {
  color: #f5a623;
}

.info-box.success {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.info-box.success i {
  color: #4ade80;
}

.info-box.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.info-box.error i {
  color: #ef4444;
}

.info-box i {
  font-size: 1.1rem;
  margin-top: 2px;
  flex-shrink: 0;
}

.info-box-content {
  flex: 1;
}

.info-box-content strong {
  display: block;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.info-box-content p {
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}
</style>

