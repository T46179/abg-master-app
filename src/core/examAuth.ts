import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CustomisationCategory = { category_id: string; label: string };
export type TrialAvailability = "ready" | "disabled" | "error";
export interface TrialLifecycle {
  state: "available" | "active" | "reserved" | "consumed";
  attemptId: string | null;
  gradingStatus: "pending" | "failed" | "completed" | null;
  canRetryGrading: boolean;
  requiresSupport: boolean;
  retryAvailableAt: string | null;
}
export function parseTrialLifecycle(value: unknown): TrialLifecycle | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const uuid = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!["available", "active", "reserved", "consumed"].includes(v.state as string)
    || (v.state === "available" ? v.attemptId !== null : !uuid(v.attemptId))
    || ![null, "pending", "failed", "completed"].includes(v.gradingStatus as string | null)
    || typeof v.canRetryGrading !== "boolean" || typeof v.requiresSupport !== "boolean"
    || (v.retryAvailableAt !== null && (typeof v.retryAvailableAt !== "string" || !Number.isFinite(Date.parse(v.retryAvailableAt))))) return undefined;
  return v as unknown as TrialLifecycle;
}
export type ExamAccess = { canStartStandard?: boolean; trialLifecycle?: TrialLifecycle; trialAvailability?: TrialAvailability; status: "allowed" | "closed" | "not_invited"; allowedUnitCounts: number[]; customisationCategories?: CustomisationCategory[] };
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
  const categories: unknown = data.customisationCategories;
  if (categories !== undefined && (!Array.isArray(categories) || !categories.every(c => c && typeof c.category_id === "string" && /^[a-z][a-z0-9_]*$/.test(c.category_id) && typeof c.label === "string" && c.label.trim()) || new Set(categories.map(c => c.category_id)).size !== categories.length)) {
    throw new Error("Pilot access could not be checked. Please try again.");
  }
  return { canStartStandard: data.canStartStandard === true, trialLifecycle: parseTrialLifecycle(data.trialLifecycle), trialAvailability: ["ready", "disabled", "error"].includes(data.trialAvailability) ? data.trialAvailability : "error", status: data.status, allowedUnitCounts: data.allowedUnitCounts,
    ...(categories !== undefined ? { customisationCategories: categories as CustomisationCategory[] } : {}) };
}
