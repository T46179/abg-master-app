import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "./storage";
import {
  clearFeaturedCaseDraft,
  ensureFeaturedCaseAnalyticsContext,
  FEATURED_CASE_DRAFT_STORAGE_KEY,
  FEATURED_CASE_DRAFT_VERSION,
  FEATURED_CASE_INTRO_SEEN_STORAGE_KEY,
  loadFeaturedCaseDraft,
  loadFeaturedCaseIntroSeen,
  saveFeaturedCaseDraft,
  saveFeaturedCaseIntroSeen,
  type FeaturedCaseDraft
} from "./featuredCase";

describe("Featured Case draft storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores only the matching user, release, and protected session", () => {
    const storage = createMemoryStorage();
    saveFeaturedCaseDraft(storage, {
      version: FEATURED_CASE_DRAFT_VERSION,
      userId: "user-1",
      releaseId: "featured-authored-001-r1",
      caseToken: "token-1",
      currentStepIndex: 2,
      selectedAnswers: [{ key: "ph_status", label: "pH", chosen: "Acidaemia" }],
      stepResults: [{
        key: "ph_status",
        label: "pH",
        chosen: "Acidaemia",
        correctAnswer: "Acidaemia",
        correct: true
      }],
      savedAt: "2026-07-19T00:00:00.000Z"
    });

    const restored = loadFeaturedCaseDraft(storage, {
      userId: "user-1",
      releaseId: "featured-authored-001-r1",
      caseToken: "token-1"
    });
    expect(restored?.currentStepIndex).toBe(2);
    expect(restored?.stepResults[0]?.correct).toBe(true);
    expect(loadFeaturedCaseDraft(storage, {
      userId: "user-1",
      releaseId: "featured-authored-002-r1",
      caseToken: "token-1"
    })).toBeNull();
  });

  it("discards pre-parity drafts without the current format version", () => {
    const storage = createMemoryStorage();
    storage.setItem(FEATURED_CASE_DRAFT_STORAGE_KEY, JSON.stringify({
      userId: "user-1",
      releaseId: "featured-authored-001-r1",
      caseToken: "token-1",
      currentStepIndex: 2,
      selectedAnswers: [{ key: "ph_status", label: "pH", chosen: "Acidaemia" }],
      savedAt: "2026-07-19T00:00:00.000Z"
    }));

    expect(loadFeaturedCaseDraft(storage, {
      userId: "user-1",
      releaseId: "featured-authored-001-r1",
      caseToken: "token-1"
    })).toBeNull();
  });

  it("clears the persisted draft at completion or reset", () => {
    const storage = createMemoryStorage();
    storage.setItem(FEATURED_CASE_DRAFT_STORAGE_KEY, "{}");
    clearFeaturedCaseDraft(storage);
    expect(storage.getItem(FEATURED_CASE_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("persists one release-independent Featured introduction acknowledgement", () => {
    const storage = createMemoryStorage();

    expect(loadFeaturedCaseIntroSeen(storage)).toBe(false);
    saveFeaturedCaseIntroSeen(storage);

    expect(storage.getItem(FEATURED_CASE_INTRO_SEEN_STORAGE_KEY)).toBe("true");
    expect(loadFeaturedCaseIntroSeen(storage)).toBe(true);
  });

  it("shares one analytics attempt across tabs for the same issued session", async () => {
    const storage = createMemoryStorage();
    let queue = Promise.resolve<unknown>(undefined);
    vi.stubGlobal("navigator", {
      locks: {
        request: <T,>(_name: string, callback: () => T | PromiseLike<T>) => {
          const result = queue.then(() => callback()) as Promise<T>;
          queue = result.then(() => undefined);
          return result;
        }
      }
    });
    const fallbackDraft: FeaturedCaseDraft = {
      version: FEATURED_CASE_DRAFT_VERSION,
      userId: "user-1",
      releaseId: "featured-authored-004-r1",
      caseToken: "protected-token",
      currentStepIndex: 0,
      selectedAnswers: [],
      stepResults: [],
      savedAt: "2026-07-20T00:00:00.000Z"
    };
    const expected = {
      userId: "user-1",
      releaseId: "featured-authored-004-r1",
      caseToken: "protected-token"
    };

    const [dashboardTab, directTab] = await Promise.all([
      ensureFeaturedCaseAnalyticsContext(storage, expected, {
        entrySource: "dashboard",
        action: "start",
        isReplay: false,
        introShown: true
      }, fallbackDraft),
      ensureFeaturedCaseAnalyticsContext(storage, expected, {
        entrySource: "direct",
        action: "start",
        isReplay: false,
        introShown: true
      }, fallbackDraft)
    ]);

    expect(dashboardTab.analytics?.attemptId).toBe(directTab.analytics?.attemptId);
    expect(dashboardTab.analytics?.eventUuids).toEqual(directTab.analytics?.eventUuids);
    expect(directTab.analytics?.entrySource).toBe("dashboard");
  });

  it("creates a new analytics attempt for a genuine replay session", async () => {
    const storage = createMemoryStorage();
    const firstDraft: FeaturedCaseDraft = {
      version: FEATURED_CASE_DRAFT_VERSION,
      userId: "user-1",
      releaseId: "featured-authored-004-r1",
      caseToken: "token-1",
      currentStepIndex: 0,
      selectedAnswers: [],
      stepResults: [],
      savedAt: "2026-07-20T00:00:00.000Z"
    };
    const first = await ensureFeaturedCaseAnalyticsContext(storage, {
      userId: "user-1",
      releaseId: firstDraft.releaseId,
      caseToken: firstDraft.caseToken
    }, {
      entrySource: "dashboard",
      action: "start",
      isReplay: false,
      introShown: false
    }, firstDraft);

    clearFeaturedCaseDraft(storage);
    const replayDraft: FeaturedCaseDraft = {
      ...firstDraft,
      caseToken: "token-2",
      savedAt: "2026-07-20T01:00:00.000Z"
    };
    const replay = await ensureFeaturedCaseAnalyticsContext(storage, {
      userId: "user-1",
      releaseId: replayDraft.releaseId,
      caseToken: replayDraft.caseToken
    }, {
      entrySource: "featured_summary",
      action: "retry",
      isReplay: true,
      introShown: false
    }, replayDraft);

    expect(replay.analytics?.attemptId).not.toBe(first.analytics?.attemptId);
    expect(replay.analytics?.eventUuids).not.toEqual(first.analytics?.eventUuids);
    expect(replay.analytics?.isReplay).toBe(true);
  });
});
