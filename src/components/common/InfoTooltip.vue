<template>
  <div class="info-tooltip-wrapper" ref="wrapperRef">
    <button
      type="button"
      class="info-icon-btn"
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
      tabindex="0"
    >
      <i class="pi pi-info-circle" />
    </button>
    <Teleport to="body">
      <Transition name="info-tt">
        <div v-if="visible" class="info-tooltip" :style="posStyle">
          <slot />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

const GAP = 6

interface Props {
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom'
})

const visible = ref(false)
const wrapperRef = ref<HTMLElement>()
const posStyle = ref<Record<string, string>>({})

function computePosition() {
  if (!wrapperRef.value) return
  const r = wrapperRef.value.getBoundingClientRect()

  switch (props.position) {
    case 'bottom':
      posStyle.value = { top: `${r.bottom + GAP}px`, left: `${r.right}px`, transform: 'translateX(-100%)' }
      break
    case 'top':
      posStyle.value = { bottom: `${window.innerHeight - r.top + GAP}px`, left: `${r.right}px`, transform: 'translateX(-100%)' }
      break
    case 'left':
      posStyle.value = { top: `${r.top + r.height / 2}px`, left: `${r.left - GAP}px`, transform: 'translate(-100%, -50%)' }
      break
    case 'right':
      posStyle.value = { top: `${r.top + r.height / 2}px`, left: `${r.right + GAP}px`, transform: 'translateY(-50%)' }
      break
  }
}

async function show() {
  computePosition()
  visible.value = true
  await nextTick()
  clampToViewport()
}

function hide() {
  visible.value = false
}

function clampToViewport() {
  const el = document.querySelector('.info-tooltip') as HTMLElement
  if (!el) return
  const rect = el.getBoundingClientRect()
  const pad = 8
  if (rect.left < pad) {
    posStyle.value = { ...posStyle.value, left: `${pad}px`, transform: posStyle.value.transform?.replace('translateX(-100%)', '') || '' }
  }
  if (rect.right > window.innerWidth - pad) {
    posStyle.value = { ...posStyle.value, left: `${window.innerWidth - pad - rect.width}px`, transform: posStyle.value.transform?.replace('translateX(-100%)', '') || '' }
  }
}
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
</style>

<style>
/* Global styles (not scoped) since tooltip is teleported to body */
.info-tooltip {
  position: fixed;
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

.info-tooltip strong {
  color: var(--text-primary);
  font-weight: 600;
  display: block;
  margin-bottom: 0.35rem;
}

.info-tooltip ul {
  margin: 0;
  padding-left: 1rem;
}

.info-tooltip li {
  margin: 0.15rem 0;
}

.info-tt-enter-active,
.info-tt-leave-active {
  transition: opacity 0.15s ease;
}

.info-tt-enter-from,
.info-tt-leave-to {
  opacity: 0;
}
</style>
