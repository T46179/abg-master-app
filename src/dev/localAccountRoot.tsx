import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../app/App";
import { BackgroundAccount } from "../app/BackgroundAccount";
import { SiteAccountProvider } from "../app/SiteAccountProvider";
import { RegistrationProvider, LOCAL_ACCOUNT_URL } from "../app/RegistrationProvider";
import { createRuntimeSupabaseClient } from "../core/supabase";
import { handleCaughtReactError, initMonitoring } from "../core/monitoring";
import { initAnalytics } from "../core/analytics";
import { loadCasesPayload } from "../core/runtime";
import type { RegistrationCallback } from "../core/registrationCallback";
import type { BrowserStorageLike } from "../core/storage";
const config = { SUPABASE_URL: LOCAL_ACCOUNT_URL, SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY };
const client = createRuntimeSupabaseClient(config, { manualCallback: true }).supabase!;
const loadPayload = (storage: BrowserStorageLike) => loadCasesPayload((_input, init) => fetch("/__account-staging/runtime_bootstrap.json", init), storage);
export function mountLocalAccountRoot(container: HTMLElement, callback: RegistrationCallback | null) {
  if (import.meta.env.VITE_SUPABASE_URL !== LOCAL_ACCOUNT_URL || import.meta.env.VITE_EXAM_PILOT_SUPABASE_URL !== LOCAL_ACCOUNT_URL) throw new Error("Local account testing requires the staging project.");
  initMonitoring(); initAnalytics();
  createRoot(container, { onCaughtError: handleCaughtReactError }).render(<StrictMode><SiteAccountProvider client={client}>
    <RegistrationProvider client={client} callback={callback}><BackgroundAccount client={client} config={config} loadPayload={loadPayload}><App /></BackgroundAccount></RegistrationProvider>
  </SiteAccountProvider></StrictMode>);
}
