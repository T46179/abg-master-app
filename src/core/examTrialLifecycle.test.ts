import { describe, expect, it } from "vitest";
import { parseTrialLifecycle } from "./examAuth";
const available = { state: "available", attemptId: null, gradingStatus: null, canRetryGrading: false, requiresSupport: false, retryAvailableAt: null };
const id = "12345678-1234-1234-1234-123456789abc";
describe("server trial lifecycle boundary", () => {
 it("fails closed for missing/malformed lifecycle", () => {
  for (const input of [null, {}, { ...available, state: "paid" }, { ...available, attemptId: id }, { ...available, requiresSupport: "yes" }, { ...available, state: "reserved", attemptId: "wrong" }]) expect(parseTrialLifecycle(input)).toBeUndefined();
 });
 it("accepts available, owned active, reserved and consumed states", () => {
  for (const input of [available, { ...available, state: "active", attemptId: id }, { ...available, state: "reserved", attemptId: id, gradingStatus: "pending" }, { ...available, state: "reserved", attemptId: id, gradingStatus: "failed", requiresSupport: true }, { ...available, state: "consumed", attemptId: id, gradingStatus: "completed" }]) expect(parseTrialLifecycle(input)).toEqual(input);
 });
});
