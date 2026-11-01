import { accountPageFromPath } from "../core/accountRoutes";
import { StrictMode, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../app/App";
import { AppProvider } from "../app/AppProvider";
import { AccountWorkspaceProvider } from "../app/AccountWorkspace";
import { SiteAccountProvider, useSiteAccount } from "../app/SiteAccountProvider";
import { RegistrationProvider, useRegistration, LOCAL_ACCOUNT_URL } from "../app/RegistrationProvider";
import { createRuntimeSupabaseClient } from "../core/supabase";
import { handleCaughtReactError, initMonitoring } from "../core/monitoring";
import { initAnalytics } from "../core/analytics";
import { loadCasesPayload } from "../core/runtime";
import type { RegistrationCallback } from "../core/registrationCallback";
import type { BrowserStorageLike } from "../core/storage";
const config = { SUPABASE_URL: LOCAL_ACCOUNT_URL, SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY };
const client = createRuntimeSupabaseClient(config, { manualCallback: true }).supabase!;
const loadPayload = (storage: BrowserStorageLike) => loadCasesPayload((_input, init) => fetch("/__account-staging/runtime_bootstrap.json", init), storage);
function Workspace({ children }: { children: ReactNode }) {
  const { identity, account } = useSiteAccount();
  const { registrationState } = useRegistration();
  const explicitAccountPage = Boolean(accountPageFromPath(window.location.pathname)) || /^\/dev\/exam-pilot\/?$/.test(window.location.pathname) && (["signin", "completion", "forgot", "reset"].includes(new URLSearchParams(window.location.search).get("account") ?? "") || registrationState.phase !== "idle");
  useEffect(() => {
    if (identity.status !== "signed_out" || !/^\/(practice|dashboard|insights|learn|calibration|featured-case)(\/|$)/.test(window.location.pathname)) return;
    void account.continueAsGuest().catch(() => undefined);
  }, [identity.status, account]);
  if (identity.status === "checking") return <main className="app-shell__page"><p role="status">Checking your account…</p></main>;
  if (identity.status === "unavailable" && !explicitAccountPage) return <main className="app-shell__page"><h1>We couldn't check your account</h1><p>Your saved account has not been replaced.</p><button onClick={() => void account.refresh()}>Try again</button><p><a href="/sign-in">Sign in</a> or <a href="/finish-account">finish account setup</a></p></main>;
  return <AccountWorkspaceProvider key={identity.generation + ":" + (identity.userId ?? "public")} canonical={client} config={config} loadPayload={loadPayload}>
    <AppProvider>{children}</AppProvider>
  </AccountWorkspaceProvider>;
}
export function mountLocalAccountRoot(container: HTMLElement, callback: RegistrationCallback | null) {
  if (import.meta.env.VITE_SUPABASE_URL !== LOCAL_ACCOUNT_URL || import.meta.env.VITE_EXAM_PILOT_SUPABASE_URL !== LOCAL_ACCOUNT_URL) throw new Error("Local account testing requires the staging project.");
  initMonitoring(); initAnalytics();
  createRoot(container, { onCaughtError: handleCaughtReactError }).render(<StrictMode><SiteAccountProvider client={client}>
    <RegistrationProvider client={client} callback={callback}><Workspace><App /></Workspace></RegistrationProvider>
  </SiteAccountProvider></StrictMode>);
}
