<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>dbhelm Dashboard</h1>
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 3rem;
  max-width: 400px;
  width: 100%;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 0.5rem;
}

.login-header p {
  color: #666;
  font-size: 1rem;
}

.login-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.google-button {
  width: 100%;
  justify-content: center;
}

.error-message {
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 6px;
  font-size: 0.875rem;
  text-align: center;
}
</style>

