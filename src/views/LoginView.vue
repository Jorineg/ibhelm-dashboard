<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>ibhelm Dashboard</h1>
        <p>Sign in to continue</p>
      </div>
      
      <div class="login-content">
        <Button 
          label="Sign in with Google" 
          icon="pi pi-google" 
          @click="handleSignIn"
          :loading="loading"
          class="google-button"
          size="large"
        />
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { signInWithGoogle } = useAuth()

const loading = ref(false)
const error = ref('')

const handleSignIn = async () => {
  loading.value = true
  error.value = ''
  
  try {
    await signInWithGoogle()
    // Supabase OAuth will redirect, so we don't need to manually navigate
  } catch (err: any) {
    error.value = err.message || 'Failed to sign in'
    loading.value = false
  }
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

.google-button {
  width: 100%;
  justify-content: center;
  padding: 1rem;
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

