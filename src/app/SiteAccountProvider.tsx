import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSiteAccount, type SiteAccount, type SiteAccountSnapshot } from "../core/siteAccount";

const SiteAccountContext = createContext<{ account: SiteAccount; identity: SiteAccountSnapshot; client: SupabaseClient } | null>(null);

/** Mount once around the app when account-aware storage/bootstrapping is wired.
 * The supplied client must be the same environment/client used by Practice. */
export function SiteAccountProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const account = useMemo(() => createSiteAccount(client), [client]);
  const identity = useSyncExternalStore(account.subscribe, account.getSnapshot, account.getSnapshot);
  useEffect(() => { account.start(); return account.stop; }, [account]);
  const value = useMemo(() => ({ account, identity, client }), [account, identity, client]);
  return <SiteAccountContext.Provider value={value}>{children}</SiteAccountContext.Provider>;
}

export function useSiteAccount() {
  const value = useContext(SiteAccountContext);
  if (!value) throw new Error("SiteAccountProvider is required.");
  return value;
}
export function useOptionalSiteAccount() { return useContext(SiteAccountContext); }
