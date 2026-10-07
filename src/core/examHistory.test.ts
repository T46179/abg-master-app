import { expect, it, vi } from "vitest";
import { historyPresentation, readHistoryPage, verifyHistoryPage, type HistoryPage } from "./examHistory";
const id = "12345678-1234-1234-1234-123456789abc";
const page = (): HistoryPage => ({ attempts: [{ id, createdAt: "2026-01-01T00:00Z", presentedAt: null, finishedAt: "2026-01-01T00:10Z", examKind: "custom", excludedCategories: ["mechanical_ventilation"], caseCount: 3, marksAvailable: 8, marksAwarded: null, gradingStatus: "pending", canRetryGrading: false }],
  total: 45, nextCursor: null, latestAttemptId: id, counts: { all: 45, mock: 20, custom: 25 }, summary: { submitted: 45, average: 50, best: 100, trend: [0, 100], totalCases: 140, awaiting: 1, pending: 1 } });
it("uses account-wide summary independently of loaded rows and preserves missing timing", () => {
  const result = historyPresentation(verifyHistoryPage(page()), page().attempts, { mechanical_ventilation: "Mechanical ventilation" });
  expect(result.submitted).toBe(45); expect(result.average).toBe(50); expect(result.totalCases).toBe(140);
  expect(result.attempts[0].elapsed).toBe("—"); expect(result.attempts[0].awarded).toBeNull(); expect(result.attempts[0].exclusions).toEqual(["Mechanical ventilation"]);
});
it("rejects unconfirmed marks, invalid cursor receipts and broken count totals", () => {
  for (const value of [ { ...page(), attempts: [{ ...page().attempts[0], marksAwarded: 3 }] },
    { ...page(), nextCursor: { id: "another", finishedAt: "2026-01-01" } }, { ...page(), counts: { all: 44, mock: 20, custom: 25 } } ]) expect(() => verifyHistoryPage(value)).toThrow();
});
it("validates filter consistency rather than trusting caller-side filtering", async () => {
  const call = vi.fn().mockResolvedValue(page());
  await expect(readHistoryPage(call,"mock")).rejects.toThrow();
  expect(call).toHaveBeenCalledWith("history_page",{filter:"mock"});
});
it("displays a confirmed zero score and actual elapsed time", () => {
  const source = { ...page().attempts[0], gradingStatus: "completed" as const, marksAwarded: 0, presentedAt: "2026-01-01T00:00Z" };
  const result = historyPresentation(page(),[source],{}).attempts[0]; expect(result.awarded).toBe(0); expect(result.elapsed).toBe("10m 0s");
});
