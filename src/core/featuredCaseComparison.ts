import type { FeaturedCaseComparison } from "./types";

interface FeaturedComparisonCopyInput {
  accuracy: number;
  comparison: FeaturedCaseComparison | null | undefined;
  isReplay: boolean;
}

function hasAvailableBand(
  comparison: FeaturedCaseComparison
): comparison is FeaturedCaseComparison & { status: "available"; percentileBand: number } {
  return (
    comparison.status === "available" &&
    comparison.percentileBand != null &&
    Number.isInteger(comparison.percentileBand) &&
    comparison.percentileBand >= 0 &&
    comparison.percentileBand <= 100
  );
}

export function getFeaturedComparisonSummaryCopy({
  accuracy,
  comparison,
  isReplay
}: FeaturedComparisonCopyInput): string {
  if (!comparison) {
    return `You scored ${accuracy}%. Featured Cases do not affect XP or progression.`;
  }

  if (comparison.status === "first_person") {
    return "You’re the first person to complete this Featured Case.";
  }

  if (comparison.isTopScore) {
    return isReplay
      ? `You scored ${accuracy}% this time. Your first attempt is among the highest scores so far!`
      : `You scored ${accuracy}%. That’s one of the highest scores so far!`;
  }

  if (!hasAvailableBand(comparison)) {
    return `You scored ${accuracy}%. Featured Cases do not affect XP or progression.`;
  }

  return isReplay
    ? `You scored ${accuracy}% this time. Your first attempt scored higher than about ${comparison.percentileBand}% of people who completed this case!`
    : `You scored ${accuracy}%. This is higher than about ${comparison.percentileBand}% of people who have completed this case!`;
}

export function getFeaturedComparisonRankLabel(
  comparison: FeaturedCaseComparison | null | undefined
): string | null {
  if (!comparison || comparison.status !== "available") return null;
  if (comparison.isTopScore) return "Top score";
  if (!hasAvailableBand(comparison)) return null;
  if (comparison.percentileBand >= 95) return "Top 5%";
  return `Top ${Math.max(0, 100 - comparison.percentileBand)}%`;
}
