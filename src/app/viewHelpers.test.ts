import { describe, expect, it } from "vitest";
import { formatLevelProgressText, shouldConfirmDifficultySwitch, shouldShowPracticeIntro } from "./viewHelpers";

describe("view helpers", () => {
  it("formats current-level progress instead of lifetime xp", () => {
    expect(formatLevelProgressText({ xpIntoLevel: 28, xpForNextLevel: 120 }, 388)).toBe("28 / 120 XP");
  });

  it("falls back to total xp when no next-level requirement exists", () => {
    expect(formatLevelProgressText({ xpIntoLevel: 0, xpForNextLevel: 0 }, 388)).toBe("388 XP");
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
});
