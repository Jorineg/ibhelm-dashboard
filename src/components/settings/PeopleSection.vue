<template>
  <SectionCard
    title="People"
    description="Manage unified persons that connect contacts from Missive and users from Teamwork."
  >
    <template #header-info>
      <InfoBox title="How auto-linking works:">
        When a new contact is added in Missive or a new user is added in Teamwork, the system automatically 
        creates or links them to a unified person based on their email address. If a unified person with the 
        same email already exists, a link is created instead of a duplicate.
      </InfoBox>
    </template>

    <!-- Person Linking Controls -->
    <div class="run-controls">
      <div class="run-info">
        <div class="run-status" v-if="personLinkingRun">
          <span class="run-status-label">Last linking run:</span>
          <StatusBadge :status="personLinkingRun.status" />
          <span v-if="personLinkingRun.status === 'running'" class="run-progress-info">
            {{ personLinkingRun.processed_count }} / {{ personLinkingRun.total_count }}
            ({{ personLinkingRun.progress_percent }}%)
          </span>
          <span v-else-if="personLinkingRun.completed_at" class="run-time-info">
            {{ formatDate(personLinkingRun.completed_at) }}
          </span>
        </div>
        <div v-else class="run-status">
          <span class="run-status-label">No linking runs yet</span>
        </div>
      </div>
      
      <Button
        label="Link All Existing Contacts & Users"
        icon="pi pi-link"
        :loading="isLinking"
        @click="$emit('rerun-linking')"
        severity="secondary"
      />
    </div>

    <!-- Last Run Statistics -->
    <StatsGrid
      v-if="personLinkingRun && personLinkingRun.status === 'completed'"
      title="Last Run Results"
      :stats="linkingStats"
      class="run-statistics"
    />

    <!-- Note about when to use -->
    <InfoBox variant="warning" title="When to use this:">
      This button is typically not needed because new contacts and users are automatically linked when they are added. 
      Use this only if you have existing data that was imported before the auto-linking feature was enabled, 
      or if you suspect some entries were not properly linked.
    </InfoBox>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { SectionCard, InfoBox, StatusBadge, StatsGrid } from '@/components/common'
import { formatDate } from '@/lib/formatDate'
import type { PersonLinkingRun } from '@/types'

interface Props {
  personLinkingRun: PersonLinkingRun | null
  isLinking: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'rerun-linking'): void
}>()

const linkingStats = computed(() => {
  if (!props.personLinkingRun) return []
  return [
    { label: 'Total Processed', value: props.personLinkingRun.total_count || 0 },
    { label: 'New Persons Created', value: props.personLinkingRun.created_count || 0, variant: 'created' as const },
    { label: 'Linked to Existing', value: props.personLinkingRun.linked_count || 0, variant: 'linked' as const },
    { label: 'Already Linked (Skipped)', value: props.personLinkingRun.skipped_count || 0, variant: 'skipped' as const }
  ]
})
</script>
