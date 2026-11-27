import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { registrationDestination, REGISTRATION_RETURN_URL, type RegistrationDestination } from "./registrationCallback";

type Action = "link" | "profile-link" | "signup" | "signin";
type Attempt = {
  action: Action;
  destination: RegistrationDestination;
  owner: string | null;
  ownerSession: string | null;
  started: number;
  hadProgress?: boolean;
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
  if (url.origin !== new URL(REGISTRATION_RETURN_URL).origin || url.searchParams.has("account_action")) return null;
  const isProfile = url.pathname === "/profile";
  if (!isProfile && url.origin + url.pathname !== REGISTRATION_RETURN_URL) return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("code");
  const errorCode = url.searchParams.get("error_code") ?? fragment.get("error_code");
  const failed = !!errorCode || url.searchParams.has("error") || fragment.has("error");
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const attempt: Attempt = JSON.parse(raw);
    if (isProfile) {
      // Back from the chooser can reload the profile without an OAuth callback.
      if (attempt.action === "profile-link") clearGoogleAttempt(storage);
      return null;
    }
    if (!["link", "profile-link", "signup", "signin"].includes(attempt.action) ||
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

export class GoogleLinkConflict extends Error {}

export function createGoogleAccount(canonical: SupabaseClient, url: string, apiKey: string, tab: Storage, enableCodeRecovery = false) {
  async function checkOwner(attempt: Attempt) {
    const current = await readSession(canonical);
    if ((current?.user.id ?? null) !== attempt.owner || sessionId(current) !== attempt.ownerSession) {
      throw new Error("The active account changed. Start Google sign-in again.");
    }
  }

  function verifiedCandidate(attempt: Attempt, temporary: { client: SupabaseClient; release: () => void }, session: Session, email: string, method: "google" | "email") {
    let adoptionStarted = false;
    let settled = false;
    async function cancel() {
      if (settled) return;
      settled = true;
      try {
        if (attempt.action !== "link" || method === "email") {
          await revokeTemporaryGoogleSession(temporary.client, canonical, session, adoptionStarted);
        }
      } finally { temporary.release(); }
    }
    return {
      email,
      method,
      destination: attempt.destination,
      requiresConfirmation: !!attempt.owner && attempt.owner !== session.user.id,
      cancel,
      async adopt(beforeCommit?: () => boolean) {
        if (settled || adoptionStarted) throw new Error("Start sign-in again.");
        try {
          await checkOwner(attempt);
          if (session.expires_at && session.expires_at * 1000 <= Date.now()) {
            throw new Error("This sign-in expired. Start again.");
          }
          if (beforeCommit && !beforeCommit()) return null;
          if (attempt.action !== "link" && attempt.owner === session.user.id) {
            await cancel();
            return session.user.id;
          }
          adoptionStarted = true;
          const adopted = await canonical.auth.setSession({
            access_token: session.access_token, refresh_token: session.refresh_token
          });
          if (adopted.error || adopted.data.session?.user.id !== session.user.id) throw new Error("Sign-in could not finish. Please retry.");
          settled = true;
          temporary.release();
          return session.user.id;
        } catch (error) {
          await cancel();
          throw error;
        }
      }
    };
  }

  return {
    requestExistingCode: enableCodeRecovery ? async (callback: GoogleReturn, email: string) => {
      const { attempt } = callback;
      if (!callback.conflict || attempt.action !== "link" || !attempt.owner) throw new Error("Start Google account setup again.");
      await checkOwner(attempt);
      const address = email.trim();
      // Numeric codes need no redirect or PKCE storage. Use a separate client for the candidate.
      const client = createClient(url, apiKey, { auth: {
        storageKey: key + "-" + crypto.randomUUID(), persistSession: false, autoRefreshToken: false, detectSessionInUrl: false
      } });
      const request = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
      await checkOwner(attempt);
      if (request.error) throw new Error("We couldn't send a code. Check your email address or try again shortly.");
      return async (code: string) => {
        await checkOwner(attempt);
        const result = await client.auth.verifyOtp({ email: address, token: code, type: "email" });
        const session = result.data.session;
        if (result.error || !session) throw new Error("This code couldn't be verified. Try again or request a new code.");
        // Capture the verified session before any owner check that could fail, so it can be revoked on failure.
        const candidate = verifiedCandidate(attempt, { client, release: () => {} }, session, address, "email");
        try {
          const checked = await client.auth.getUser();
          const user = checked.data.user;
          if (checked.error || !hasGoogleSignIn(user) || !user || user.id !== session.user.id || user.id === attempt.owner ||
              user.email?.toLowerCase() !== address.toLowerCase()) {
            throw new Error("Use the email address on your existing Google-linked account.");
          }
          await checkOwner(attempt);
          return { ...candidate, email: user.email };
        } catch (error) {
          await candidate.cancel();
          throw error;
        }
      };
    } : undefined,
    async begin(action: Action, destination: RegistrationDestination, options?: { expectedOwner: string | null; hadProgress?: boolean }) {
      clearGoogleAttempt(tab);
      const current = await readSession(canonical);
      if (options && (current?.user.id ?? null) !== options.expectedOwner) {
        throw new Error("The active account changed. Start Google sign-in again.");
      }
      const linking = action === "link" || action === "profile-link";
      if (linking) {
        const verified = await canonical.auth.getUser();
        const user = verified.data.user;
        if (verified.error || !current || !user || user.id !== current.user.id ||
            (action === "link" ? user.is_anonymous !== true : user.is_anonymous !== false || !user.email_confirmed_at)) {
          throw new Error("Your current account could not be checked. Please retry.");
        }
      }
      const attempt: Attempt = { action, destination, owner: current?.user.id ?? null,
        ownerSession: sessionId(current), started: Date.now(), hadProgress: options?.hadProgress };
      const temporary = createGoogleClient(url, apiKey, tab, linking ? current : null);
      try {
        const credentials = { provider: "google" as const, options: {
          redirectTo: REGISTRATION_RETURN_URL, skipBrowserRedirect: true,
          ...(action === "profile-link" ? { queryParams: { prompt: "select_account" } } : {})
        } };
        const result = linking
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
        if (conflict && (attempt.action === "link" || attempt.action === "profile-link")) {
          await checkOwner(attempt);
          throw new GoogleLinkConflict("This Google account is already linked.");
        }
        throw new Error("Google sign-in was cancelled or could not finish. You can try again.");
      }
      const temporary = createGoogleClient(url, apiKey, tab);
      let candidate: Session | null = null;

      try {
        await checkOwner(attempt);
        const result = await temporary.client.auth.exchangeCodeForSession(code);
        candidate = result.data.session;
        clearGoogleAttempt(tab);
        const verified = candidate && await temporary.client.auth.getUser();
        const user = verified && !verified.error ? verified.data.user : null;
        if (result.error || !candidate || !user || user.id !== candidate.user.id || !user.email || !hasGoogleSignIn(user) ||
            ((attempt.action === "link" || attempt.action === "profile-link") && user.id !== attempt.owner)) {
          throw new Error("Google sign-in could not be verified. Please retry.");
        }
        await checkOwner(attempt);
        return verifiedCandidate(attempt, temporary, candidate, user.email, "google");
      } catch (error) {
        try {
          if (candidate && attempt.action !== "link") {
            await revokeTemporaryGoogleSession(temporary.client, canonical, candidate, false);
          }
        } finally { temporary.clear(); }
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
  result: { candidate: GoogleCandidate } | { error: string } | { linkConflict: true };
};
