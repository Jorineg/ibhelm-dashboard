import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// Immediate log to verify this file is loaded
console.log('[useAuth] MODULE LOADED', {
  timestamp: new Date().toISOString(),
  oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
  authRedirect: localStorage.getItem('auth_redirect')
})

const user = ref<User | null>(null)
const loading = ref(true)

export function useAuth() {
  const signInWithMagicLink = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      })
      
      if (error) {
        console.error('Error sending magic link:', error)
        throw new Error(error.message || 'Failed to send magic link')
      }
      
      return data
    } catch (err: any) {
      console.error('Exception sending magic link:', err)
      if (err.message?.includes('JSON') || err.name === 'SyntaxError') {
        throw new Error('Unable to connect to authentication service. Please check your configuration.')
      }
      throw new Error(err.message || 'An unexpected error occurred')
    }
  }

  const verifyOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'magiclink' })
    if (error) throw new Error(error.message || 'Invalid code')
    return data
  }

  const signInWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message || 'Invalid email or password')
    return data
  }

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw new Error(error.message || 'Failed to send reset email')
    return data
  }

  const updatePassword = async (password: string) => {
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message || 'Failed to update password')
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
      throw error
    }
    user.value = null
  }

  const checkAuth = async () => {
    console.log('[useAuth] checkAuth START')
    loading.value = true
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    loading.value = false
    console.log('[useAuth] checkAuth DONE', { hasSession: !!session, userId: session?.user?.id })
  }

  onMounted(() => {
    console.log('[useAuth] onMounted', {
      currentUrl: window.location.href,
      oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
      authRedirect: localStorage.getItem('auth_redirect')
    })
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth] onAuthStateChange', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
        authRedirect: localStorage.getItem('auth_redirect')
      })
      
      user.value = session?.user ?? null
      loading.value = false
      
      // Handle session loss (logout, token refresh failure, session expired)
      if (event === 'SIGNED_OUT') {
        console.log('[useAuth] SIGNED_OUT event - redirecting to login')
        if (window.location.pathname !== '/login') {
          window.location.href = `${window.location.origin}/login`
        }
        return
      }
      
      // After login, handle cross-tab auth sync
      if (event === 'SIGNED_IN' && session) {
        console.log('[useAuth] SIGNED_IN event detected')
        
        // If on login page, just redirect to home
        // The magic link tab handles OAuth redirect via router guard (avoids double-processing)
        if (window.location.pathname === '/login') {
          console.log('[useAuth] On login page, redirecting to home')
          window.location.href = window.location.origin
          return
        }
        
        console.log('[useAuth] Not on login page, letting router handle redirects')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  })

  // Check if user has admin role
  const isAdmin = computed(() => {
    return user.value?.app_metadata?.role === 'admin'
  })

  return {
    user,
    loading,
    isAdmin,
    signInWithMagicLink,
    signInWithPassword,
    verifyOtp,
    resetPassword,
    updatePassword,
    signOut,
    checkAuth
  }
}
