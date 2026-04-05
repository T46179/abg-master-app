import { describe, expect, it } from "vitest";
import {
  getPendingRetryDelayMs,
  getPendingSubmissionInvalidReason,
  PENDING_SUBMISSION_STALE_MS
} from "./protectedPracticeRecovery";

const pendingSubmission = {
  caseToken: "token-1",
  caseId: "case-1",
  contentVersion: "beta-1",
  difficultyKey: "advanced",
  answers: [{ key: "ph_status", chosen: "Acidaemia" }],
  elapsedSeconds: 42,
  timedMode: false,
  clientCompletedAt: "2026-04-05T00:00:00Z"
};

describe("protected practice recovery helpers", () => {
  it("uses the expected retry backoff schedule", () => {
    expect(getPendingRetryDelayMs(0)).toBe(10_000);
    expect(getPendingRetryDelayMs(1)).toBe(30_000);
    expect(getPendingRetryDelayMs(2)).toBe(60_000);
    expect(getPendingRetryDelayMs(99)).toBe(60_000);
  });

  it("marks stale pending submissions as expired", () => {
    const nowMs = Date.parse(pendingSubmission.clientCompletedAt) + PENDING_SUBMISSION_STALE_MS + 1;
    expect(getPendingSubmissionInvalidReason(pendingSubmission, "beta-1", nowMs)).toBe("expired");
  });

  it("marks mismatched content versions as invalid", () => {
    expect(getPendingSubmissionInvalidReason(pendingSubmission, "beta-2", Date.parse(pendingSubmission.clientCompletedAt))).toBe("content_mismatch");
  });

  it("accepts fresh matching pending submissions", () => {
    const nowMs = Date.parse(pendingSubmission.clientCompletedAt) + 5_000;
    expect(getPendingSubmissionInvalidReason(pendingSubmission, "beta-1", nowMs)).toBeNull();
  });
});
