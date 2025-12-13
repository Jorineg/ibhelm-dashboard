<template>
  <div class="oauth-consent-container">
    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <p>Loading authorization request...</p>
    </div>

    <!-- Error state -->
    <Message v-else-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>

    <!-- Consent form -->
    <Card v-else-if="authDetails" class="consent-card">
      <template #header>
        <div class="consent-header">
          <i class="pi pi-shield"></i>
        </div>
      </template>
      <template #title>
        Authorization Request
      </template>
      <template #subtitle>
        <strong>{{ authDetails.client?.name || 'An application' }}</strong> wants to access your account
      </template>
      <template #content>
        <div class="consent-details">
          <p class="redirect-uri">
            <i class="pi pi-external-link"></i>
            Will redirect to: <code>{{ authDetails.redirect_uri }}</code>
          </p>
          <div v-if="authDetails.scopes?.length" class="scopes-section">
            <h4>This application is requesting permission to:</h4>
            <ul class="scopes-list">
              <li v-for="scope in authDetails.scopes" :key="scope">
                <i class="pi pi-check"></i>
                {{ scopeDescriptions[scope] || scope }}
              </li>
            </ul>
          </div>
          <Message severity="info" :closable="false" class="info-message">
            By clicking "Allow", you authorize this application to access the information listed above.
          </Message>
        </div>
      </template>
      <template #footer>
        <div class="consent-actions">
          <Button 
            label="Deny" 
            severity="secondary" 
            outlined
            :loading="submitting"
            @click="handleDeny"
          />
          <Button 
            label="Allow" 
            severity="success"
            :loading="submitting"
            @click="handleApprove"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'

const route = useRoute()

const loading = ref(true)
const submitting = ref(false)
const error = ref<string | null>(null)
const authDetails = ref<any>(null)

const scopeDescriptions: Record<string, string> = {
  openid: 'Access your user ID',
  profile: 'Access your name and profile picture',
  email: 'Access your email address',
  phone: 'Access your phone number',
}

onMounted(async () => {
  const authorizationId = route.query.authorization_id as string
  
  if (!authorizationId) {
    error.value = 'Missing authorization_id parameter'
    loading.value = false
    return
  }

  // User auth check is handled by router guard which preserves the redirect

  try {
    const { data, error: authError } = await (supabase.auth as any).oauth.getAuthorizationDetails(authorizationId)
    
    if (authError || !data) {
      error.value = authError?.message || 'Invalid authorization request'
      loading.value = false
      return
    }
    
    authDetails.value = data
  } catch (e: any) {
    error.value = e.message || 'Failed to load authorization details'
  }
  
  loading.value = false
})

async function handleApprove() {
  const authorizationId = route.query.authorization_id as string
  submitting.value = true
  
  try {
    const { data, error: approveError } = await (supabase.auth as any).oauth.approveAuthorization(authorizationId)
    
    if (approveError) {
      error.value = approveError.message
      submitting.value = false
      return
    }
    
    if (data?.redirect_to) {
      window.location.href = data.redirect_to
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to approve authorization'
    submitting.value = false
  }
}

async function handleDeny() {
  const authorizationId = route.query.authorization_id as string
  submitting.value = true
  
  try {
    const { data, error: denyError } = await (supabase.auth as any).oauth.denyAuthorization(authorizationId)
    
    if (denyError) {
      error.value = denyError.message
      submitting.value = false
      return
    }
    
    if (data?.redirect_to) {
      window.location.href = data.redirect_to
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to deny authorization'
    submitting.value = false
  }
}
</script>

<style scoped>
.oauth-consent-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: white;
}

.consent-card {
  max-width: 480px;
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
}

.consent-header {
  display: flex;
  justify-content: center;
  padding: 2rem 0 1rem;
}

.consent-header i {
  font-size: 2.5rem;
  color: var(--primary-color);
}

.consent-details {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.redirect-uri {
  font-size: 0.875rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.redirect-uri code {
  background: var(--surface-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  word-break: break-all;
}

.scopes-section h4 {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.scopes-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.scopes-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.scopes-list .pi-check {
  color: var(--green-500);
}

.info-message {
  margin: 0;
}

.consent-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>

