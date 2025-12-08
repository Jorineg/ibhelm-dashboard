<template>
  <SectionCard
    title="Cost Groups"
    description="Manage automatic cost group extraction from tags and labels."
  >
    <template #header-info>
      <InfoBox title="How auto-linking works:">
        Tags matching the pattern "PREFIX CODE NAME" (e.g., "KGR 456 Demo Kostengruppe") 
        are automatically linked to cost groups. Parent cost groups (400, 450 for 456) 
        are created automatically based on DIN 276 structure.
      </InfoBox>
    </template>

    <!-- Cost Group Linking Controls -->
    <div class="run-controls">
      <div class="run-info">
        <div class="run-status" v-if="costGroupLinkingRun">
          <span class="run-status-label">Last linking run:</span>
          <StatusBadge :status="costGroupLinkingRun.status" />
          <span v-if="costGroupLinkingRun.status === 'running'" class="run-progress-info">
            {{ costGroupLinkingRun.processed_count }} / {{ costGroupLinkingRun.total_count }}
            ({{ costGroupLinkingRun.progress_percent }}%)
          </span>
          <span v-else-if="costGroupLinkingRun.completed_at" class="run-time-info">
            {{ formatDate(costGroupLinkingRun.completed_at) }}
          </span>
        </div>
        <div v-else class="run-status">
          <span class="run-status-label">No linking runs yet</span>
        </div>
      </div>
      
      <Button
        label="Extract Cost Groups from All Tags"
        icon="pi pi-link"
        :loading="isLinking"
        @click="$emit('rerun-linking')"
        severity="secondary"
      />
    </div>

    <!-- Last Run Statistics -->
    <StatsGrid
      v-if="costGroupLinkingRun && costGroupLinkingRun.status === 'completed'"
      title="Last Run Results"
      :stats="linkingStats"
      class="run-statistics"
    />

    <!-- Note about when to use -->
    <InfoBox variant="warning" title="When to use this:">
      Use this button to scan all existing tasks and email conversations for cost group tags.
      New items are not automatically processed - run this after adding new data or changing 
      cost group prefixes in General settings.
    </InfoBox>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { SectionCard, InfoBox, StatusBadge, StatsGrid } from '@/components/common'
import { formatDate } from '@/lib/formatDate'
import type { CostGroupLinkingRun } from '@/types'

interface Props {
  costGroupLinkingRun: CostGroupLinkingRun | null
  isLinking: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'rerun-linking'): void
}>()

const linkingStats = computed(() => {
  if (!props.costGroupLinkingRun) return []
  return [
    { label: 'Items Processed', value: props.costGroupLinkingRun.total_count || 0 },
    { label: 'Cost Groups Created', value: props.costGroupLinkingRun.created_count || 0, variant: 'created' as const },
    { label: 'New Links Created', value: props.costGroupLinkingRun.linked_count || 0, variant: 'linked' as const }
  ]
})
</script>

