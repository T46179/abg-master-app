import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./storage";
import {
  clearFeaturedCaseDraft,
  FEATURED_CASE_DRAFT_STORAGE_KEY,
  FEATURED_CASE_DRAFT_VERSION,
  FEATURED_CASE_INTRO_SEEN_STORAGE_KEY,
  loadFeaturedCaseDraft,
  loadFeaturedCaseIntroSeen,
  saveFeaturedCaseDraft,
  saveFeaturedCaseIntroSeen
} from "./featuredCase";

describe("Featured Case draft storage", () => {
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
});
