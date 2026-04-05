import type { PendingPracticeSubmission } from "../core/types";

export const PENDING_SUBMISSION_STALE_MS = 30 * 60 * 1000;
export const PENDING_RETRY_BACKOFF_MS = [10_000, 30_000, 60_000] as const;

export function getPendingRetryDelayMs(attemptCount: number) {
  if (attemptCount <= 0) return PENDING_RETRY_BACKOFF_MS[0];
  if (attemptCount === 1) return PENDING_RETRY_BACKOFF_MS[1];
  return PENDING_RETRY_BACKOFF_MS[2];
}

export function getPendingSubmissionAgeMs(
  pendingSubmission: PendingPracticeSubmission,
  nowMs = Date.now()
) {
  const completedAtMs = Date.parse(String(pendingSubmission.clientCompletedAt ?? ""));
  if (!Number.isFinite(completedAtMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - completedAtMs);
}

export function getPendingSubmissionInvalidReason(
  pendingSubmission: PendingPracticeSubmission,
  contentVersion?: string | null,
  nowMs = Date.now()
) {
  if (contentVersion && pendingSubmission.contentVersion !== contentVersion) {
    return "content_mismatch";
  }

  if (getPendingSubmissionAgeMs(pendingSubmission, nowMs) > PENDING_SUBMISSION_STALE_MS) {
    return "expired";
  }

  return null;
}
