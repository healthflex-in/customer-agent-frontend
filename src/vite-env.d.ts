/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_GRAPHQL_URL?: string
  readonly VITE_CONSENT_URL?: string
  readonly VITE_APP_ENV?: 'local' | 'development' | 'staging' | 'production'
  readonly VITE_API_KEY?: string
  readonly VITE_ORGANIZATION_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
