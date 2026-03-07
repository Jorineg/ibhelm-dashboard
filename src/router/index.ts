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
      path: '/services',
      name: 'services',
      component: () => import('@/views/ServicesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
      meta: { requiresAuth: true, chatMode: 'user' }
    },
    {
      path: '/agents',
      name: 'agents',
      component: () => import('@/views/ChatView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, chatMode: 'agent' }
    },
    {
      path: '/activity',
      name: 'activity',
      component: () => import('@/views/ActivityView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
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

router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth && !session) {
    // Use localStorage (not sessionStorage) because magic link opens in new tab
    if (to.path === '/oauth/consent') {
      localStorage.setItem('oauthReturnUrl', window.location.href)
    } else if (to.fullPath !== '/') {
      localStorage.setItem('auth_redirect', to.fullPath)
    }
    next('/login')
  } else if (session) {
    const oauthReturn = localStorage.getItem('oauthReturnUrl')
    if (oauthReturn) {
      localStorage.removeItem('oauthReturnUrl')
      window.location.href = oauthReturn
      return
    }
    const redirect = localStorage.getItem('auth_redirect')
    if (redirect && to.fullPath !== redirect) {
      localStorage.removeItem('auth_redirect')
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

// After a rebuild, chunk hashes change — stale tabs will fail to load old chunks.
// Hard reload to pick up the new assets.
router.onError((error, to) => {
  if (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed')
  ) {
    window.location.assign(to.fullPath)
  }
})

export default router
