import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'

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
  const { data: { session } } = await supabase.auth.getSession()
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth && !session) {
    // Store intended destination for redirect after login
    const intendedPath = to.fullPath
    if (intendedPath !== '/') {
      sessionStorage.setItem('auth_redirect', intendedPath)
    }
    next('/login')
  } else if (session) {
    // User is logged in - check for stored redirect (e.g., after magic link)
    const redirect = sessionStorage.getItem('auth_redirect')
    if (redirect && to.fullPath !== redirect) {
      sessionStorage.removeItem('auth_redirect')
      next(redirect)
    } else if (to.path === '/login') {
      next('/')
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router

