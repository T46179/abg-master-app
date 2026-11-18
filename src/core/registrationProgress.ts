import type { PracticeFlowState, SessionState, UserState } from "./types";
import { parseStoredUserState, STORAGE_KEYS, type BrowserStorageLike } from "./storage";
import { loadPendingCalibrationCompletion, PENDING_CALIBRATION_STORAGE_KEY } from "./calibrationRecovery";
import { loadPendingPracticeSubmission, PENDING_SUBMISSION_STORAGE_KEY } from "./protectedPracticeCache";

export function hasUnfinishedPracticeAnswers(practice: PracticeFlowState, session: SessionState): boolean {
  return Boolean(practice.currentCase && (session.selectedAnswers.some(Boolean) || session.stepResults.some(Boolean)));
}

export function meaningfulRegistrationProgress(input: { user: UserState; seen: Record<string, string[]>; unfinished: boolean; checked: boolean }): boolean | null {
  const u = input.user;
  const meaningful = u.xp > 0 || u.level > 1 || u.casesCompleted > 0 || u.correctAnswers > 0 || u.totalAnswers > 0 || u.streak > 0
    || Boolean(u.calibrationCompleted || u.calibrationCompletedAt || u.recentPracticeAttempts?.length)
    || Object.values(input.seen).some(ids => ids.length > 0) || input.unfinished
    || Object.values(u.learnProgress ?? {}).some(module => module.completed || module.completedLessonCount > 0 || Boolean(module.bestSpeedCheckResult));
  return meaningful ? true : input.checked ? false : null;
}

/** Read the live owner-scoped stores. The normal hydration readers can treat unreadable data as absent. */
export function readLocalGuestProgress(storage: BrowserStorageLike, user: UserState, unfinished: boolean): boolean | null {
  try {
    const saved = storage.getItem(STORAGE_KEYS.USER_STATE_STORAGE_KEY);
    const savedUser = parseStoredUserState(saved);
    const seen: unknown = JSON.parse(storage.getItem(STORAGE_KEYS.SEEN_CASES_STORAGE_KEY) ?? "{}");
    if ((saved !== null && (!savedUser || Array.isArray(savedUser))) ||
        !seen || typeof seen !== "object" || Array.isArray(seen) ||
        Object.values(seen).some(ids => !Array.isArray(ids))) return null;
    const practice = storage.getItem(PENDING_SUBMISSION_STORAGE_KEY);
    const calibration = storage.getItem(PENDING_CALIBRATION_STORAGE_KEY);
    const journal = { getItem: (key: string) => key === PENDING_SUBMISSION_STORAGE_KEY ? practice : calibration,
      setItem: () => {}, removeItem: () => {} };
    if ((practice !== null && !loadPendingPracticeSubmission(journal)) ||
        (calibration !== null && !loadPendingCalibrationCompletion(journal))) return null;
    const drafts = [STORAGE_KEYS.CALIBRATION_COMPLETION_STORAGE_KEY, STORAGE_KEYS.FEATURED_CASE_DRAFT_STORAGE_KEY]
      .flatMap(key => {
        const value = storage.getItem(key);
        return value === null ? [] : [JSON.parse(value) as unknown];
      });
    if (drafts.some(draft => !draft || typeof draft !== "object" || Array.isArray(draft))) return null;
    const hasJournal = practice !== null || calibration !== null || drafts.length > 0;
    const input = { seen: seen as Record<string, string[]>, unfinished: unfinished || hasJournal, checked: true };
    return meaningfulRegistrationProgress({ ...input, user }) === true ||
      (savedUser !== null && meaningfulRegistrationProgress({ ...input, user: savedUser }) === true);
  } catch {
    return null;
  }
}
