<template>
  <div class="info-tooltip-wrapper">
    <button
      type="button"
      class="info-icon-btn"
      @mouseenter="showTooltip = true"
      @mouseleave="showTooltip = false"
      @focus="showTooltip = true"
      @blur="showTooltip = false"
      tabindex="0"
    >
      <i class="pi pi-info-circle" />
    </button>
    <Transition name="tooltip">
      <div v-if="showTooltip" class="info-tooltip" :class="position">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  position?: 'top' | 'bottom' | 'left' | 'right'
}

withDefaults(defineProps<Props>(), {
  position: 'bottom'
})

const showTooltip = ref(false)
</script>

<style scoped>
.info-tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.info-icon-btn {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: help;
  color: var(--text-tertiary);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease;
}

.info-icon-btn:hover,
.info-icon-btn:focus {
  color: var(--accent-primary);
  outline: none;
}

.info-tooltip {
  position: absolute;
  z-index: 9999;
  background: #1a1a1a;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.45;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  width: max-content;
  max-width: 280px;
  pointer-events: none;
}

.info-tooltip.bottom {
  top: calc(100% + 6px);
  right: 0;
}

.info-tooltip.top {
  bottom: calc(100% + 6px);
  right: 0;
}

.info-tooltip.left {
  right: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
}

.info-tooltip.right {
  left: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
}

/* Tooltip content styling */
.info-tooltip :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
  display: block;
  margin-bottom: 0.35rem;
}

.info-tooltip :deep(ul) {
  margin: 0;
  padding-left: 1rem;
}

.info-tooltip :deep(li) {
  margin: 0.15rem 0;
}

/* Tooltip transition */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

.info-tooltip.left.tooltip-enter-from,
.info-tooltip.left.tooltip-leave-to {
  transform: translateY(-50%) translateX(2px);
}

.info-tooltip.right.tooltip-enter-from,
.info-tooltip.right.tooltip-leave-to {
  transform: translateY(-50%) translateX(-2px);
}

.info-tooltip.top.tooltip-enter-from,
.info-tooltip.top.tooltip-leave-to {
  transform: translateY(2px);
}
</style>

