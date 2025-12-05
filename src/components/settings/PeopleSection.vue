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
    <div class="linking-controls">
      <div class="linking-info">
        <div class="linking-status" v-if="personLinkingRun">
          <span class="status-label">Last linking run:</span>
          <StatusBadge :status="personLinkingRun.status" />
          <span v-if="personLinkingRun.status === 'running'" class="progress-info">
            {{ personLinkingRun.processed_count }} / {{ personLinkingRun.total_count }}
            ({{ personLinkingRun.progress_percent }}%)
          </span>
          <span v-else-if="personLinkingRun.completed_at" class="time-info">
            {{ formatDate(personLinkingRun.completed_at) }}
          </span>
        </div>
        <div v-else class="linking-status">
          <span class="status-label">No linking runs yet</span>
        </div>
      </div>
      
      <Button
        label="Link All Existing Contacts & Users"
        icon="pi pi-link"
        :loading="isLinking"
        @click="$emit('rerun-linking')"
        severity="secondary"
        class="rerun-btn"
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

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.linking-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.linking-info {
  flex: 1;
}

.linking-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-label {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.progress-info,
.time-info {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.run-statistics {
  margin-bottom: 1.5rem;
}
</style>

