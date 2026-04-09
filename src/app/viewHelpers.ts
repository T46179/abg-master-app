import { getVisibleCaseMetrics, renderMetricValue } from "../core/metrics";
import type { CaseData } from "../core/types";

const PRIMARY_METRIC_LABELS = new Set(["pH", "PaCO2", "HCO3"]);

export interface LevelProgressState {
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
}

export function formatElapsed(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.0s";
  if (seconds > 300) return "> 5 min";
  return `${seconds.toFixed(1)}s`;
}

export function formatLevelProgressText(levelProgress: Pick<LevelProgressState, "xpIntoLevel" | "xpForNextLevel">, totalXp: number) {
  return levelProgress.xpForNextLevel
    ? `${levelProgress.xpIntoLevel} / ${levelProgress.xpForNextLevel} XP`
    : `${totalXp} XP`;
}

export function getInitialsLabel(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getRenderableMetrics(caseItem: CaseData) {
  return getVisibleCaseMetrics(caseItem)
    .map(metric => ({
      ...metric,
      renderedValue: renderMetricValue(metric)
    }))
    .filter(metric => metric.renderedValue !== "--");
}

export function splitMetrics(caseItem: CaseData) {
  const metrics = getRenderableMetrics(caseItem);
  return {
    primary: metrics.filter(metric => PRIMARY_METRIC_LABELS.has(metric.label)),
    secondary: metrics.filter(metric => !PRIMARY_METRIC_LABELS.has(metric.label))
  };
}

export function shouldConfirmDifficultySwitch(hasActiveUnfinishedCase: boolean, hasAnsweredSteps: boolean) {
  return hasActiveUnfinishedCase && hasAnsweredSteps;
}

export function shouldShowPracticeIntro(hasSeenPracticeIntro: boolean, hasActiveCase: boolean, hasSummary: boolean) {
  return !hasSeenPracticeIntro && !hasActiveCase && !hasSummary;
}

export function getPracticeDifficultyMismatchAction(input: {
  hasExplicitDifficultyParam: boolean;
  hasActiveCase: boolean;
  hasSummary: boolean;
  activeCaseDifficulty: string | null;
  normalizedDifficulty: string;
}) {
  if (!input.hasActiveCase || input.hasSummary || !input.activeCaseDifficulty) return null;
  if (input.activeCaseDifficulty === input.normalizedDifficulty) return null;
  return input.hasExplicitDifficultyParam ? "replace_active_case" : "resume_active_case";
}
