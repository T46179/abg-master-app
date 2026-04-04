/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  const __APP_VERSION__: string;

  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __abgAnalyticsInitialized?: boolean;
  }
}

export {};
