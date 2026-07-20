import { describe, expect, it } from "vitest";
import {
  getFeaturedComparisonRankLabel,
  getFeaturedComparisonSummaryCopy
} from "./featuredCaseComparison";
import type { FeaturedCaseComparison } from "./types";

function available(
  overrides: Partial<FeaturedCaseComparison> = {}
): FeaturedCaseComparison {
  return {
    status: "available",
    canonicalScore: 80,
    cohortSize: 20,
    percentileBand: 65,
    isTopScore: false,
    ...overrides
  };
}

describe("Featured Case comparison presentation", () => {
  it("uses the approved initial and replay comparison copy", () => {
    const comparison = available();

    expect(getFeaturedComparisonSummaryCopy({
      accuracy: 80,
      comparison,
      isReplay: false
    })).toBe(
      "You scored 80%. This is higher than about 65% of people who have completed this case!"
    );
    expect(getFeaturedComparisonSummaryCopy({
      accuracy: 100,
      comparison,
      isReplay: true
    })).toBe(
      "You scored 100% this time. Your first attempt scored higher than about 65% of people who completed this case!"
    );
  });

  it("uses standalone first-person copy only for a first-person comparison", () => {
    expect(getFeaturedComparisonSummaryCopy({
      accuracy: 80,
      comparison: {
        status: "first_person",
        canonicalScore: 80,
        cohortSize: 1,
        percentileBand: null,
        isTopScore: true
      },
      isReplay: false
    })).toBe("You’re the first person to complete this Featured Case.");
  });

  it("uses tie-safe top-score copy for initial attempts and replays", () => {
    const comparison = available({
      canonicalScore: 100,
      percentileBand: 100,
      isTopScore: true
    });

    expect(getFeaturedComparisonSummaryCopy({
      accuracy: 100,
      comparison,
      isReplay: false
    })).toBe("You scored 100%. That’s one of the highest scores so far!");
    expect(getFeaturedComparisonSummaryCopy({
      accuracy: 100,
      comparison,
      isReplay: true
    })).toBe(
      "You scored 100% this time. Your first attempt is among the highest scores so far!"
    );
  });

  it("distinguishes a true top score from a non-leading rounded top band", () => {
    expect(getFeaturedComparisonRankLabel(available({
      percentileBand: 100,
      isTopScore: true
    }))).toBe("Top score");
    expect(getFeaturedComparisonRankLabel(available({
      percentileBand: 95,
      isTopScore: false
    }))).toBe("Top 5%");
  });

  it("uses ordinary top-percent labels and suppresses unavailable ranks", () => {
    expect(getFeaturedComparisonRankLabel(available({
      percentileBand: 65
    }))).toBe("Top 35%");
    expect(getFeaturedComparisonRankLabel({
      status: "first_person",
      canonicalScore: 80,
      cohortSize: 1,
      percentileBand: null,
      isTopScore: true
    })).toBeNull();
    expect(getFeaturedComparisonRankLabel(null)).toBeNull();
  });

  it("retains the no-progression fallback when comparison is unavailable", () => {
    expect(getFeaturedComparisonSummaryCopy({
      accuracy: 80,
      comparison: null,
      isReplay: false
    })).toBe("You scored 80%. Featured Cases do not affect XP or progression.");
  });
});
