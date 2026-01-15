<template>
  <SectionCard
    title="Emails"
    description="Manage email visibility and automatic project assignment for email conversations."
  >
    <!-- Public Email Addresses Section -->
    <div class="filter-section">
      <h4>Public Email Addresses</h4>
      <p class="section-hint">
        Emails sent to or from these addresses are visible to all users. Use this for shared mailboxes 
        like info@company.com or support@company.com.
      </p>
      
      <div class="filter-list">
        <div v-for="email in publicEmailAddresses" :key="email" class="filter-item">
          <span class="filter-name">{{ email }}</span>
          <button type="button" class="remove-btn" @click="removePublicEmail(email)">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div v-if="publicEmailAddresses.length === 0" class="empty-state">
          No public email addresses configured
        </div>
      </div>
      
      <div class="add-row">
        <input
          v-model="newEmailInput"
          type="email"
          class="email-input"
          placeholder="Enter email address..."
          @keydown.enter="addPublicEmail"
        />
        <button type="button" class="add-btn" @click="addPublicEmail" :disabled="!isValidEmail">
          <i class="pi pi-plus"></i>
          Add
        </button>
      </div>
    </div>

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

    <span v-if="saving" class="saving-indicator">
      <i class="pi pi-spin pi-spinner"></i>
    </span>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import { SectionCard, InfoBox, StatusBadge, StatsGrid } from '@/components/common'
import { useAppearanceSettings } from '@/composables/useAppearanceSettings'
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

const { publicEmailAddresses, updatePublicEmailAddresses, saving, initialize } = useAppearanceSettings()

const newEmailInput = ref('')

const isValidEmail = computed(() => {
  const email = newEmailInput.value.trim()
  return email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
})

const addPublicEmail = async () => {
  const email = newEmailInput.value.trim().toLowerCase()
  if (!isValidEmail.value) return
  if (publicEmailAddresses.value.includes(email)) {
    newEmailInput.value = ''
    return
  }
  await updatePublicEmailAddresses([...publicEmailAddresses.value, email])
  newEmailInput.value = ''
}

const removePublicEmail = async (email: string) => {
  await updatePublicEmailAddresses(publicEmailAddresses.value.filter(e => e !== email))
}

const linkingStats = computed(() => {
  if (!props.projectLinkingRun) return []
  return [
    { label: 'Conversations Processed', value: props.projectLinkingRun.total_count || 0 },
    { label: 'New Links Created', value: props.projectLinkingRun.linked_count || 0, variant: 'created' as const },
    { label: 'No Match / Already Linked', value: props.projectLinkingRun.skipped_count || 0, variant: 'skipped' as const }
  ]
})

onMounted(() => initialize())
</script>

<style scoped>
.filter-section {
  margin-bottom: 2rem;
}

.filter-section h4 {
  color: var(--text-primary);
  font-size: 1rem;
  margin: 0 0 0.5rem;
}

.section-hint {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0 0 1rem;
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.filter-name {
  flex: 1;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.remove-btn:hover {
  background: var(--bg-secondary);
  color: var(--danger);
}

.empty-state {
  color: var(--text-tertiary);
  font-size: 0.875rem;
  font-style: italic;
  padding: 0.5rem 0;
}

.add-row {
  display: flex;
  gap: 0.5rem;
}

.email-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease;
}

.email-input:focus {
  border-color: var(--accent-primary);
}

.email-input::placeholder {
  color: var(--text-tertiary);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: var(--accent-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-btn:hover:not(:disabled) {
  background: var(--accent-primary-hover);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.run-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.run-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.run-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.run-status-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.run-progress-info,
.run-time-info {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.run-statistics {
  margin-bottom: 1rem;
}

.saving-indicator {
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: var(--accent-primary);
}
</style>
