import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

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
      // Check if it's a network or configuration error
      if (err.message?.includes('JSON') || err.name === 'SyntaxError') {
        throw new Error('Unable to connect to authentication service. Please check your configuration.')
      }
      throw new Error(err.message || 'An unexpected error occurred')
    }
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
      
      // After login, check for pending redirects (handles timing issue where session isn't ready during initial router guard)
      if (event === 'SIGNED_IN' && session) {
        console.log('[useAuth] SIGNED_IN event detected, checking for redirects...')
        
        // OAuth consent needs full URL redirect (use localStorage - shared across tabs for magic link)
        const oauthReturn = localStorage.getItem('oauthReturnUrl')
        if (oauthReturn) {
          console.log('[useAuth] Found oauthReturnUrl, redirecting to:', oauthReturn)
          localStorage.removeItem('oauthReturnUrl')
          window.location.href = oauthReturn
          return
        }
        
        // Normal protected route redirect
        const authRedirect = localStorage.getItem('auth_redirect')
        if (authRedirect) {
          const fullUrl = window.location.origin + authRedirect
          console.log('[useAuth] Found auth_redirect, redirecting to:', fullUrl)
          localStorage.removeItem('auth_redirect')
          window.location.href = fullUrl
          return
        }
        
        console.log('[useAuth] No pending redirects found')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  })

  return {
    user,
    loading,
    signInWithMagicLink,
    signOut,
    checkAuth
  }
}
