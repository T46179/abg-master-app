import type { CalibrationCompletionRecord, UserState } from "./types";

export const REMOTE_PROGRESS_TIMEOUT_MS = 10_000;

export type RemoteCalibrationStatus = "loading" | "loaded" | "absent" | "unavailable";
export type CalibrationCompletionSource = "remote" | "local" | "none";

export interface CalibrationResolutionState {
  localCompletion: CalibrationCompletionRecord | null;
  remoteCompletion: CalibrationCompletionRecord | null;
  remoteStatus: RemoteCalibrationStatus;
  effectiveCompletion: CalibrationCompletionRecord | null;
  completionSource: CalibrationCompletionSource;
}

export interface CalibrationProgressEvidence {
  userState: UserState;
  seenCasesByDifficulty?: Record<string, string[]> | null;
  hasActiveCase?: boolean;
  hasSummary?: boolean;
  hasPendingSubmission?: boolean;
}

const LEARNER_ENTRY_ROUTES = [
  "/dashboard",
  "/practice",
  "/learn",
  "/insights",
  "/exam",
  "/leaderboard"
] as const;

export function isLearnerEntryRoute(pathname: string): boolean {
  const normalized = `/${String(pathname ?? "").replace(/^\/+|\/+$/g, "")}`;
  return LEARNER_ENTRY_ROUTES.some(route => (
    normalized === route || (route === "/learn" && normalized.startsWith("/learn/"))
  ));
}

export function resolveCalibrationState(input: {
  localCompletion: CalibrationCompletionRecord | null;
  remoteCompletion: CalibrationCompletionRecord | null;
  remoteStatus: RemoteCalibrationStatus;
}): CalibrationResolutionState {
  if (input.remoteCompletion) {
    return {
      ...input,
      effectiveCompletion: input.remoteCompletion,
      completionSource: "remote"
    };
  }

  if (input.localCompletion) {
    return {
      ...input,
      effectiveCompletion: input.localCompletion,
      completionSource: "local"
    };
  }

  return {
    ...input,
    effectiveCompletion: null,
    completionSource: "none"
  };
}

export function hasMeaningfulCalibrationProgress(input: CalibrationProgressEvidence): boolean {
  const userState = input.userState;
  const hasSeenCases = Object.values(input.seenCasesByDifficulty ?? {}).some(caseIds => caseIds.length > 0);

  return Boolean(
    userState.casesCompleted > 0 ||
    userState.abandonedCases > 0 ||
    userState.totalAnswers > 0 ||
    userState.correctAnswers > 0 ||
    userState.xp > 0 ||
    userState.level > 1 ||
    userState.appliedProtectedCaseTokens?.length ||
    userState.recentResults?.length ||
    userState.recentPracticeAttempts?.length ||
    hasSeenCases ||
    input.hasActiveCase ||
    input.hasSummary ||
    input.hasPendingSubmission
  );
}

export function shouldHoldLearnerRouteForCalibration(input: {
  pathname: string;
  calibration: CalibrationResolutionState;
  hasMeaningfulProgress: boolean;
}): boolean {
  return Boolean(
    isLearnerEntryRoute(input.pathname) &&
    !input.hasMeaningfulProgress &&
    !input.calibration.localCompletion &&
    !input.calibration.remoteCompletion &&
    input.calibration.remoteStatus === "loading"
  );
}

export function shouldRedirectToCalibrationOnboarding(input: {
  pathname: string;
  calibration: CalibrationResolutionState;
  hasMeaningfulProgress: boolean;
}): boolean {
  return Boolean(
    isLearnerEntryRoute(input.pathname) &&
    !input.hasMeaningfulProgress &&
    !input.calibration.effectiveCompletion &&
    input.calibration.remoteStatus !== "loading"
  );
}

export function shouldShowCalibrationIntroduction(input: {
  calibration: CalibrationResolutionState;
  hasMeaningfulProgress: boolean;
  hasSeenIntroduction: boolean;
  hasVisitedAppArea: boolean;
}): boolean {
  if (input.calibration.effectiveCompletion) return false;
  if (input.calibration.remoteStatus === "loading") return false;
  if (input.hasMeaningfulProgress) return false;
  return !input.hasSeenIntroduction && !input.hasVisitedAppArea;
}

export async function settleWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs = REMOTE_PROGRESS_TIMEOUT_MS
): Promise<{ status: "resolved"; value: T } | { status: "timeout" }> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise.then(value => ({ status: "resolved" as const, value })),
      new Promise<{ status: "timeout" }>(resolve => {
        timeoutId = setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}
