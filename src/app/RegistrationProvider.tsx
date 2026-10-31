import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createAccountRegistration, REGISTRATION_AUTH_KEY, readAccountSetupStatus, type AccountRegistration, type RegistrationSnapshot } from "../core/accountRegistration";
import type { RegistrationCallback } from "../core/registrationCallback";
import { useSiteAccount } from "./SiteAccountProvider";
export const LOCAL_ACCOUNT_URL = "https://clpfecuohwzwrgmqzeos.supabase.co";
type RegistrationContextValue = { registration: AccountRegistration; registrationState: RegistrationSnapshot; hasPassword: boolean | null;
  setupError: boolean; retrySetup: () => void; paid: boolean; togglePaid: () => void };
const Context = createContext<RegistrationContextValue | null>(null);
export function RegistrationProvider({ client, callback, children }: { client: SupabaseClient; callback?: RegistrationCallback | null; children: ReactNode }) {
  const { account, identity } = useSiteAccount();
  const registration = useMemo(() => createAccountRegistration(account, client, kind => createClient(LOCAL_ACCOUNT_URL, import.meta.env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY, {
    auth: { storageKey: kind === "pending" ? REGISTRATION_AUTH_KEY : "abgm-registration-callback", persistSession: kind === "pending", autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" }
  }), window.localStorage), [account, client]);
  const registrationState = useSyncExternalStore(registration.subscribe, registration.getSnapshot, registration.getSnapshot);
  const [setup, setSetup] = useState<{ generation: number; userId: string; value: boolean } | null>(null);
  const [setupError, setSetupError] = useState(false); const [revision, setRevision] = useState(0);
  const [paidOwner, setPaidOwner] = useState<{ id: string; generation: number } | null>(null);
  const previous = useRef({ id: identity.userId, generation: identity.generation }); const handled = useRef(false);
  useEffect(() => {
    const old = previous.current;
    if ((old.id !== identity.userId || old.generation !== identity.generation) && !registration.isBusy() && !(["complete", "reset_complete"].includes(registrationState.phase) && registrationState.completedUserId === identity.userId && registrationState.completedGeneration === identity.generation)) registration.accountChanged();
    previous.current = { id: identity.userId, generation: identity.generation };
  }, [identity.userId, identity.generation, registration, registrationState.phase]);
  useEffect(() => {
    if (!callback || handled.current || identity.status === "checking") return;
    handled.current = true; void registration.callback(callback);
  }, [callback, identity.status, registration]);
  useEffect(() => {
    let cancelled = false; setSetupError(false);
    if (identity.status !== "verified" || !identity.userId) return;
    const id = identity.userId; const generation = identity.generation;
    if (registrationState.phase === "complete" && registrationState.completedUserId === id && registrationState.completedGeneration === generation) {
      setSetup({ userId: id, generation, value: true }); return;
    }
    void readAccountSetupStatus(client).then(value => { if (!cancelled && account.isCurrent(generation, id)) setSetup({ userId: id, generation, value }); })
      .catch(() => { if (!cancelled && account.isCurrent(generation, id)) setSetupError(true); });
    return () => { cancelled = true; };
  }, [identity.status, identity.userId, identity.generation, client, account, revision, registrationState.phase === "complete"]);
  useEffect(() => {
    const refresh = () => { void account.refresh(); setRevision(n => n + 1); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [account]);
  const value = useMemo(() => ({ registration, registrationState,
    hasPassword: identity.status === "verified" && setup?.userId === identity.userId && setup.generation === identity.generation ? setup.value : null,
    setupError, retrySetup: () => setRevision(n => n + 1),
    paid: paidOwner?.id === identity.userId && paidOwner?.generation === identity.generation,
    togglePaid: () => setPaidOwner(old => identity.status === "verified" && identity.userId ? old?.id === identity.userId && old.generation === identity.generation ? null : { id: identity.userId, generation: identity.generation } : null)
  }), [registration, registrationState, setup, setupError, paidOwner, identity]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useOptionalRegistration() { return useContext(Context); }
export function useRegistration() { const value = useOptionalRegistration(); if (!value) throw new Error("RegistrationProvider is required."); return value; }
