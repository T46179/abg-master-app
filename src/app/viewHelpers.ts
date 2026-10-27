import { getDisplayMetricDefinition, getVisibleCaseMetrics, renderMetricValue, type PressureUnit } from "../core/metrics";
import {
  canAccessDifficulty,
  DIFFICULTY_ORDER,
  getReleaseFlags,
  normalizeDifficultyKey,
  type ProgressionStateInput
} from "../core/progression";
import type { CalibrationCompletionRecord, CalibrationPlacement, CaseData } from "../core/types";

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

export function getRenderableMetrics(caseItem: CaseData, options?: { pressureUnit?: PressureUnit }) {
  return getVisibleCaseMetrics(caseItem)
    .map(metric => {
      const displayMetric = getDisplayMetricDefinition(metric, options);
      return {
        ...displayMetric,
        renderedValue: renderMetricValue(metric, options)
      };
    })
    .filter(metric => metric.renderedValue !== "--");
}

export function splitMetrics(caseItem: CaseData, options?: { pressureUnit?: PressureUnit }) {
  const metrics = getRenderableMetrics(caseItem, options);
  return {
    primary: metrics.filter(metric => PRIMARY_METRIC_LABELS.has(metric.label)),
    secondary: metrics.filter(metric => !PRIMARY_METRIC_LABELS.has(metric.label))
  };
}

export function shouldConfirmDifficultySwitch(hasActiveUnfinishedCase: boolean, hasAnsweredSteps: boolean) {
  return hasActiveUnfinishedCase && hasAnsweredSteps;
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

export function getDefaultPracticeDifficulty(
  progressionInput: ProgressionStateInput,
  lastPracticeDifficulty: string | null | undefined
) {
  if (lastPracticeDifficulty && isKnownDifficulty(lastPracticeDifficulty)) {
    return lastPracticeDifficulty;
  }

  if (getReleaseFlags(progressionInput.progressionConfig).enable_open_practice_access) {
    return progressionInput.userState?.calibrationRecommendation ?? progressionInput.userState?.calibrationPlacement ?? "beginner";
  }
  return normalizeDifficultyKey(progressionInput, "intermediate");
}

const CALIBRATION_ALLOWED_DIFFICULTIES: Record<CalibrationPlacement, string[]> = {
  beginner: ["beginner"],
  intermediate: ["beginner", "intermediate"],
  advanced: ["beginner", "intermediate", "advanced"]
};

function isKnownDifficulty(value: string): boolean {
  return DIFFICULTY_ORDER.includes(value as (typeof DIFFICULTY_ORDER)[number]);
}

export function hasCompletedCalibration(record: CalibrationCompletionRecord | null | undefined): record is CalibrationCompletionRecord {
  return Boolean(record?.completed && record.placement);
}

export function getCalibrationAllowedDifficulties(placement: CalibrationPlacement): string[] {
  return CALIBRATION_ALLOWED_DIFFICULTIES[placement] ?? ["beginner"];
}

export function getHighestCalibrationDifficulty(placement: CalibrationPlacement): string {
  const allowed = getCalibrationAllowedDifficulties(placement);
  return allowed[allowed.length - 1] ?? "beginner";
}

export interface PracticeDifficultyResolutionInput {
  requestedDifficulty: string | null | undefined;
  hasExplicitDifficultyParam: boolean;
  calibrationRecord: CalibrationCompletionRecord | null | undefined;
  progressionInput: ProgressionStateInput;
  lastPracticeDifficulty: string | null | undefined;
  enableCalibrationAccessGuard: boolean;
}

export interface PracticeDifficultyResolution {
  resolvedDifficulty: string;
  shouldRedirect: boolean;
  requiresSelection?: boolean;
}

export function resolvePracticeDifficulty(input: PracticeDifficultyResolutionInput): PracticeDifficultyResolution {
  const existingDefault = getDefaultPracticeDifficulty(input.progressionInput, input.lastPracticeDifficulty);
  const requested = input.requestedDifficulty ?? input.lastPracticeDifficulty
    ?? input.calibrationRecord?.recommendation ?? input.calibrationRecord?.placement ?? existingDefault;
  const requestedKey = String(requested ?? "").toLowerCase();

  // Access is independent of earned unlocks. Keep a now-locked preference intact
  // until the learner explicitly chooses an eligible difficulty after reinstatement.
  const calibrationUserState = input.calibrationRecord && input.progressionInput.userState
    ? { ...input.progressionInput.userState, calibrationPlacement: input.calibrationRecord.placement }
    : input.progressionInput.userState;
  const accessInput = { ...input.progressionInput, userState: calibrationUserState };
  if (isKnownDifficulty(requestedKey) && !canAccessDifficulty(accessInput, requestedKey)) {
    return { resolvedDifficulty: requestedKey, shouldRedirect: false, requiresSelection: true };
  }

  if (hasCompletedCalibration(input.calibrationRecord) && isKnownDifficulty(requestedKey)) {
    const calibrationAllowedDifficulties = getCalibrationAllowedDifficulties(input.calibrationRecord.placement);
    if (calibrationAllowedDifficulties.includes(requestedKey)) {
      return {
        resolvedDifficulty: requestedKey,
        shouldRedirect: false
      };
    }
  }

  const resolvedDifficulty = normalizeDifficultyKey(input.progressionInput, requested) || "beginner";

  return {
    resolvedDifficulty,
    shouldRedirect: false
  };
}
