import { expect, it, vi } from "vitest";
import { errorLogClient, verifyErrorLogState } from "./examErrorLog";
import type { RuntimeCall } from "./examRuntime";
import type { ErrorLogState } from "../presentation/exam/errorLogTypes";

export const attemptId = "12345678-1234-1234-1234-123456789abc";
export function state(attempt: string | null = null): ErrorLogState {
  return { catalogue: { topics: [{ id: "acid_base", label: "Acid–base" }], concepts: [
    { id: "calculation", label: "Calculation", topicId: "acid_base", errorType: "Calculation", active: true },
    { id: "interpretation", label: "Interpretation", topicId: "acid_base", errorType: "Interpretation", active: true },
  ] }, entries: [], attemptId: attempt, savedSources: {}, toReviewCount: 0 };
}
export function savedState(attempt: string | null = null): ErrorLogState {
  return { ...state(attempt), entries: [{ conceptId: "calculation", status: "to_review", exampleCount: 21,
    createdAt: "2026-10-07T01:00:00Z", lastSavedAt: "2026-10-07T02:00:00Z", archivedAt: null, reopenedAt: null }],
    savedSources: attempt ? { part: ["calculation"] } : {}, toReviewCount: 1 };
}

it("requires valid registry, counts and source references before showing account state", () => {
  expect(verifyErrorLogState(savedState(attemptId))).toEqual(savedState(attemptId));
  for (const invalid of [
    { ...savedState(), toReviewCount: 2 },
    { ...savedState(), savedSources: { part: ["calculation"] } },
    { ...savedState(attemptId), savedSources: { part: ["unknown"] } },
    { ...savedState(), entries: [...savedState().entries, ...savedState().entries] },
  ]) expect(() => verifyErrorLogState(invalid)).toThrow();
});
it("does not accept a save without confirmation for each selected source concept", async () => {
  const call = vi.fn().mockResolvedValue({ ...savedState(attemptId), savedConceptIds: ["calculation"] });
  const client = errorLogClient(call as RuntimeCall);
  await expect(client.save(attemptId, "part", ["calculation"])).resolves.toMatchObject({ toReviewCount: 1 });
  await expect(client.save(attemptId, "another_part", ["calculation"])).rejects.toThrow("confirm");
  await expect(client.save(attemptId, "part", ["calculation", "interpretation"])).rejects.toThrow("confirm");
  expect(call.mock.calls[0]).toEqual(["error_log_save", { attemptId, partId: "part", conceptIds: ["calculation"] }]);
});
it("rejects another attempt's state and an unconfirmed archive", async () => {
  const client = errorLogClient(vi.fn().mockResolvedValue(savedState()) as RuntimeCall);
  await expect(client.list(attemptId)).rejects.toThrow("another attempt");
  await expect(client.review("calculation", true)).rejects.toThrow("confirm");
});
it("passes continuation cursors and validates example pages", async () => {
  const cursor = { id: attemptId, savedAt: "2026-10-07T02:00:00Z" };
  const call = vi.fn().mockResolvedValue({ examples: [], nextCursor: null });
  const client = errorLogClient(call as RuntimeCall);
  await client.examples("calculation", cursor);
  expect(call).toHaveBeenCalledWith("error_log_examples", { conceptId: "calculation", cursor });
  call.mockResolvedValue({ examples: [], nextCursor: { id: "invalid", savedAt: "today" } });
  await expect(client.examples("calculation")).rejects.toThrow("saved examples");
});
