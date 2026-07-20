import { beforeEach, describe, expect, it, vi } from "vitest";

const trackEvent = vi.hoisted(() => vi.fn());

vi.mock("./analytics", () => ({
  trackEvent
}));

import {
  buildFeaturedCaseAnalyticsProperties,
  buildFeaturedCaseEntryUrl,
  createFeaturedCaseAnalyticsContext,
  resolveFeaturedCaseEntry,
  trackFeaturedCaseMilestone
} from "./featuredCaseAnalytics";

describe("Featured Case analytics", () => {
  beforeEach(() => {
    trackEvent.mockReset();
  });

  it("normalizes entry attribution and falls back safely for direct visits", () => {
    expect(resolveFeaturedCaseEntry(new URLSearchParams(
      "source=dashboard&action=continue"
    ))).toEqual({
      entrySource: "dashboard",
      action: "continue",
      isReplay: false
    });
    expect(resolveFeaturedCaseEntry(new URLSearchParams(
      "source=unknown&action=unknown"
    ))).toEqual({
      entrySource: "direct",
      action: "start",
      isReplay: false
    });
    expect(resolveFeaturedCaseEntry(new URLSearchParams("replay=1"))).toEqual({
      entrySource: "direct",
      action: "retry",
      isReplay: true
    });
  });

  it("builds tagged entry URLs and marks retries explicitly", () => {
    expect(buildFeaturedCaseEntryUrl("results_summary", "start"))
      .toBe("/featured-case?source=results_summary&action=start");
    expect(buildFeaturedCaseEntryUrl("featured_summary", "retry"))
      .toBe("/featured-case?source=featured_summary&action=retry&replay=1");
  });

  it("creates one analytics-only attempt ID and stable event IDs per attempt", () => {
    const first = createFeaturedCaseAnalyticsContext({
      entrySource: "dashboard",
      action: "start",
      isReplay: false,
      introShown: true
    });
    const replay = createFeaturedCaseAnalyticsContext({
      entrySource: "featured_summary",
      action: "retry",
      isReplay: true,
      introShown: false
    });
    const identifiers = [
      first.attemptId,
      ...Object.values(first.eventUuids),
      replay.attemptId,
      ...Object.values(replay.eventUuids)
    ];

    expect(new Set(identifiers).size).toBe(identifiers.length);
    for (const identifier of identifiers) {
      expect(identifier).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }
  });

  it("emits only the approved non-personal properties", () => {
    const properties = buildFeaturedCaseAnalyticsProperties({
      releaseId: "featured-authored-004-r1",
      entrySource: "dashboard",
      action: "start",
      learnerLevel: 2,
      normalCasesCompleted: 4,
      isReplay: false,
      introShown: true,
      analyticsAttemptId: "analytics-attempt-id",
      isCanonical: true,
      elapsedSeconds: 94
    });

    expect(properties).toEqual({
      release_id: "featured-authored-004-r1",
      entry_source: "dashboard",
      action: "start",
      learner_level: 2,
      normal_cases_completed: 4,
      is_replay: false,
      intro_shown: true,
      analytics_attempt_id: "analytics-attempt-id",
      is_canonical: true,
      elapsed_seconds: 94
    });
    expect(JSON.stringify(properties)).not.toContain("token");
    expect(JSON.stringify(properties)).not.toContain("answer");
    expect(JSON.stringify(properties)).not.toContain("user_id");
  });

  it("passes the stable milestone UUID to PostHog capture", () => {
    trackFeaturedCaseMilestone("featured_case_engaged", {
      releaseId: "featured-authored-004-r1",
      entrySource: "dashboard",
      action: "start",
      learnerLevel: 2,
      normalCasesCompleted: 4,
      isReplay: false,
      introShown: true,
      analyticsAttemptId: "analytics-attempt-id"
    }, "0c0d6918-78af-47c0-a0ec-81e287f35f1a");

    expect(trackEvent).toHaveBeenCalledWith(
      "featured_case_engaged",
      expect.objectContaining({
        analytics_attempt_id: "analytics-attempt-id"
      }),
      {
        uuid: "0c0d6918-78af-47c0-a0ec-81e287f35f1a"
      }
    );
  });
});
