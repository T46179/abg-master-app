import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { SiteAccountProvider, useSiteAccount } from "../app/SiteAccountProvider";
import { AccountWorkspaceProvider } from "../app/AccountWorkspace";
import { AppProvider } from "../app/AppProvider";
import { App } from "../app/App";
import { loadCasesPayload } from "../core/runtime";
import { assertProbeEnvironment } from "./accountStagingProbe";
import type { BrowserStorageLike } from "../core/storage";

export function mountAccountStagingApp(container: HTMLElement) {
  const url = import.meta.env.VITE_EXAM_PILOT_SUPABASE_URL ?? "";
  const key = import.meta.env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY ?? "";
  assertProbeEnvironment(import.meta.env.DEV, location.hostname, url, key);
  const config = { SUPABASE_URL: url, SUPABASE_ANON_KEY: key };
  // Deliberately separate from the isolated email test, legacy pilot and production.
  const client = createClient(url, key, { auth: {
    storageKey: "abgm-site-account-staging-clpfecuohwzwrgmqzeos", detectSessionInUrl: false
  } });
  const loadPayload = (storage: BrowserStorageLike) => loadCasesPayload(
    (_input, init) => fetch("/__account-staging/runtime_bootstrap.json", init), storage);

  function Workspace() {
    const { account, identity } = useSiteAccount();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function run(action: () => Promise<void>) {
      if (busy) return;
      setBusy(true); setError("");
      try { await action(); } catch { setError("This account action could not be completed. Check your details or try again."); }
      finally { setBusy(false); }
    }
    function signIn(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const form = event.currentTarget;
      const email = form.elements.namedItem("email") as HTMLInputElement;
      const password = form.elements.namedItem("password") as HTMLInputElement;
      const value = password.value; password.value = "";
      void run(() => account.signIn(email.value, value));
    }
    const active = identity.userId && ["guest", "verified", "unverified"].includes(identity.status);
    return <>
      <aside aria-label="Temporary staging account controls" style={{ padding: 16, background: "#eef3f5", color: "#152d38" }}>
        <p><strong>Account staging preview</strong> · Temporary controls · {identity.status === "guest" ? "Guest Practice" : identity.email ?? identity.status}</p>
        {identity.status !== "verified" && <form onSubmit={signIn}>
          <label>Email <input name="email" type="email" autoComplete="username" required disabled={busy} /></label>{" "}
          <label>Password <input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label>{" "}
          <button disabled={busy}>Sign in site-wide</button>
        </form>}
        {active ? <button disabled={busy} onClick={() => void run(() => account.signOut())}>Sign out site-wide</button>
          : identity.status === "signed_out" ? <button disabled={busy} onClick={() => void run(() => account.continueAsGuest())}>Continue as guest</button>
          : <button disabled={busy} onClick={() => void run(() => account.refresh())}>Recheck account</button>}
        {error && <p role="alert">{error}</p>}
      </aside>
      {active && <AccountWorkspaceProvider key={identity.generation} canonical={client} config={config} loadPayload={loadPayload}>
        <AppProvider><App analyticsConsent={false} /></AppProvider>
      </AccountWorkspaceProvider>}
    </>;
  }
  createRoot(container).render(<StrictMode><SiteAccountProvider client={client}><Workspace /></SiteAccountProvider></StrictMode>);
}
