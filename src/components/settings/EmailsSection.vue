<template>
  <SectionCard
    title="Emails"
    description="Manage automatic project assignment for email conversations based on Missive labels."
  >
    <template #header-info>
      <InfoBox title="How auto-linking works:">
        When a conversation is added in Missive or a label is assigned to a conversation, the system automatically 
        links it to projects whose names match the label names. Multiple projects can be linked if multiple 
        labels match different project names.
      </InfoBox>
    </template>

    <!-- Project Linking Controls -->
    <div class="run-controls">
      <div class="run-info">
        <div class="run-status" v-if="projectLinkingRun">
          <span class="run-status-label">Last linking run:</span>
          <StatusBadge :status="projectLinkingRun.status" />
          <span v-if="projectLinkingRun.status === 'running'" class="run-progress-info">
            {{ projectLinkingRun.processed_count }} / {{ projectLinkingRun.total_count }}
            ({{ projectLinkingRun.progress_percent }}%)
          </span>
          <span v-else-if="projectLinkingRun.completed_at" class="run-time-info">
            {{ formatDate(projectLinkingRun.completed_at) }}
          </span>
        </div>
        <div v-else class="run-status">
          <span class="run-status-label">No linking runs yet</span>
        </div>
      </div>
      
      <Button
        label="Link All Existing Conversations to Projects"
        icon="pi pi-link"
        :loading="isLinking"
        @click="$emit('rerun-linking')"
        severity="secondary"
      />
    </div>

    <!-- Last Run Statistics -->
    <StatsGrid
      v-if="projectLinkingRun && projectLinkingRun.status === 'completed'"
      title="Last Run Results"
      :stats="linkingStats"
      class="run-statistics"
    />

    <!-- Note about when to use -->
    <InfoBox variant="warning" title="When to use this:">
      This button is typically not needed because new conversations are automatically linked when they are added 
      or when labels are assigned. Use this only if you have existing conversations that were imported before 
      the auto-linking feature was enabled, or if project names were changed after labels were created.
    </InfoBox>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { SectionCard, InfoBox, StatusBadge, StatsGrid } from '@/components/common'
import { formatDate } from '@/lib/formatDate'
import type { ProjectLinkingRun } from '@/types'

interface Props {
  projectLinkingRun: ProjectLinkingRun | null
  isLinking: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'rerun-linking'): void
}>()

const linkingStats = computed(() => {
  if (!props.projectLinkingRun) return []
  return [
    { label: 'Conversations Processed', value: props.projectLinkingRun.total_count || 0 },
    { label: 'New Links Created', value: props.projectLinkingRun.linked_count || 0, variant: 'created' as const },
    { label: 'No Match / Already Linked', value: props.projectLinkingRun.skipped_count || 0, variant: 'skipped' as const }
  ]
})
</script>
