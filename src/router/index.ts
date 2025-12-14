import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'

// Immediate log to verify this file is loaded
console.log('[Router] MODULE LOADED', { 
  timestamp: new Date().toISOString(),
  oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
  authRedirect: localStorage.getItem('auth_redirect')
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/services',
      name: 'services',
      component: () => import('@/views/ServicesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/oauth/consent',
      name: 'oauth-consent',
      component: () => import('@/views/OAuthConsentView.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

// Auth guard
router.beforeEach(async (to, from, next) => {
  console.log('[Router] beforeEach START', {
    to: to.fullPath,
    from: from.fullPath,
    currentUrl: window.location.href,
    oauthReturnUrl: localStorage.getItem('oauthReturnUrl'),
    authRedirect: localStorage.getItem('auth_redirect')
  })
  
  const { data: { session } } = await supabase.auth.getSession()
  const requiresAuth = to.meta.requiresAuth
  
  console.log('[Router] Session check', {
    hasSession: !!session,
    userId: session?.user?.id,
    requiresAuth
  })

  if (requiresAuth && !session) {
    // For OAuth consent, store full URL for hard redirect after login
    // Use localStorage (not sessionStorage) because magic link opens in new tab
    if (to.path === '/oauth/consent') {
      const fullUrl = window.location.href
      console.log('[Router] Storing oauthReturnUrl:', fullUrl)
      localStorage.setItem('oauthReturnUrl', fullUrl)
    } else if (to.fullPath !== '/') {
      console.log('[Router] Storing auth_redirect:', to.fullPath)
      localStorage.setItem('auth_redirect', to.fullPath)
    }
    console.log('[Router] No session, redirecting to /login')
    next('/login')
  } else if (session) {
    // Check for OAuth return URL first (needs hard redirect)
    const oauthReturn = localStorage.getItem('oauthReturnUrl')
    if (oauthReturn) {
      console.log('[Router] Found oauthReturnUrl, hard redirecting to:', oauthReturn)
      localStorage.removeItem('oauthReturnUrl')
      window.location.href = oauthReturn
      return
    }
    // Check for stored redirect (e.g., after magic link)
    const redirect = localStorage.getItem('auth_redirect')
    if (redirect && to.fullPath !== redirect) {
      console.log('[Router] Found auth_redirect, navigating to:', redirect)
      localStorage.removeItem('auth_redirect')
      next(redirect)
    } else if (to.path === '/login') {
      console.log('[Router] Already logged in, redirecting from /login to /')
      next('/')
    } else {
      console.log('[Router] Proceeding to:', to.fullPath)
      next()
    }
  } else {
    console.log('[Router] No auth required, proceeding to:', to.fullPath)
    next()
  }
})

export default router

