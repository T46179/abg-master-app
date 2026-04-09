import { describe, expect, it } from "vitest";
import {
  formatElapsed,
  formatLevelProgressText,
  getPracticeDifficultyMismatchAction,
  shouldConfirmDifficultySwitch,
  shouldShowPracticeIntro
} from "./viewHelpers";

describe("view helpers", () => {
  it("formats current-level progress instead of lifetime xp", () => {
    expect(formatLevelProgressText({ xpIntoLevel: 28, xpForNextLevel: 120 }, 388)).toBe("28 / 120 XP");
  });

  it("falls back to total xp when no next-level requirement exists", () => {
    expect(formatLevelProgressText({ xpIntoLevel: 0, xpForNextLevel: 0 }, 388)).toBe("388 XP");
  });

  it("formats short elapsed times in seconds", () => {
    expect(formatElapsed(42.4)).toBe("42.4s");
  });

  it("caps long elapsed times at over five minutes", () => {
    expect(formatElapsed(301)).toBe("> 5 min");
  });

  it("only confirms difficulty switching after answered steps on an unfinished case", () => {
    expect(shouldConfirmDifficultySwitch(false, false)).toBe(false);
    expect(shouldConfirmDifficultySwitch(true, false)).toBe(false);
    expect(shouldConfirmDifficultySwitch(true, true)).toBe(true);
  });

  it("only shows the practice intro before the first case begins", () => {
    expect(shouldShowPracticeIntro(false, false, false)).toBe(true);
    expect(shouldShowPracticeIntro(true, false, false)).toBe(false);
    expect(shouldShowPracticeIntro(false, true, false)).toBe(false);
    expect(shouldShowPracticeIntro(false, false, true)).toBe(false);
  });

  it("resumes the active case difficulty when entering practice without an explicit difficulty param", () => {
    expect(getPracticeDifficultyMismatchAction({
      hasExplicitDifficultyParam: false,
      hasActiveCase: true,
      hasSummary: false,
      activeCaseDifficulty: "beginner",
      normalizedDifficulty: "master"
    })).toBe("resume_active_case");
  });

  it("replaces the active case when an explicit difficulty param requests a different level", () => {
    expect(getPracticeDifficultyMismatchAction({
      hasExplicitDifficultyParam: true,
      hasActiveCase: true,
      hasSummary: false,
      activeCaseDifficulty: "beginner",
      normalizedDifficulty: "master"
    })).toBe("replace_active_case");
  });
});
