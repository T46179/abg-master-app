import type { RuntimeCall } from "./examRuntime";
export interface SavedFeedbackPart { partId: string; status: "completed" | "unavailable"; text: string | null; helpful: boolean | null }
export interface SavedFeedbackState {
  attemptId: string; generationId: string | null; status: "not_requested" | "pending" | "completed" | "failed";
  parts: SavedFeedbackPart[]; canRetry: boolean; retryAfter: string | null;
}
export async function feedbackOperation(call: RuntimeCall, operation: string, attemptId: string, extra: Record<string, unknown> = {}): Promise<SavedFeedbackState> {
  const value = await call<SavedFeedbackState>(operation, { attemptId, ...extra });
  if (value.attemptId !== attemptId || !["not_requested", "pending", "completed", "failed"].includes(value.status)
    || !Array.isArray(value.parts) || typeof value.canRetry !== "boolean"
    || !(value.generationId === null || typeof value.generationId === "string")
    || !(value.retryAfter === null || typeof value.retryAfter === "string" && Number.isFinite(Date.parse(value.retryAfter)))
    || new Set(value.parts.map(p => p.partId)).size !== value.parts.length
    || value.parts.some(p => typeof p.partId !== "string" || !(p.helpful === null || typeof p.helpful === "boolean")
      || (p.status === "completed" ? typeof p.text !== "string" || !p.text.trim() : p.status !== "unavailable" || p.text !== null))) {
    throw new Error("Invalid feedback response");
  }
  return value;
}

export type FeedbackTone = "professional" | "supportive" | "ruthless";
export async function feedbackPreferenceOperation(call: RuntimeCall, operation: "preference_read" | "preference_update", tone?: FeedbackTone) {
  const value = await call<{ feedbackTone: FeedbackTone }>(operation, operation === "preference_update" ? { feedbackTone: tone } : {});
  if (!value || !["professional", "supportive", "ruthless"].includes(value.feedbackTone)) throw new Error("Invalid feedback preference");
  return value;
}
