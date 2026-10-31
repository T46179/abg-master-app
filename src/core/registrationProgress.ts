import type { UserState } from "./types";
export function meaningfulRegistrationProgress(input: { user: UserState; seen: Record<string, string[]>; unfinished: boolean; checked: boolean }): boolean | null {
  const u = input.user;
  const meaningful = u.xp > 0 || u.level > 1 || u.casesCompleted > 0 || u.correctAnswers > 0 || u.totalAnswers > 0 || u.streak > 0
    || Boolean(u.calibrationCompleted || u.calibrationCompletedAt || u.recentPracticeAttempts?.length)
    || Object.values(input.seen).some(ids => ids.length > 0) || input.unfinished
    || Object.values(u.learnProgress ?? {}).some(module => module.completed || module.completedLessonCount > 0 || Boolean(module.bestSpeedCheckResult));
  return meaningful ? true : input.checked ? false : null;
}
