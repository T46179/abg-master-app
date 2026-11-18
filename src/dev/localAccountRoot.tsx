import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../app/App";
import { BackgroundAccount } from "../app/BackgroundAccount";
import { SiteAccountProvider } from "../app/SiteAccountProvider";
import { RegistrationProvider } from "../app/RegistrationProvider";
import { handleCaughtReactError, initMonitoring } from "../core/monitoring";
import { initAnalytics } from "../core/analytics";
import { loadCasesPayload } from "../core/runtime";
import type { RegistrationCallback } from "../core/registrationCallback";
import type { GoogleAccount, GoogleCompletion } from "../core/googleAccount";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeConfig } from "../core/types";
import type { BrowserStorageLike } from "../core/storage";
const loadPayload = (storage: BrowserStorageLike) => loadCasesPayload((_input, init) => fetch("/__account-staging/runtime_bootstrap.json", init), storage);
export function mountLocalAccountRoot(container: HTMLElement, { client, config, callback, google, googleCompletion }: {
  client: SupabaseClient; config: RuntimeConfig; callback: RegistrationCallback | null;
  google: GoogleAccount | null; googleCompletion: GoogleCompletion | null;
}) {
  initMonitoring(); initAnalytics();
  createRoot(container, { onCaughtError: handleCaughtReactError }).render(<StrictMode><SiteAccountProvider client={client}>
    <RegistrationProvider client={client} callback={callback} google={google} googleCompletion={googleCompletion}><BackgroundAccount client={client} config={config} loadPayload={loadPayload}><App /></BackgroundAccount></RegistrationProvider>
  </SiteAccountProvider></StrictMode>);
}
