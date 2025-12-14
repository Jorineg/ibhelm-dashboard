<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>ibhelm Dashboard</h1>
        <p>Sign in with your email</p>
      </div>
      
      <div class="login-content">
        <div v-if="!magicLinkSent">
          <div class="input-group">
            <label for="email">Email address</label>
            <InputText 
              id="email"
              v-model="email" 
              type="email" 
              placeholder="you@example.com"
              class="email-input"
              :disabled="loading"
              @keyup.enter="handleSignIn"
            />
          </div>
          
          <Button 
            label="Send Magic Link" 
            icon="pi pi-envelope" 
            @click="handleSignIn"
            :loading="loading"
            :disabled="!email || loading"
            class="magic-link-button"
            size="large"
          />
        </div>

        <div v-else class="success-message">
          <i class="pi pi-check-circle"></i>
          <h3>Check your email</h3>
          <p>We've sent a magic link and code to <strong>{{ email }}</strong></p>
          
          <div class="otp-section">
            <div class="input-group">
              <label for="otp">Enter code from email</label>
              <InputText 
                id="otp"
                v-model="otpCode" 
                placeholder="123456"
                class="otp-input"
                :disabled="loading"
                @keyup.enter="handleVerifyOtp"
              />
            </div>
            <Button 
              label="Verify Code" 
              icon="pi pi-sign-in" 
              @click="handleVerifyOtp"
              :loading="loading"
              :disabled="!otpCode || loading"
              class="verify-button"
            />
          </div>
          
          <p class="hint">Or click the link in the email to sign in.</p>
          <Button 
            label="Send another link" 
            link 
            @click="resetForm"
            class="resend-button"
          />
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useAuth } from '@/composables/useAuth'

const { signInWithMagicLink, verifyOtp } = useAuth()

const email = ref('')
const otpCode = ref('')
const loading = ref(false)
const error = ref('')
const magicLinkSent = ref(false)

onMounted(() => {
  console.log('[LoginView] onMounted', {
    currentUrl: window.location.href,
    oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
    authRedirect: localStorage.getItem('auth_redirect')
  })
})

const handleSignIn = async () => {
  if (!email.value) return
  
  console.log('[LoginView] handleSignIn', {
    email: email.value,
    oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
    authRedirect: localStorage.getItem('auth_redirect')
  })
  
  loading.value = true
  error.value = ''
  
  try {
    await signInWithMagicLink(email.value)
    console.log('[LoginView] Magic link sent successfully')
    magicLinkSent.value = true
  } catch (err: any) {
    console.error('[LoginView] Magic link error:', err)
    error.value = err.message || 'Failed to send magic link'
  } finally {
    loading.value = false
  }
}

const handleVerifyOtp = async () => {
  if (!otpCode.value) return
  loading.value = true
  error.value = ''
  try {
    await verifyOtp(email.value, otpCode.value)
  } catch (err: any) {
    error.value = err.message || 'Invalid code'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  magicLinkSent.value = false
  otpCode.value = ''
  error.value = ''
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
}

.login-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  padding: 3rem;
  max-width: 450px;
  width: 100%;
  border: 1px solid var(--border-primary);
}

.login-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.login-header h1 {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.login-header p {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.login-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.input-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.email-input {
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 1rem;
}

.magic-link-button {
  width: 100%;
  justify-content: center;
  padding: 1rem;
}

.success-message {
  text-align: center;
  padding: 1.5rem;
}

.success-message i {
  font-size: 3rem;
  color: var(--success-text, #22c55e);
  margin-bottom: 1rem;
}

.success-message h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.success-message p {
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.success-message .hint {
  font-size: 0.9rem;
  color: var(--text-tertiary);
}

.otp-section {
  margin: 1.5rem 0;
  text-align: left;
}

.otp-input {
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 1.25rem;
  text-align: center;
  letter-spacing: 0.5em;
}

.verify-button {
  width: 100%;
  justify-content: center;
  padding: 0.875rem;
}

.resend-button {
  margin-top: 1rem;
}

.error-message {
  padding: 1rem;
  background: var(--error-bg);
  color: var(--error-text);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  text-align: center;
  border: 1px solid var(--error-border);
}
</style>
