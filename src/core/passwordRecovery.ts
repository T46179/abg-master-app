import type { SupabaseClient } from "@supabase/supabase-js";

const ISSUER = "https://clpfecuohwzwrgmqzeos.supabase.co/auth/v1";
// This grant is created only after Auth consumes a one-time token using type=recovery.
// An existing OTP/password session or URL-controlled flow label cannot create it.
const recoveryGrants = new WeakMap<SupabaseClient, { userId: string; sessionId: string }>();

function sessionClaims(token: string) {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))));
  } catch { throw new Error("This reset session could not be checked. Request a new reset email."); }
}

export async function verifyPasswordRecoveryLink(client: SupabaseClient, tokenHash: string) {
  const result = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  const session = result.data.session; const user = result.data.user;
  if (result.error || !session || !user || session.user.id !== user.id)
    throw new Error("This reset link has expired or already been used. Request a new reset email.");
  const claims = sessionClaims(session.access_token);
  if (typeof claims.session_id !== "string" || !claims.session_id)
    throw new Error("This reset session could not be checked. Request a new reset email.");
  recoveryGrants.set(client, { userId: user.id, sessionId: claims.session_id });
  try { return await checkPasswordRecoverySession(client); }
  catch (error) { recoveryGrants.delete(client); throw error; }
}

/** The grant records the server-verified recovery exchange, not a JWT AMR label.
 * Auth v2.197.0 labels implicit email-link sessions (including resets) as OTP. */
export async function checkPasswordRecoverySession(client: SupabaseClient) {
  const grant = recoveryGrants.get(client);
  if (!grant) throw new Error("Open a password-reset email before choosing a new password.");
  const session = await client.auth.getSession();
  if (session.error || !session.data.session) throw new Error("This reset session has expired. Request a new reset email.");
  const result = await client.auth.getUser();
  const user = result.data.user;
  if (result.error || !user || user.id !== grant.userId || user.id !== session.data.session.user.id
    || user.is_anonymous !== false || !user.email || !user.email_confirmed_at)
    throw new Error("This reset session could not be verified. Request a new reset email.");
  const payload = sessionClaims(session.data.session.access_token);
  if (payload.sub !== user.id || payload.iss !== ISSUER || payload.role !== "authenticated" || payload.is_anonymous !== false
    || payload.session_id !== grant.sessionId || typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000)
    throw new Error("This reset session has changed or expired. Request a new reset email.");
  return { id: user.id, email: user.email };
}
