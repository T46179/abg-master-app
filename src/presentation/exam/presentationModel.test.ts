import { describe, expect, it } from "vitest";
import { attemptPercent, buildHistoryPresentation, filterAttempts } from "./presentationModel";
import type { AttemptPresentation } from "./presentationTypes";

const completed: AttemptPresentation = {
  id: "first", kind: "mock", date: "1 Oct 2026", time: "08:15", finishedAt: "2026-10-01T08:15:00+10:00",
  exclusions: [], cases: 3, elapsed: "30m", awarded: 6, available: 10, status: "completed"
};

describe("Exam history presentation", () => {
  it("orders submissions by completion and calculates graded-only scores across both kinds", () => {
    const pending = { ...completed, id: "pending", finishedAt: "2026-10-04T12:00:00+11:00", status: "pending" as const, awarded: null };
    const custom = { ...completed, id: "custom", kind: "custom" as const, finishedAt: "2026-10-03T12:00:00+10:00", awarded: 8 };
    const failed = { ...completed, id: "failed", finishedAt: "2026-10-02T12:00:00+10:00", status: "failed" as const, awarded: null };
    const result = buildHistoryPresentation([completed, custom, pending, failed]);
    expect(result.attempts.map(row => row.id)).toEqual(["pending", "custom", "failed", "first"]);
    expect(result.average).toBe(70);
    expect(result.best).toBe(80);
    expect(result.trend).toEqual([60, 80]);
    expect(result.totalCases).toBe(12);
    expect(result.awaiting).toBe(2);
    expect(filterAttempts(result.attempts, "custom").map(row => row.id)).toEqual(["custom"]);
  });

  it("keeps pending and failed marks unavailable even if an incomplete score is present", () => {
    expect(attemptPercent({ ...completed, status: "pending" })).toBeNull();
    expect(attemptPercent({ ...completed, status: "failed" })).toBeNull();
    expect(attemptPercent({ ...completed, awarded: null })).toBeNull();
    expect(attemptPercent({ ...completed, available: 0 })).toBeNull();
    expect(attemptPercent({ ...completed, awarded: 0 })).toBe(0);
  });

  it("does not fabricate average or best scores when there are no graded submissions", () => {
    const result = buildHistoryPresentation([{ ...completed, status: "pending", awarded: null }]);
    expect(result.average).toBeNull();
    expect(result.best).toBeNull();
    expect(result.trend).toEqual([]);
    expect(result.awaiting).toBe(1);
  });

  it("supports empty history and empty filters", () => {
    expect(buildHistoryPresentation([])).toEqual({ attempts: [], average: null, best: null, trend: [], totalCases: 0, awaiting: 0 });
    expect(filterAttempts([completed], "custom")).toEqual([]);
  });
});
