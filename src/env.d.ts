/// <reference types="vite/client" />

declare const __BUILD_TIMESTAMP__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SERVICE_AGENT_URL?: string
  readonly VITE_LOGTAIL_TOKEN?: string
  readonly VITE_LOGTAIL_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

