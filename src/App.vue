<template>
  <router-view />
  <div class="version-tag">v0.1.0</div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.version-tag {
  position: fixed;
  bottom: 8px;
  right: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-family: monospace;
  pointer-events: none;
  z-index: 9999;
}
</style>

