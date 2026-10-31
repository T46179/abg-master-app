import type { SupabaseClient, User } from "@supabase/supabase-js";

export const STAGING_URL = "https://clpfecuohwzwrgmqzeos.supabase.co";
export const PROBE_STORAGE_KEY = "abgm-account-staging-proof-v1";
export type ProbeBaseline = { userId: string; progress: string };

export function assertProbeEnvironment(dev: boolean, hostname: string, url: string, key: string) {
  if (!dev || !["127.0.0.1", "localhost"].includes(hostname) || url !== STAGING_URL) {
    throw new Error("This test runs locally against staging only.");
  }
  let publicKey = key.startsWith("sb_publishable_");
  if (!publicKey) {
    try { publicKey = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"; }
    catch { /* Reject unknown key formats. */ }
  }
  if (!key || !publicKey) throw new Error("A staging public key is required.");
}

function fail(): never { throw new Error("The account check could not finish. Retry without changing accounts."); }

export async function readProbeUser(client: SupabaseClient): Promise<User | null> {
  const session = await client.auth.getSession();
  if (session.error) fail();
  if (!session.data.session) return null;
  const result = await client.auth.getUser();
  if (result.error || !result.data.user) fail();
  return result.data.user;
}

export async function readProbeProgress(client: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await client.from("user_progress")
    .select("user_id,progression_version,beta_release_number,xp,level,streak,cases_completed,calibration_completed,calibration_placement,calibration_completed_at,updated_at")
    .eq("user_id", userId).order("progression_version").order("beta_release_number");
  if (error || !Array.isArray(data)) fail();
  return JSON.stringify(data.map(row => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))));
}

export async function createProbeGuest(client: SupabaseClient): Promise<ProbeBaseline> {
  if (await readProbeUser(client)) throw new Error("Sign out of this test page before creating another test guest.");
  const result = await client.auth.signInAnonymously();
  if (result.error) throw new Error("Staging could not create the test guest.");
  const user = await readProbeUser(client);
  if (!user || user.is_anonymous !== true) fail();
  // A clearly labelled, zero-XP calibration fixture tests actual saved progress.
  // It is scoped to this newly created guest; no clinical case or site counter is submitted.
  const seeded = await client.rpc("complete_calibration", {
    p_progression_version: "v2", p_beta_release_number: 2, p_placement: "beginner", p_calibration_version: 3,
    p_attempt_payload: { purpose: "account_registration_staging_probe", recommendation: "beginner", scoring_version: 3 },
    p_progression_config: {}
  });
  if (seeded.error) throw new Error("The guest was created, but its test progress could not be saved. Stop here.");
  const progress = await readProbeProgress(client, user.id);
  if (JSON.parse(progress).length === 0) throw new Error("No saved test progress was found. Stop here.");
  return { userId: user.id, progress };
}

export async function registerProbeGuest(client: SupabaseClient, baseline: ProbeBaseline, email: string, password: string) {
  const user = await readProbeUser(client);
  if (!user || user.id !== baseline.userId || user.is_anonymous !== true) {
    throw new Error("This is not the original test guest. No registration request was sent.");
  }
  // Keep this as one real user operation: no admin confirmation or password staging.
  // No redirect override: use the existing staging email configuration for this proof.
  const result = await client.auth.updateUser({ email: email.trim(), password });
  if (result.error) {
    const code = result.error.code;
    if (code === "email_exists") throw new Error("That address already has an account. No progress was merged.");
    if (["weak_password", "validation_failed"].includes(code ?? "")) {
      throw new Error("Staging rejected the combined email/password request. Stop here and tell Codex; do not change the sequence yet.");
    }
    if (["over_email_send_rate_limit", "over_request_rate_limit"].includes(code ?? "")) {
      throw new Error("Staging has limited email requests. Wait before trying again.");
    }
    throw new Error("Staging could not complete the registration request. Stop here and tell Codex; no automatic retry was made.");
  }
  if (result.data.user?.id !== baseline.userId) fail();
}

export async function readProbeProof(client: SupabaseClient, baseline: ProbeBaseline) {
  const user = await readProbeUser(client);
  if (!user) return { signedIn: false, verified: false, sameIdentity: false, progressPreserved: false };
  const sameIdentity = user.id === baseline.userId;
  return {
    signedIn: true,
    verified: user.is_anonymous === false && Boolean(user.email_confirmed_at),
    sameIdentity,
    progressPreserved: sameIdentity && await readProbeProgress(client, user.id) === baseline.progress
  };
}

// Verify within the isolated test client; never navigate a secret-bearing URL
// through the normal app's analytics or its existing pilot callback.
export function verificationRequest(value: string, email: string, purpose: "email_change" | "recovery" = "email_change") {
  const input = value.trim();
  if (/^[0-9]{6,10}$/.test(input)) return { email: email.trim(), token: input, type: purpose };
  let link: URL;
  try { link = new URL(input); } catch { throw new Error("Paste the verification link or code from the email."); }
  if (link.origin !== STAGING_URL || link.pathname !== "/auth/v1/verify" || link.username || link.password
    || link.searchParams.get("type") !== purpose) {
    throw new Error("This is not the expected staging verification link. No request was sent.");
  }
  const token = link.searchParams.get("token");
  if (!token || !/^[a-zA-Z0-9_-]{20,256}$/.test(token)) throw new Error("The verification link is incomplete.");
  return { token_hash: token, type: purpose };
}

export async function verifyProbeEmail(client: SupabaseClient, baseline: ProbeBaseline, value: string, email: string) {
  const user = await readProbeUser(client);
  if (!user || user.id !== baseline.userId) throw new Error("This is not the original test session. No verification request was sent.");
  const result = await client.auth.verifyOtp(verificationRequest(value, email));
  if (result.error) throw new Error("The verification link or code could not be used. It may have expired or already been used.");
  if (result.data.user?.id !== baseline.userId) fail();
}

export function createProbeRecovery(client: SupabaseClient, baseline: ProbeBaseline) {
  let verifiedRecovery = false;
  return {
    async request(email: string) {
      const result = await client.auth.resetPasswordForEmail(email.trim());
      if (result.error) throw new Error("The recovery email could not be requested. Wait before trying again.");
    },
    async verify(value: string, email: string) {
      verifiedRecovery = false;
      const result = await client.auth.verifyOtp(verificationRequest(value, email, "recovery"));
      if (result.error) throw new Error("The recovery link or code could not be used. It may have expired or already been used.");
      if (result.data.user?.id !== baseline.userId) {
        // Never offer a password update for a different account's recovery session.
        await client.auth.signOut({ scope: "local" });
        throw new Error("That recovery belongs to a different account. No password was changed.");
      }
      verifiedRecovery = true;
    },
    async setPassword(password: string) {
      if (!verifiedRecovery) throw new Error("Verify the recovery link on this page before choosing a new password.");
      const user = await readProbeUser(client);
      if (user?.id !== baseline.userId || user.is_anonymous !== false || !user.email_confirmed_at) {
        verifiedRecovery = false;
        throw new Error("The original test account could not be verified. No password was changed.");
      }
      const result = await client.auth.updateUser({ password });
      if (result.error) {
        if (["weak_password", "same_password"].includes(result.error.code ?? "")) {
          throw new Error("Choose a different new password that meets the account requirements.");
        }
        throw new Error("The password change could not be confirmed. Stop here and tell Codex.");
      }
      verifiedRecovery = false;
    }
  };
}
