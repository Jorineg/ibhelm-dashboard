<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>ibhelm Dashboard</h1>
        <p>Sign in to continue</p>
      </div>
      
      <div class="login-content">
        <!-- Login Mode Tabs -->
        <div class="login-tabs">
          <button 
            :class="['tab', { active: loginMode === 'magic' }]"
            @click="switchMode('magic')"
          >
            <i class="pi pi-envelope"></i>
            Magic Link
          </button>
          <button 
            :class="['tab', { active: loginMode === 'password' }]"
            @click="switchMode('password')"
          >
            <i class="pi pi-lock"></i>
            Password
          </button>
        </div>

        <!-- Magic Link Mode -->
        <template v-if="loginMode === 'magic'">
          <div v-if="!magicLinkSent">
            <div class="input-group">
              <label for="email">Email address</label>
              <InputText 
                id="email"
                v-model="email" 
                type="email" 
                placeholder="you@example.com"
                class="full-input"
                :disabled="loading"
                @keyup.enter="handleMagicLink"
              />
            </div>
            
            <Button 
              label="Send Magic Link" 
              icon="pi pi-envelope" 
              @click="handleMagicLink"
              :loading="loading"
              :disabled="!email || loading"
              class="submit-button"
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
        </template>

        <!-- Password Mode -->
        <template v-else-if="loginMode === 'password'">
          <div v-if="!resetSent">
            <div class="input-group">
              <label for="email-pw">Email address</label>
              <InputText 
                id="email-pw"
                v-model="email" 
                type="email" 
                placeholder="you@example.com"
                class="full-input"
                :disabled="loading"
                @keyup.enter="$refs.passwordInput?.focus()"
              />
            </div>
            
            <div class="input-group">
              <label for="password">Password</label>
              <InputText 
                ref="passwordInput"
                id="password"
                v-model="password" 
                type="password" 
                placeholder="••••••••"
                class="full-input"
                :disabled="loading"
                @keyup.enter="handlePasswordLogin"
              />
            </div>
            
            <Button 
              label="Sign In" 
              icon="pi pi-sign-in" 
              @click="handlePasswordLogin"
              :loading="loading"
              :disabled="!email || !password || loading"
              class="submit-button"
              size="large"
            />
            
            <div class="forgot-password">
              <Button 
                label="Forgot password?" 
                link 
                @click="handleForgotPassword"
                :disabled="loading"
              />
            </div>
          </div>

          <div v-else class="success-message">
            <i class="pi pi-check-circle"></i>
            <h3>Check your email</h3>
            <p>We've sent a password reset link to <strong>{{ email }}</strong></p>
            <p class="hint">Click the link in the email to reset your password.</p>
            <Button 
              label="Back to login" 
              link 
              @click="resetForm"
              class="resend-button"
            />
          </div>
        </template>
        
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

const { signInWithMagicLink, signInWithPassword, verifyOtp, resetPassword } = useAuth()

type LoginMode = 'magic' | 'password'

const loginMode = ref<LoginMode>('password')
const email = ref('')
const password = ref('')
const otpCode = ref('')
const loading = ref(false)
const error = ref('')
const magicLinkSent = ref(false)
const resetSent = ref(false)

onMounted(() => {
  // Check for error in URL hash (e.g., expired magic link or reset link)
  const hash = window.location.hash
  if (hash.includes('error=')) {
    const params = new URLSearchParams(hash.substring(1))
    const errorCode = params.get('error_code')
    const errorDesc = params.get('error_description')
    
    if (errorCode === 'otp_expired') {
      error.value = 'Link expired. Please request a new one.'
    } else if (errorDesc) {
      error.value = decodeURIComponent(errorDesc.replace(/\+/g, ' '))
    }
    // Clean up URL
    window.history.replaceState(null, '', window.location.pathname)
  }
})

const switchMode = (mode: LoginMode) => {
  loginMode.value = mode
  error.value = ''
  magicLinkSent.value = false
  resetSent.value = false
}

const handleMagicLink = async () => {
  if (!email.value) return
  loading.value = true
  error.value = ''
  
  try {
    await signInWithMagicLink(email.value)
    magicLinkSent.value = true
  } catch (err: any) {
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

const handlePasswordLogin = async () => {
  if (!email.value || !password.value) return
  loading.value = true
  error.value = ''
  
  try {
    await signInWithPassword(email.value, password.value)
  } catch (err: any) {
    error.value = err.message || 'Invalid email or password'
  } finally {
    loading.value = false
  }
}

const handleForgotPassword = async () => {
  if (!email.value) {
    error.value = 'Please enter your email address first'
    return
  }
  loading.value = true
  error.value = ''
  
  try {
    await resetPassword(email.value)
    resetSent.value = true
  } catch (err: any) {
    error.value = err.message || 'Failed to send reset email'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  magicLinkSent.value = false
  resetSent.value = false
  otpCode.value = ''
  password.value = ''
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
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.login-header p {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.login-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.25rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.login-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.full-input {
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 1rem;
}

.submit-button {
  width: 100%;
  justify-content: center;
  padding: 1rem;
}

.forgot-password {
  text-align: center;
  margin-top: 0.5rem;
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
