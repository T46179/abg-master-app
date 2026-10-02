import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ExamAccess = { status: "allowed" | "closed" | "not_invited"; allowedUnitCounts: number[] };
export type ExamIdentity = { status: "signed_out" } | { status: "signed_in"; userId: string };
const clients = new Map<string, SupabaseClient>();

// A separate storage key prevents Practice's anonymous recovery from replacing
// the permanent Exam session. Anonymous progress is not migrated by this pilot.
export function createExamAuthClient(url: string, publicKey: string): SupabaseClient {
  const key = `${url}::${publicKey}`;
  let client = clients.get(key);
  if (!client) {
    client = createClient(url, publicKey, {
      auth: { storageKey: `abgm-exam-auth-${new URL(url).hostname}`, detectSessionInUrl: false },
    });
    clients.set(key, client);
  }
  return client;
}

export async function readExamIdentity(client: SupabaseClient): Promise<ExamIdentity> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error("We couldn’t check your sign-in. Please try again.");
  if (!sessionData.session) return { status: "signed_out" };
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 401 || error.status === 403) return { status: "signed_out" };
    throw new Error("We couldn’t check your sign-in. Please try again.");
  }
  if (!data.user || data.user.is_anonymous !== false || !data.user.email_confirmed_at) return { status: "signed_out" };
  return { status: "signed_in", userId: data.user.id };
}

export async function requestExamCode(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
  if (error) throw new Error("We couldn’t send a code. Check your email address and pilot invitation, then try again shortly.");
}

export async function verifyExamCode(client: SupabaseClient, email: string, code: string): Promise<void> {
  const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  if (error) throw new Error("That code couldn’t be verified. Check it or request a new one.");
}

export async function readExamAccess(client: SupabaseClient): Promise<ExamAccess> {
  const { data, error } = await client.functions.invoke("exam-access", { body: {} });
  if (error) throw new Error("Pilot access could not be checked. Please try again.");
  if (!data || !["allowed", "closed", "not_invited"].includes(data.status)
    || !Array.isArray(data.allowedUnitCounts)
    || !data.allowedUnitCounts.every((n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5)
    || (data.status === "allowed" && !data.allowedUnitCounts.length)
    || (data.status !== "allowed" && data.allowedUnitCounts.length)) {
    throw new Error("Pilot access could not be checked. Please try again.");
  }
  return { status: data.status, allowedUnitCounts: data.allowedUnitCounts };
}
