import { createContext, useContext, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CasesPayload, RuntimeConfig } from "../core/types";
import { createMemoryStorage, type BrowserStorageLike } from "../core/storage";
import { createAccountBrowserStorage } from "../core/accountBrowserStorage";
import { createAccountDataClient } from "../core/accountDataClient";
import { useSiteAccount } from "./SiteAccountProvider";

export type AccountWorkspace = {
  userId: string | null;
  runtimeConfig: RuntimeConfig;
  client: SupabaseClient | null;
  browserStorage: BrowserStorageLike;
  isCurrent: () => boolean;
  loadPayload?: (storage: BrowserStorageLike) => Promise<CasesPayload>;
};
const BrowserStorageContext = createContext<BrowserStorageLike | null>(null);
export const AccountBrowserStorageProvider = BrowserStorageContext.Provider;
const WorkspaceContext = createContext<AccountWorkspace | null>(null);

export function useOptionalAccountWorkspace() { return useContext(WorkspaceContext); }
export function useAccountBrowserStorage(): BrowserStorageLike {
  const workspace = useOptionalAccountWorkspace();
  const override = useContext(BrowserStorageContext);
  return override ?? workspace?.browserStorage ?? window.localStorage;
}

/** The parent keys this boundary by identity generation. Every account change
 * remounts Practice, Learn and Exam together; a guest upgrade keeps its owner. */
export function AccountWorkspaceProvider({ canonical, config, loadPayload, children }: {
  canonical: SupabaseClient; config: RuntimeConfig;
  loadPayload?: AccountWorkspace["loadPayload"]; children: ReactNode;
}) {
  const { account, identity } = useSiteAccount();
  const [workspace] = useState<AccountWorkspace>(() => {
    const userId = identity.userId;
    if (!userId) {
      const memory = createMemoryStorage();
      const preferences = new Set(["abgmaster_pressureUnit", "abgmaster_showAdvancedRanges"]);
      const isCurrent = () => { const now = account.getSnapshot(); return ["signed_out", "unavailable"].includes(now.status) && now.generation === identity.generation; };
      return { userId: null, runtimeConfig: config, client: null, isCurrent, loadPayload, browserStorage: {
        getItem: key => isCurrent() ? preferences.has(key) ? localStorage.getItem(key) : memory.getItem(key) : null,
        setItem: (key, value) => { if (isCurrent()) { if (preferences.has(key)) localStorage.setItem(key, value); else memory.setItem(key, value); } },
        removeItem: key => { if (isCurrent()) { if (preferences.has(key)) localStorage.removeItem(key); else memory.removeItem(key); } }
      } };
    }
    const isCurrent = () => account.isCurrent(identity.generation, userId);
    const scoped = createAccountBrowserStorage(window.localStorage, String(config.SUPABASE_URL), userId, isCurrent);
    return { userId, runtimeConfig: config, isCurrent, browserStorage: scoped.storage, loadPayload,
      client: createAccountDataClient(config, canonical, userId, isCurrent) };
  });
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}
