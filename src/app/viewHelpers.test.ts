import { describe, expect, it } from "vitest";
import {
  formatElapsed,
  formatLevelProgressText,
  getDefaultPracticeDifficulty,
  getPracticeDifficultyMismatchAction,
  resolvePracticeDifficulty,
  shouldConfirmDifficultySwitch
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

  it("defaults new practice entry to intermediate when accessible", () => {
    expect(getDefaultPracticeDifficulty({
      progressionConfig: {
        release_flags: { enable_all_difficulties: true },
        difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" }
      },
      userState: {
        xp: 0,
        level: 1,
        casesCompleted: 0,
        abandonedCases: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        streak: 0,
        dailyCasesUsed: 0,
        lastCaseDate: null,
        unlockedDifficulties: ["beginner"],
        isPremium: false,
        badges: [],
        recentResults: [],
        appliedProtectedCaseTokens: [],
        learnProgress: {}
      }
    }, null)).toBe("intermediate");
  });

  it("prefers the last accessible practice difficulty", () => {
    const input = {
      progressionConfig: {
        release_flags: { enable_all_difficulties: true },
        difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" }
      },
      userState: {
        xp: 0,
        level: 1,
        casesCompleted: 0,
        abandonedCases: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        streak: 0,
        dailyCasesUsed: 0,
        lastCaseDate: null,
        unlockedDifficulties: ["beginner"],
        isPremium: false,
        badges: [],
        recentResults: [],
        appliedProtectedCaseTokens: [],
        learnProgress: {}
      }
    };

    expect(getDefaultPracticeDifficulty(input, "advanced")).toBe("advanced");
  });

  it("falls back safely when the stored practice difficulty is not accessible", () => {
    expect(getDefaultPracticeDifficulty({
      progressionConfig: {
        difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" }
      },
      userState: {
        xp: 0,
        level: 1,
        casesCompleted: 0,
        abandonedCases: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        streak: 0,
        dailyCasesUsed: 0,
        lastCaseDate: null,
        unlockedDifficulties: ["beginner"],
        isPremium: false,
        badges: [],
        recentResults: [],
        appliedProtectedCaseTokens: [],
        learnProgress: {}
      }
    }, "master")).toBe("beginner");
  });

  it("honors local calibration access before remote progress sync catches up", () => {
    const result = resolvePracticeDifficulty({
      requestedDifficulty: "advanced",
      hasExplicitDifficultyParam: true,
      calibrationRecord: {
        completed: true,
        placement: "advanced",
        version: 2
      },
      progressionInput: {
        progressionConfig: {
          difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" }
        },
        userState: {
          xp: 0,
          level: 1,
          casesCompleted: 0,
          abandonedCases: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          streak: 0,
          dailyCasesUsed: 0,
          lastCaseDate: null,
          unlockedDifficulties: ["beginner"],
          isPremium: false,
          badges: [],
          recentResults: [],
          appliedProtectedCaseTokens: [],
          learnProgress: {}
        }
      },
      lastPracticeDifficulty: null,
      enableCalibrationAccessGuard: false
    });

    expect(result).toEqual({
      resolvedDifficulty: "advanced",
      shouldRedirect: false
    });
  });
});
