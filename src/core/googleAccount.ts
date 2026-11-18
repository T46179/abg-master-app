import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { registrationDestination, REGISTRATION_RETURN_URL, type RegistrationDestination } from "./registrationCallback";

type Action = "link" | "signup" | "signin";
type Attempt = {
  action: Action;
  destination: RegistrationDestination;
  owner: string | null;
  ownerSession: string | null;
  started: number;
};
export type GoogleReturn = { attempt: Attempt; code: string | null; conflict: boolean };

const key = "abgm-local-google";
const verifierKey = key + "-code-verifier";
const maxAge = 15 * 60_000;

export function hasGoogleSignIn(user: User | null): boolean {
  return Boolean(user && user.is_anonymous === false && user.email_confirmed_at &&
    user.identities?.some(identity => identity.provider === "google"));
}

// Session IDs are used only to compare SDK sessions, never to authorize a user.
function sessionId(session: Session | null) {
  if (!session) return null;
  const payload = session.access_token.split(".")[1];
  const id: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).session_id;
  if (typeof id !== "string" || !id) throw new Error("The sign-in session could not be checked.");
  return id;
}

export function clearGoogleAttempt(storage: Storage) {
  storage.removeItem(key);
  storage.removeItem(verifierKey);
}

export function takeGoogleReturn(location: Pick<Location, "href">, storage: Storage): GoogleReturn | null {
  const url = new URL(location.href);
  if (url.origin + url.pathname !== REGISTRATION_RETURN_URL || url.searchParams.has("account_action")) return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("code");
  const errorCode = url.searchParams.get("error_code") ?? fragment.get("error_code");
  const failed = !!errorCode || url.searchParams.has("error") || fragment.has("error");
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const attempt: Attempt = JSON.parse(raw);
    if (!["link", "signup", "signin"].includes(attempt.action) ||
        !Number.isFinite(attempt.started) || Date.now() - attempt.started > maxAge) {
      clearGoogleAttempt(storage);
      return null;
    }
    // A request that returns without a code (including Back from Google) is cancelled.
    return { attempt: { ...attempt, destination: registrationDestination(attempt.destination) },
      code: failed ? null : code, conflict: errorCode === "identity_already_exists" };
  } catch {
    return null;
  }
}

export function createGoogleClient(url: string, apiKey: string, tab: Storage, seed?: Session | null) {
  // Only the PKCE verifier needs to survive the redirect. Tokens stay in memory.
  let session = seed ? JSON.stringify(seed) : null;
  // A unique SDK key also isolates browser auth broadcasts between attempts.
  const sdkKey = key + "-" + crypto.randomUUID();
  const sdkVerifierKey = sdkKey + "-code-verifier";
  const client = createClient(url, apiKey, { auth: {
    storageKey: sdkKey, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce",
    storage: {
      getItem: name => name === sdkVerifierKey ? tab.getItem(verifierKey) : name === sdkKey ? session : null,
      setItem: (name, value) => {
        if (name === sdkVerifierKey) tab.setItem(verifierKey, value);
        else if (name === sdkKey) session = value;
      },
      removeItem: name => {
        if (name === sdkVerifierKey) tab.removeItem(verifierKey);
        else if (name === sdkKey) session = null;
      }
    }
  } });
  function release() {
    session = null;
    void client.auth.stopAutoRefresh().catch(() => undefined);
  }
  return { client, release, clear: () => { release(); clearGoogleAttempt(tab); } };
}

async function readSession(client: SupabaseClient) {
  const result = await client.auth.getSession();
  if (result.error) throw result.error;
  return result.data.session;
}

export function createGoogleAccount(canonical: SupabaseClient, url: string, apiKey: string, tab: Storage) {
  async function checkOwner(attempt: Attempt) {
    const current = await readSession(canonical);
    if ((current?.user.id ?? null) !== attempt.owner || sessionId(current) !== attempt.ownerSession) {
      throw new Error("The active account changed. Start Google sign-in again.");
    }
  }

  return {
    async begin(action: Action, destination: RegistrationDestination) {
      clearGoogleAttempt(tab);
      const current = await readSession(canonical);
      if (action === "link") {
        const verified = await canonical.auth.getUser();
        if (verified.error || !current || verified.data.user?.id !== current.user.id ||
            verified.data.user.is_anonymous !== true) {
          throw new Error("Your current guest account could not be checked. Please retry.");
        }
      }
      const attempt: Attempt = { action, destination, owner: current?.user.id ?? null,
        ownerSession: sessionId(current), started: Date.now() };
      const temporary = createGoogleClient(url, apiKey, tab, action === "link" ? current : null);
      try {
        const credentials = { provider: "google" as const, options: {
          redirectTo: REGISTRATION_RETURN_URL, skipBrowserRedirect: true
        } };
        const result = action === "link"
          ? await temporary.client.auth.linkIdentity(credentials)
          : await temporary.client.auth.signInWithOAuth(credentials);
        if (result.error || !result.data.url) throw new Error("Google sign-in could not start. Please retry.");
        await checkOwner(attempt);
        tab.setItem(key, JSON.stringify(attempt));
        temporary.release();
        return result.data.url;
      } catch (error) {
        temporary.clear();
        throw error;
      }
    },
    async complete(callback: GoogleReturn) {
      const { attempt, code, conflict } = callback;
      if (!code) {
        clearGoogleAttempt(tab);
        throw new Error(conflict
          ? "This Google account is already linked. Your current account is still active. Choose Sign in to use that account."
          : "Google sign-in was cancelled or could not finish. You can try again.");
      }
      const temporary = createGoogleClient(url, apiKey, tab);
      let candidate: Session | null = null;
      let adoptionStarted = false;
      let settled = false;

      async function cancel() {
        if (settled) return;
        settled = true;
        try {
          if (candidate && attempt.action !== "link") {
            await revokeTemporaryGoogleSession(temporary.client, canonical, candidate, adoptionStarted);
          }
        } finally { temporary.clear(); }
      }

      try {
        await checkOwner(attempt);
        const result = await temporary.client.auth.exchangeCodeForSession(code);
        candidate = result.data.session;
        clearGoogleAttempt(tab);
        const verified = candidate && await temporary.client.auth.getUser();
        const user = verified && !verified.error ? verified.data.user : null;
        if (result.error || !candidate || !user || user.id !== candidate.user.id || !user.email || !hasGoogleSignIn(user) ||
            (attempt.action === "link" && user.id !== attempt.owner)) {
          throw new Error("Google sign-in could not be verified. Please retry.");
        }
        await checkOwner(attempt);
        const session = candidate;
        return {
          email: user.email,
          destination: attempt.destination,
          requiresConfirmation: !!attempt.owner && attempt.owner !== user.id,
          cancel,
          async adopt() {
            if (settled || adoptionStarted) throw new Error("Start Google sign-in again.");
            try {
              await checkOwner(attempt);
              if (attempt.action !== "link" && attempt.owner === user.id) {
                await cancel();
                return user.id;
              }
              adoptionStarted = true;
              const adopted = await canonical.auth.setSession({
                access_token: session.access_token, refresh_token: session.refresh_token
              });
              if (adopted.error || adopted.data.session?.user.id !== user.id) throw new Error("Google sign-in could not finish. Please retry.");
              settled = true;
              temporary.clear();
              return user.id;
            } catch (error) {
              await cancel();
              throw error;
            }
          }
        };
      } catch (error) {
        await cancel();
        throw error;
      }
    }
  };
}

export async function revokeTemporaryGoogleSession(
  temporary: SupabaseClient, canonical: SupabaseClient, candidate: Session, adoptionStarted: boolean
) {
  try {
    const active = await readSession(canonical);
    const id = sessionId(candidate);
    if (!id || sessionId(active) === id) return;
    // If adoption was attempted, another tab may already have used the adopted
    // refresh token and switched away. Forget the candidate without revoking it.
    if (adoptionStarted) return;
    const current = await readSession(temporary);
    if (sessionId(current) === id) await temporary.auth.signOut({ scope: "local" });
  } catch { /* Unknown session ownership is resolved by forgetting local credentials. */ }
}

export type GoogleAccount = ReturnType<typeof createGoogleAccount>;
export type GoogleCandidate = Awaited<ReturnType<GoogleAccount["complete"]>>;
export type GoogleCompletion = {
  callback: GoogleReturn;
  result: { candidate: GoogleCandidate } | { error: string };
};
