<template>
  <div class="oauth-consent-container">
    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <p>Loading authorization request...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="consent-card">
      <div class="error-content">
        <i class="pi pi-times-circle"></i>
        <h2>Authorization Error</h2>
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- Consent form -->
    <div v-else-if="authDetails" class="consent-card">
      <div class="consent-header">
        <i class="pi pi-shield"></i>
        <h1>Authorization Request</h1>
        <p><strong>{{ authDetails.client?.name || 'An application' }}</strong> wants to access your account</p>
      </div>

      <div class="consent-content">
        <div class="redirect-uri">
          <i class="pi pi-external-link"></i>
          <span>Will redirect to: <code>{{ authDetails.redirect_uri }}</code></span>
        </div>

        <div v-if="authDetails.scopes?.length" class="scopes-section">
          <h4>This application is requesting permission to:</h4>
          <ul class="scopes-list">
            <li v-for="scope in authDetails.scopes" :key="scope">
              <i class="pi pi-check"></i>
              {{ scopeDescriptions[scope] || scope }}
            </li>
          </ul>
        </div>

        <div class="info-box">
          <i class="pi pi-info-circle"></i>
          <span>By clicking "Allow", you authorize this application to access the information listed above.</span>
        </div>
      </div>

      <div class="consent-footer">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

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
  console.log('[OAuthConsent] onMounted', {
    fullUrl: window.location.href,
    query: route.query,
    oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
    authRedirect: localStorage.getItem('auth_redirect')
  })
  
  const authorizationId = route.query.authorization_id as string
  
  if (!authorizationId) {
    console.log('[OAuthConsent] Missing authorization_id')
    error.value = 'Missing authorization_id parameter'
    loading.value = false
    return
  }

  console.log('[OAuthConsent] authorization_id:', authorizationId)

  // User auth check is handled by router guard which preserves the redirect

  try {
    const { data, error: authError } = await (supabase.auth as any).oauth.getAuthorizationDetails(authorizationId)
    
    if (authError || !data) {
      error.value = authError?.message || 'Invalid authorization request'
      loading.value = false
      return
    }
    
    // Case 1: GoTrue returns just redirect_url - authorization already processed
    // This happens when user clicks authorize again for an already-approved auth
    if (data.redirect_url && !data.authorization_id) {
      console.log('[OAuthConsent] Already processed, redirecting to:', data.redirect_url)
      window.location.href = data.redirect_url
      return
    }
    
    // Case 2: auto_approved flag set - previous consent exists
    if (data.auto_approved) {
      console.log('[OAuthConsent] Auto-approved! Data:', JSON.stringify(data, null, 2))
      
      // Try redirect_to first
      if (data.redirect_to) {
        console.log('[OAuthConsent] Using redirect_to:', data.redirect_to)
        window.location.href = data.redirect_to
        return
      }
      
      // Fallback: construct redirect URL from authorization data
      // When auto-approved, GoTrue already generated the authorization_code
      if (data.redirect_uri && data.authorization_code) {
        const redirectUrl = new URL(data.redirect_uri)
        redirectUrl.searchParams.set('code', data.authorization_code)
        if (data.state) {
          redirectUrl.searchParams.set('state', data.state)
        }
        console.log('[OAuthConsent] Constructed redirect URL:', redirectUrl.toString())
        window.location.href = redirectUrl.toString()
        return
      }
      
      // Last fallback: show error
      console.error('[OAuthConsent] Auto-approved but cannot redirect. Data:', data)
      error.value = 'Authorization was auto-approved but redirect URL could not be determined'
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
  box-shadow: var(--shadow-xl);
}

.consent-header {
  text-align: center;
  padding: 2.5rem 2.5rem 0;
}

.consent-header i {
  font-size: 3rem;
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  display: block;
}

.consent-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
}

.consent-header p {
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0;
}

.consent-content {
  padding: 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.redirect-uri {
  font-size: 0.875rem;
  color: var(--text-secondary);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.redirect-uri i {
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.redirect-uri code {
  background: var(--bg-tertiary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  word-break: break-all;
}

.scopes-section h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.scopes-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.scopes-list li {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.scopes-list .pi-check {
  color: #22c55e;
  font-size: 0.875rem;
}

.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: #93c5fd;
}

.info-box i {
  flex-shrink: 0;
  font-size: 1rem;
  color: #60a5fa;
}

.consent-footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding: 1.5rem 2.5rem;
  border-top: 1px solid var(--border-primary);
}

.error-content {
  text-align: center;
  padding: 3rem 2.5rem;
}

.error-content i {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 1.5rem;
}

.error-content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
}

.error-content p {
  color: var(--text-secondary);
  margin: 0;
}
</style>

