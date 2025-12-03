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
    loading.value = true
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    loading.value = false
  }

  onMounted(() => {
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
      loading.value = false
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
