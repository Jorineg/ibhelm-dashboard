<template>
  <div class="reset-container">
    <div class="reset-card">
      <div class="reset-header">
        <h1>Reset Password</h1>
        <p v-if="!success">Enter your new password</p>
      </div>
      
      <div class="reset-content">
        <div v-if="!success">
          <div class="input-group">
            <label for="password">New Password</label>
            <InputText 
              id="password"
              v-model="password" 
              type="password" 
              placeholder="••••••••"
              class="full-input"
              :disabled="loading"
              @keyup.enter="$refs.confirmInput?.focus()"
            />
          </div>
          
          <div class="input-group">
            <label for="confirm">Confirm Password</label>
            <InputText 
              ref="confirmInput"
              id="confirm"
              v-model="confirmPassword" 
              type="password" 
              placeholder="••••••••"
              class="full-input"
              :disabled="loading"
              @keyup.enter="handleReset"
            />
          </div>
          
          <Button 
            label="Update Password" 
            icon="pi pi-check" 
            @click="handleReset"
            :loading="loading"
            :disabled="!password || !confirmPassword || loading"
            class="submit-button"
            size="large"
          />
        </div>

        <div v-else class="success-message">
          <i class="pi pi-check-circle"></i>
          <h3>Password Updated</h3>
          <p>Your password has been successfully reset.</p>
          <Button 
            label="Go to Dashboard" 
            icon="pi pi-home" 
            @click="goHome"
            class="submit-button"
            size="large"
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
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { updatePassword } = useAuth()

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

onMounted(() => {
  // Supabase handles the token from the URL automatically via onAuthStateChange
  console.log('[ResetPasswordView] mounted')
})

const handleReset = async () => {
  if (!password.value || !confirmPassword.value) return
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }
  
  loading.value = true
  error.value = ''
  
  try {
    await updatePassword(password.value)
    success.value = true
  } catch (err: any) {
    error.value = err.message || 'Failed to update password'
  } finally {
    loading.value = false
  }
}

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.reset-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
}

.reset-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  padding: 3rem;
  max-width: 450px;
  width: 100%;
  border: 1px solid var(--border-primary);
}

.reset-header {
  text-align: center;
  margin-bottom: 2rem;
}

.reset-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.reset-header p {
  color: var(--text-secondary);
  font-size: 1rem;
}

.reset-content {
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
  margin-bottom: 1.5rem;
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

