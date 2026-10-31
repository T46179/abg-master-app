import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeConfig } from "./types";

/** Requests capture one owner. A retired workspace cannot borrow a new login's
 * token, even when an old submission or calibration retry completes late. */
export function createAccountDataClient(config: RuntimeConfig, canonical: SupabaseClient,
  userId: string, isCurrent: () => boolean, fetchImpl: typeof fetch = fetch, onAuthUnavailable?: () => void): SupabaseClient {
  function assertCurrent() {
    if (!isCurrent()) throw new Error("This account workspace is no longer active.");
  }
  async function getSession() {
    assertCurrent();
    const result = await canonical.auth.getSession();
    assertCurrent();
    if (result.error || result.data.session?.user.id !== userId) {
      throw new Error("The account session could not be checked.");
    }
    return result;
  }
  async function getUser() {
    assertCurrent();
    const result = await canonical.auth.getUser();
    assertCurrent();
    if (result.error || result.data.user?.id !== userId) throw new Error("The account could not be checked.");
    return result;
  }
  const data = createClient(String(config.SUPABASE_URL), String(config.SUPABASE_ANON_KEY), {
    // This data-only client never stores, refreshes or discovers its own login.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const result = await getSession();
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${result.data.session!.access_token}`);
      const response = await fetchImpl(input, { ...init, headers });
      assertCurrent();
      if (response.status === 401) onAuthUnavailable?.();
      return response;
    } }
  });
  const auth = { getSession, getUser };
  // Auth changes belong to the site account controller, never to data consumers.
  return new Proxy(data, { get(target, property) {
    if (property === "auth") return auth;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  } });
}
