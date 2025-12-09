<template>
  <SectionCard
    title="Locations"
    description="Manage automatic location extraction from tags and labels."
  >
    <template #header-info>
      <InfoBox title="How auto-linking works:">
        Tags matching patterns like "O-Gebäude-Raum", "O-Raum", or "O-Gebäude-Level-Raum" 
        are automatically linked to locations. The prefix can be configured in General settings.
      </InfoBox>
    </template>

    <!-- Location Linking Controls -->
    <div class="run-controls">
      <div class="run-info">
        <div class="run-status" v-if="locationLinkingRun">
          <span class="run-status-label">Last linking run:</span>
          <StatusBadge :status="locationLinkingRun.status" />
          <span v-if="locationLinkingRun.status === 'running'" class="run-progress-info">
            {{ locationLinkingRun.processed_count }} / {{ locationLinkingRun.total_count }}
            ({{ locationLinkingRun.progress_percent }}%)
          </span>
          <span v-else-if="locationLinkingRun.completed_at" class="run-time-info">
            {{ formatDate(locationLinkingRun.completed_at) }}
          </span>
        </div>
        <div v-else class="run-status">
          <span class="run-status-label">No linking runs yet</span>
        </div>
      </div>
      
      <Button
        label="Extract Locations from All Tags"
        icon="pi pi-map-marker"
        :loading="isLinking"
        @click="$emit('rerun-linking')"
        severity="secondary"
      />
    </div>

    <!-- Last Run Statistics -->
    <StatsGrid
      v-if="locationLinkingRun && locationLinkingRun.status === 'completed'"
      title="Last Run Results"
      :stats="linkingStats"
      class="run-statistics"
    />

    <!-- Note about when to use -->
    <InfoBox variant="warning" title="When to use this:">
      New items are not automatically processed - run this after adding new data or changing 
      the location prefix in General settings.
    </InfoBox>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { SectionCard, InfoBox, StatusBadge, StatsGrid } from '@/components/common'
import { formatDate } from '@/lib/formatDate'
import type { LocationLinkingRun } from '@/composables/useLocations'

interface Props {
  locationLinkingRun: LocationLinkingRun | null
  isLinking: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'rerun-linking'): void
}>()

const linkingStats = computed(() => {
  if (!props.locationLinkingRun) return []
  return [
    { label: 'Items Processed', value: props.locationLinkingRun.total_count || 0 },
    { label: 'Locations Created', value: props.locationLinkingRun.created_count || 0, variant: 'created' as const },
    { label: 'New Links Created', value: props.locationLinkingRun.linked_count || 0, variant: 'linked' as const }
  ]
})
</script>

