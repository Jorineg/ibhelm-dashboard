<template>
  <SectionCard
    title="Files"
    description="Manage automatic metadata extraction for files based on their paths."
  >
    <template #header-info>
      <InfoBox title="How auto-extraction works:">
        When a file is added or updated, the system automatically extracts metadata from the file path:
        <ul class="extraction-list">
          <li><strong>Email Attachment:</strong> Links to email if filename matches a downloaded attachment</li>
          <li><strong>Project:</strong> Assigns to projects whose names appear in the file path</li>
          <li><strong>Cost Group:</strong> Extracts cost group codes (e.g., KGR 430) from path segments</li>
          <li><strong>Document Type:</strong> Assigns document type if name appears in the path</li>
        </ul>
      </InfoBox>
    </template>

    <!-- File Linking Controls -->
    <div class="run-controls">
      <div class="run-info">
        <div class="run-status" v-if="fileLinkingRun">
          <span class="run-status-label">Last linking run:</span>
          <StatusBadge :status="fileLinkingRun.status" />
          <span v-if="fileLinkingRun.status === 'running'" class="run-progress-info">
            {{ fileLinkingRun.processed_count }} / {{ fileLinkingRun.total_count }}
            ({{ fileLinkingRun.progress_percent }}%)
          </span>
          <span v-else-if="fileLinkingRun.completed_at" class="run-time-info">
            {{ formatDate(fileLinkingRun.completed_at) }}
          </span>
        </div>
        <div v-else class="run-status">
          <span class="run-status-label">No linking runs yet</span>
        </div>
      </div>
      
      <Button
        label="Re-extract Metadata for All Files"
        icon="pi pi-refresh"
        :loading="isLinking"
        @click="$emit('rerun-linking')"
        severity="secondary"
      />
    </div>

    <!-- Last Run Statistics -->
    <StatsGrid
      v-if="fileLinkingRun && fileLinkingRun.status === 'completed'"
      title="Last Run Results"
      :stats="linkingStats"
      class="run-statistics"
    />

    <!-- Note about when to use -->
    <InfoBox variant="warning" title="When to use this:">
      Use this button if you have imported files before the auto-extraction feature was enabled,
      if project names have changed, if you've added new document types, or if cost group prefixes
      were updated in settings.
    </InfoBox>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { SectionCard, InfoBox, StatusBadge, StatsGrid } from '@/components/common'
import { formatDate } from '@/lib/formatDate'
import type { FileLinkingRun } from '@/composables/useFiles'

interface Props {
  fileLinkingRun: FileLinkingRun | null
  isLinking: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'rerun-linking'): void
}>()

const linkingStats = computed(() => {
  if (!props.fileLinkingRun) return []
  return [
    { label: 'Files Processed', value: props.fileLinkingRun.total_count || 0 },
    { label: 'Attachment Links', value: props.fileLinkingRun.linked_count || 0, variant: 'linked' as const },
    { label: 'New Associations', value: props.fileLinkingRun.created_count || 0, variant: 'created' as const }
  ]
})
</script>

<style scoped>
.extraction-list {
  margin: 0.5rem 0 0 1.5rem;
  padding: 0;
}

.extraction-list li {
  margin: 0.25rem 0;
}
</style>

