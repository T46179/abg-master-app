import type {
  CalibrationCompletionRecord,
  CalibrationPlacement,
  DashboardState,
  DefaultUserStateSnapshot,
  ProgressRow,
  ProgressionConfig,
  PracticeAttemptSummary,
  ReleaseFlags,
  UserState
} from "./types";

export const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "master"] as const;
export const DEFAULT_PROGRESSION_VERSION = "v2";
export const DEFAULT_BETA_RELEASE_NUMBER = 2;

const CALIBRATION_GRANTED_ACCESS: Record<CalibrationPlacement, string[]> = {
  beginner: ["beginner"],
  intermediate: ["beginner", "intermediate"],
  advanced: ["beginner", "intermediate", "advanced"]
};

export interface ProgressionStateInput {
  progressionConfig: ProgressionConfig | null;
  dashboardState?: DashboardState | null;
  defaultUserState?: DefaultUserStateSnapshot | null;
  userState?: UserState;
  cases?: { difficulty_level?: number }[];
}

export function normalizeSubscriptionTier(value: unknown): string {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "premium" || normalized === "exam_prep") return normalized;
  return "free";
}

export function calculateAccuracy(correctAnswers = 0, totalAnswers = 0): number {
  if (!totalAnswers) return 100;
  return Math.round((correctAnswers / totalAnswers) * 100);
}

export function getReleaseFlags(progressionConfig: ProgressionConfig | null): ReleaseFlags {
  const flags = progressionConfig?.release_flags ?? {};
  return {
    enable_all_difficulties: Boolean(flags.enable_all_difficulties),
    enable_unlimited_cases: Boolean(flags.enable_unlimited_cases),
    enable_learn_preview: Boolean(flags.enable_learn_preview),
    xp_multiplier: Number(flags.xp_multiplier) || 1,
    enable_beta_badge: Boolean(flags.enable_beta_badge),
    enableCalibrationAccessGuard: Boolean(flags.enableCalibrationAccessGuard)
  };
}

export function getProgressionVersion(progressionConfig: ProgressionConfig | null): string {
  return String(progressionConfig?.version ?? DEFAULT_PROGRESSION_VERSION);
}

export function getBetaReleaseNumber(progressionConfig: ProgressionConfig | null): number {
  const configured = Number(progressionConfig?.beta_release_number ?? DEFAULT_BETA_RELEASE_NUMBER);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_BETA_RELEASE_NUMBER;
}

export function getDifficultyLabel(progressionConfig: ProgressionConfig | null, level: number): string {
  const configured = progressionConfig?.difficulty_labels?.[level];
  return String(configured ?? DIFFICULTY_ORDER[level - 1] ?? `difficulty_${level}`).toLowerCase();
}

export function getDifficultyLevel(progressionConfig: ProgressionConfig | null, label: string): number {
  const normalized = String(label ?? "").toLowerCase();
  for (const [level, mappedLabel] of Object.entries(progressionConfig?.difficulty_labels ?? {})) {
    if (String(mappedLabel).toLowerCase() === normalized) {
      return Number(level);
    }
  }

  const fallbackIndex = DIFFICULTY_ORDER.indexOf(normalized as (typeof DIFFICULTY_ORDER)[number]);
  return fallbackIndex >= 0 ? fallbackIndex + 1 : 1;
}

export function getDifficultyMeta(input: ProgressionStateInput) {
  return DIFFICULTY_ORDER.map((key, index) => {
    const level = index + 1;
    return {
      key,
      level,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      unlockLevel: Number(input.progressionConfig?.difficulty_unlock_levels?.[level] ?? level),
      availableCases: (input.cases ?? []).filter(caseItem => Number(caseItem.difficulty_level ?? 1) === level).length
    };
  });
}

export function getUnlockedDifficultyKeys(input: ProgressionStateInput, level: number): string[] {
  return getDifficultyMeta(input)
    .filter(item => level >= item.unlockLevel)
    .map(item => item.key);
}

export function sanitizeUnlockedDifficulties(difficulties: unknown): string[] {
  const normalized = Array.isArray(difficulties)
    ? difficulties.map(item => String(item).toLowerCase()).filter(Boolean)
    : [];

  const allowed = new Set(DIFFICULTY_ORDER);
  const unique = normalized.filter((item, index) => allowed.has(item as (typeof DIFFICULTY_ORDER)[number]) && normalized.indexOf(item) === index);
  return unique.length ? unique : ["beginner"];
}

export function getDifficultyRank(difficultyKey: string | null | undefined): number {
  const normalized = String(difficultyKey ?? "").toLowerCase();
  const index = DIFFICULTY_ORDER.indexOf(normalized as (typeof DIFFICULTY_ORDER)[number]);
  return index >= 0 ? index + 1 : 1;
}

export function getDifficultyKeyForRank(rank: number): string {
  const index = Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, Math.round(rank) - 1));
  return DIFFICULTY_ORDER[index] ?? "beginner";
}

export function getCalibrationGrantedDifficulties(placement: CalibrationPlacement | null | undefined): string[] {
  return placement ? CALIBRATION_GRANTED_ACCESS[placement] ?? ["beginner"] : ["beginner"];
}

export function getEarnedUnlockDifficulties(source: Pick<UserState, "intermediateUnlockedAt" | "advancedUnlockedAt" | "masterUnlockedAt"> | null | undefined): string[] {
  const earned = ["beginner"];
  if (source?.intermediateUnlockedAt) earned.push("intermediate");
  if (source?.advancedUnlockedAt) earned.push("advanced");
  if (source?.masterUnlockedAt) earned.push("master");
  return earned;
}

export function getSkillEligibleDifficultyKeys(userState: UserState | null | undefined): string[] {
  const calibrationGrantedAccess = getCalibrationGrantedDifficulties(userState?.calibrationPlacement ?? null);
  const earnedUnlockAccess = getEarnedUnlockDifficulties(userState);
  const highestRank = Math.max(
    ...calibrationGrantedAccess.map(getDifficultyRank),
    ...earnedUnlockAccess.map(getDifficultyRank),
    1
  );
  return DIFFICULTY_ORDER.slice(0, highestRank);
}

export function getCalibrationCompletionFromUserState(userState: UserState | null | undefined): CalibrationCompletionRecord | null {
  if (!userState?.calibrationCompleted || !userState.calibrationPlacement) return null;
  return {
    completed: true,
    placement: userState.calibrationPlacement,
    version: 2
  };
}

export function getXpRequiredForLevel(progressionConfig: ProgressionConfig | null, level: number): number {
  return Number(progressionConfig?.xp_required_per_level?.[level] ?? 0);
}

function getConfiguredProgressionCap(progressionConfig: ProgressionConfig | null) {
  const configured = progressionConfig?.xp_required_per_level;
  if (!configured || !Object.keys(configured).length) return null;

  let maxXp = 0;
  let maxLevel = 1;

  while (true) {
    const needed = getXpRequiredForLevel(progressionConfig, maxLevel);
    if (!needed) {
      return {
        maxLevel,
        maxXp
      };
    }

    maxXp += needed;
    maxLevel += 1;
  }
}

export function getMaxReachableLevel(progressionConfig: ProgressionConfig | null): number | null {
  return getConfiguredProgressionCap(progressionConfig)?.maxLevel ?? null;
}

export function getMaxReachableXp(progressionConfig: ProgressionConfig | null): number | null {
  return getConfiguredProgressionCap(progressionConfig)?.maxXp ?? null;
}

export function clampXpToLevelCap(progressionConfig: ProgressionConfig | null, xp: number): number {
  const normalizedXp = Math.max(0, Number(xp) || 0);
  const maxXp = getMaxReachableXp(progressionConfig);
  return maxXp == null ? normalizedXp : Math.min(normalizedXp, maxXp);
}

export function getAwardableXp(progressionConfig: ProgressionConfig | null, currentXp: number, requestedXp: number): number {
  const normalizedAward = Math.max(0, Math.round(Number(requestedXp) || 0));
  const maxXp = getMaxReachableXp(progressionConfig);
  if (maxXp == null) return normalizedAward;

  const cappedCurrentXp = clampXpToLevelCap(progressionConfig, currentXp);
  return Math.max(0, Math.min(normalizedAward, maxXp - cappedCurrentXp));
}

function getTotalXpRequiredBeforeLevel(progressionConfig: ProgressionConfig | null, level: number): number {
  let total = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += getXpRequiredForLevel(progressionConfig, currentLevel);
  }
  return total;
}

function getDifficultyUnlockLevel(progressionConfig: ProgressionConfig | null, difficultyKey: string): number | null {
  const difficultyLevel = getDifficultyLevel(progressionConfig, difficultyKey);
  const fallbackUnlockLevel = difficultyKey === "intermediate"
    ? 5
    : difficultyKey === "advanced"
      ? 10
      : difficultyKey === "master"
        ? 15
        : difficultyLevel;
  const unlockLevel = Number(progressionConfig?.difficulty_unlock_levels?.[difficultyLevel] ?? fallbackUnlockLevel);
  return Number.isFinite(unlockLevel) && unlockLevel > 1 ? unlockLevel : null;
}

function getGateCapXp(progressionConfig: ProgressionConfig | null, unlockLevel: number): number | null {
  const previousLevel = Math.max(1, unlockLevel - 1);
  const previousLevelRequirement = getXpRequiredForLevel(progressionConfig, previousLevel);
  if (!previousLevelRequirement) return null;

  return getTotalXpRequiredBeforeLevel(progressionConfig, previousLevel) + Math.max(0, Math.floor(previousLevelRequirement * 0.99));
}

function hasCalibrationGrantedDifficulty(userState: UserState, difficulty: string): boolean {
  return getCalibrationGrantedDifficulties(userState.calibrationPlacement ?? null).includes(difficulty);
}

export function normalizePracticeAttemptSummaries(source: unknown): PracticeAttemptSummary[] {
  if (!Array.isArray(source)) return [];

  const normalized: PracticeAttemptSummary[] = [];
  source.forEach(item => {
      const attempt = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const difficulty = String(attempt.difficulty ?? "").trim().toLowerCase();
      const correctSteps = Math.max(0, Math.round(Number(attempt.correctSteps ?? 0) || 0));
      const totalSteps = Math.max(0, Math.round(Number(attempt.totalSteps ?? 0) || 0));
      if (!difficulty || totalSteps <= 0) return;
      normalized.push({
        difficulty,
        correctSteps: Math.min(correctSteps, totalSteps),
        totalSteps,
        completedAt: attempt.completedAt == null ? null : String(attempt.completedAt)
      });
    });

  return normalized.slice(-20);
}

export function appendPracticeAttemptSummary(
  userState: UserState,
  attempt: PracticeAttemptSummary
): PracticeAttemptSummary[] {
  return normalizePracticeAttemptSummaries([
    ...normalizePracticeAttemptSummaries(userState.recentPracticeAttempts),
    attempt
  ]);
}

function getPerformanceRequirement(progressionConfig: ProgressionConfig | null, difficultyKey: string) {
  const configured = progressionConfig?.performance_unlock_requirements?.[difficultyKey];
  return {
    lastCases: Math.max(1, Math.round(Number(configured?.lastCases ?? 5) || 5)),
    minStepAccuracyPercent: Math.max(0, Math.min(100, Number(configured?.minStepAccuracyPercent ?? 75) || 75)),
    requiredDifficulty: String(configured?.requiredDifficulty ?? (difficultyKey === "master" ? "advanced" : "any_practice")).toLowerCase()
  };
}

function isAttemptEligibleForRequirement(attempt: PracticeAttemptSummary, requiredDifficulty: string): boolean {
  if (requiredDifficulty === "any_practice" || requiredDifficulty === "any" || !requiredDifficulty) return true;
  return attempt.difficulty === requiredDifficulty;
}

export function isPerformanceGateReady(
  progressionConfig: ProgressionConfig | null,
  difficultyKey: "advanced" | "master",
  attempts: PracticeAttemptSummary[]
): boolean {
  const requirement = getPerformanceRequirement(progressionConfig, difficultyKey);
  const recentEligibleAttempts = normalizePracticeAttemptSummaries(attempts)
    .filter(attempt => isAttemptEligibleForRequirement(attempt, requirement.requiredDifficulty))
    .slice(-requirement.lastCases);

  if (recentEligibleAttempts.length < requirement.lastCases) return false;

  const totalSteps = recentEligibleAttempts.reduce((sum, attempt) => sum + attempt.totalSteps, 0);
  const correctSteps = recentEligibleAttempts.reduce((sum, attempt) => sum + attempt.correctSteps, 0);
  if (totalSteps <= 0) return false;

  return (correctSteps / totalSteps) * 100 >= requirement.minStepAccuracyPercent;
}

export function getBlockedXpGate(
  progressionConfig: ProgressionConfig | null,
  userState: UserState
): { difficulty: "advanced" | "master"; capXp: number; unlockLevel: number } | null {
  const normalizedAttempts = normalizePracticeAttemptSummaries(userState.recentPracticeAttempts);

  for (const difficulty of ["advanced", "master"] as const) {
    if (getEarnedUnlockDifficulties(userState).includes(difficulty)) continue;
    if (hasCalibrationGrantedDifficulty(userState, difficulty)) continue;
    const unlockLevel = getDifficultyUnlockLevel(progressionConfig, difficulty);
    if (!unlockLevel) continue;
    const thresholdXp = getTotalXpRequiredBeforeLevel(progressionConfig, unlockLevel);
    if (userState.xp < thresholdXp && getLevelFromXp(progressionConfig, userState.xp, userState.level) < unlockLevel) {
      const capXp = getGateCapXp(progressionConfig, unlockLevel);
      if (capXp != null && userState.xp >= capXp && !isPerformanceGateReady(progressionConfig, difficulty, normalizedAttempts)) {
        return { difficulty, capXp, unlockLevel };
      }
    }
  }

  return null;
}

export function getAwardableXpWithReadinessGates(input: {
  progressionConfig: ProgressionConfig | null;
  userState: UserState;
  requestedXp: number;
  attemptsIncludingCurrent: PracticeAttemptSummary[];
}): number {
  const normalizedAward = getAwardableXp(input.progressionConfig, input.userState.xp, input.requestedXp);
  if (normalizedAward <= 0) return 0;

  const maxAllowedXp = (["advanced", "master"] as const).reduce<number | null>((currentCap, difficulty) => {
    if (getEarnedUnlockDifficulties(input.userState).includes(difficulty)) return currentCap;
    if (hasCalibrationGrantedDifficulty(input.userState, difficulty)) return currentCap;
    const unlockLevel = getDifficultyUnlockLevel(input.progressionConfig, difficulty);
    if (!unlockLevel) return currentCap;
    const thresholdXp = getTotalXpRequiredBeforeLevel(input.progressionConfig, unlockLevel);
    if (input.userState.xp >= thresholdXp || input.userState.xp + normalizedAward < thresholdXp) return currentCap;
    if (isPerformanceGateReady(input.progressionConfig, difficulty, input.attemptsIncludingCurrent)) return currentCap;

    const gateCap = getGateCapXp(input.progressionConfig, unlockLevel);
    if (gateCap == null) return currentCap;
    return currentCap == null ? gateCap : Math.min(currentCap, gateCap);
  }, null);

  if (maxAllowedXp == null) return normalizedAward;
  return Math.max(0, Math.min(normalizedAward, maxAllowedXp - input.userState.xp));
}

export function applyDifficultyUnlocks(input: {
  progressionConfig: ProgressionConfig | null;
  userState: UserState;
  attempts: PracticeAttemptSummary[];
  now?: Date;
}): UserState {
  const nowIso = (input.now ?? new Date()).toISOString();
  let nextUserState = { ...input.userState };

  const intermediateLevel = getDifficultyUnlockLevel(input.progressionConfig, "intermediate") ?? 5;
  if (!nextUserState.intermediateUnlockedAt && nextUserState.level >= intermediateLevel) {
    nextUserState.intermediateUnlockedAt = nowIso;
  }

  if (
    !nextUserState.advancedUnlockedAt &&
    nextUserState.level >= (getDifficultyUnlockLevel(input.progressionConfig, "advanced") ?? 10) &&
    isPerformanceGateReady(input.progressionConfig, "advanced", input.attempts)
  ) {
    nextUserState.advancedUnlockedAt = nowIso;
  }

  if (
    !nextUserState.masterUnlockedAt &&
    nextUserState.level >= (getDifficultyUnlockLevel(input.progressionConfig, "master") ?? 15) &&
    isPerformanceGateReady(input.progressionConfig, "master", input.attempts)
  ) {
    nextUserState.masterUnlockedAt = nowIso;
  }

  return syncUserStateDerivedFields(nextUserState, input.progressionConfig);
}

export function getLevelFromXp(progressionConfig: ProgressionConfig | null, xp: number, fallbackLevel = 1): number {
  const configured = progressionConfig?.xp_required_per_level;
  if (!configured) return Math.max(1, fallbackLevel);

  let runningTotal = 0;
  let currentLevel = 1;

  while (true) {
    const needed = getXpRequiredForLevel(progressionConfig, currentLevel);
    if (!needed) return currentLevel;
    if (xp < runningTotal + needed) return currentLevel;
    runningTotal += needed;
    currentLevel += 1;
  }
}

export function getLevelProgress(progressionConfig: ProgressionConfig | null, userState: UserState) {
  const cappedXp = clampXpToLevelCap(progressionConfig, userState.xp);
  const level = Math.max(1, getLevelFromXp(progressionConfig, cappedXp, userState.level));
  let consumedXp = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    consumedXp += getXpRequiredForLevel(progressionConfig, currentLevel);
  }

  let xpForNextLevel = getXpRequiredForLevel(progressionConfig, level);
  let xpIntoLevel = Math.max(0, cappedXp - consumedXp);
  let progressPercent = xpForNextLevel
    ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
    : 100;
  const isMaxLevel = !xpForNextLevel && getMaxReachableLevel(progressionConfig) === level;

  if (isMaxLevel && level > 1) {
    xpForNextLevel = getXpRequiredForLevel(progressionConfig, level - 1);
    xpIntoLevel = xpForNextLevel || xpIntoLevel;
    progressPercent = 100;
  }

  const blockedGate = getBlockedXpGate(progressionConfig, { ...userState, xp: cappedXp });

  return {
    xpIntoLevel,
    xpForNextLevel,
    progressPercent: blockedGate ? 99 : progressPercent,
    isBlockedByReadinessGate: Boolean(blockedGate),
    blockedDifficulty: blockedGate?.difficulty ?? null,
    isMaxLevel
  };
}

export function getTimeBonus(progressionConfig: ProgressionConfig | null, secondsTaken: number): number {
  const tiers = progressionConfig?.speed_bonus_tiers ?? [];
  for (const tier of tiers) {
    if (secondsTaken <= Number(tier.max_seconds ?? Number.POSITIVE_INFINITY)) {
      return Number(tier.bonus ?? 0);
    }
  }
  return 0;
}

export function getPerfectBonus(progressionConfig: ProgressionConfig | null, difficultyLevel: number): number {
  const base = Number(progressionConfig?.base_xp_by_difficulty?.[difficultyLevel] ?? 0);
  const percentage = Number(progressionConfig?.perfect_case_bonus_percent ?? 0);
  return Math.round(base * percentage);
}

export function getBaseXp(progressionConfig: ProgressionConfig | null, difficultyLevel: number): number {
  return Number(progressionConfig?.base_xp_by_difficulty?.[difficultyLevel] ?? 10);
}

export function getEffectiveXpMultiplier(progressionConfig: ProgressionConfig | null): number {
  return Math.max(1, getReleaseFlags(progressionConfig).xp_multiplier);
}

export function getDailyLimit(progressionConfig: ProgressionConfig | null): number {
  return Number(progressionConfig?.free_daily_case_limit ?? 0);
}

export function getConfiguredSubscriptionTier(input: ProgressionStateInput): string {
  return normalizeSubscriptionTier(
    input.dashboardState?.user?.subscription_tier ??
      input.defaultUserState?.subscription_tier ??
      (input.userState?.isPremium ? "premium" : "free")
  );
}

export function getEffectiveSubscriptionTier(input: ProgressionStateInput): string {
  return getConfiguredSubscriptionTier(input);
}

export function getEffectiveUnlockedDifficulty(input: ProgressionStateInput): number {
  const releaseFlags = getReleaseFlags(input.progressionConfig);
  const subscriptionTier = getEffectiveSubscriptionTier(input);
  const userState = input.userState;

  if (releaseFlags.enable_all_difficulties || subscriptionTier === "exam_prep") {
    return DIFFICULTY_ORDER.length;
  }

  return getSkillEligibleDifficultyKeys(userState ?? createEmptyUserState()).length;
}

export function canAccessLearn(input: ProgressionStateInput): boolean {
  const releaseFlags = getReleaseFlags(input.progressionConfig);
  const subscriptionTier = getEffectiveSubscriptionTier(input);
  return releaseFlags.enable_learn_preview || subscriptionTier === "premium" || subscriptionTier === "exam_prep";
}

export function canAccessDifficulty(input: ProgressionStateInput, difficultyLevel: number | string): boolean {
  const requestedLevel = typeof difficultyLevel === "number"
    ? difficultyLevel
    : getDifficultyLevel(input.progressionConfig, difficultyLevel);
  return requestedLevel <= getEffectiveUnlockedDifficulty(input);
}

export function getAccessibleDifficultyKeys(input: ProgressionStateInput): string[] {
  return getDifficultyMeta(input)
    .filter(item => canAccessDifficulty(input, item.level))
    .map(item => item.key);
}

export function getHighestAccessibleDifficultyKey(input: ProgressionStateInput): string {
  const accessible = getAccessibleDifficultyKeys(input);
  return accessible[accessible.length - 1] ?? "beginner";
}

export function normalizeDifficultyKey(input: ProgressionStateInput, difficultyKey: string): string {
  const normalized = String(difficultyKey ?? "").toLowerCase();
  const requestedLevel = getDifficultyLevel(input.progressionConfig, normalized);

  if (canAccessDifficulty(input, requestedLevel)) {
    return getDifficultyLabel(input.progressionConfig, requestedLevel);
  }

  return getHighestAccessibleDifficultyKey(input);
}

export function canStartNewCase(input: ProgressionStateInput): boolean {
  const releaseFlags = getReleaseFlags(input.progressionConfig);
  const subscriptionTier = getEffectiveSubscriptionTier(input);
  if (releaseFlags.enable_unlimited_cases || subscriptionTier === "premium" || subscriptionTier === "exam_prep") {
    return true;
  }

  const remaining = getCasesRemainingToday(input.progressionConfig, input.userState ?? createEmptyUserState());
  return remaining == null || remaining > 0;
}

export function getCasesRemainingToday(progressionConfig: ProgressionConfig | null, userState: UserState): number | null {
  const dailyLimit = getDailyLimit(progressionConfig);
  const releaseFlags = getReleaseFlags(progressionConfig);
  if (releaseFlags.enable_unlimited_cases || userState.isPremium || !dailyLimit) {
    return null;
  }
  return Math.max(0, dailyLimit - userState.dailyCasesUsed);
}

export function getReleaseSignature(progressionConfig: ProgressionConfig | null): string {
  return JSON.stringify({
    progressionVersion: getProgressionVersion(progressionConfig),
    betaReleaseNumber: getBetaReleaseNumber(progressionConfig)
  });
}

export function mapProgressRowToUserState(source: Partial<ProgressRow> | null | undefined): Partial<UserState> | null {
  if (!source || typeof source !== "object") return null;

  return {
    xp: Number(source.xp ?? 0),
    level: Number(source.level ?? 1),
    streak: Number(source.streak ?? 0),
    casesCompleted: Number(source.cases_completed ?? 0),
    correctAnswers: Number(source.correct_answers ?? 0),
    totalAnswers: Number(source.total_answers ?? 0),
    lastCaseDate: source.last_case_date ?? null,
    progressionVersion: source.progression_version ?? null,
    betaReleaseNumber: source.beta_release_number == null ? null : Number(source.beta_release_number),
    calibrationCompleted: Boolean(source.calibration_completed),
    calibrationPlacement: source.calibration_placement ?? null,
    calibrationCompletedAt: source.calibration_completed_at ?? null,
    intermediateUnlockedAt: source.intermediate_unlocked_at ?? null,
    advancedUnlockedAt: source.advanced_unlocked_at ?? null,
    masterUnlockedAt: source.master_unlocked_at ?? null,
    resetAt: source.reset_at ?? null,
    unlockedDifficulties: sanitizeUnlockedDifficulties([
      ...getCalibrationGrantedDifficulties(source.calibration_placement ?? null),
      ...getEarnedUnlockDifficulties({
        intermediateUnlockedAt: source.intermediate_unlocked_at ?? null,
        advancedUnlockedAt: source.advanced_unlocked_at ?? null,
        masterUnlockedAt: source.master_unlocked_at ?? null
      })
    ])
  };
}

export function mapDefaultUserState(
  source: DefaultUserStateSnapshot,
  input: Pick<ProgressionStateInput, "progressionConfig" | "dashboardState">
): UserState {
  const level = Number(source?.level ?? 1);
  const unlockedFromSource: string[] = [];

  if (source?.unlocked_difficulty_label) {
    unlockedFromSource.push(String(source.unlocked_difficulty_label).toLowerCase());
  }

  if (source?.unlocked_difficulty != null) {
    unlockedFromSource.push(getDifficultyLabel(input.progressionConfig, Number(source.unlocked_difficulty)));
  }

  return syncUserStateDerivedFields({
    xp: Number(source?.total_xp ?? source?.xp ?? 0),
    level,
    casesCompleted: Number(input.dashboardState?.stats?.cases_completed ?? source?.cases_completed ?? 0),
    abandonedCases: Number(source?.abandoned_cases ?? 0),
    correctAnswers: Number(source?.correct_answers ?? 0),
    totalAnswers: Number(source?.total_answers ?? 0),
    streak: Number(source?.streak_days ?? source?.streak ?? 0),
    dailyCasesUsed: Number(source?.cases_completed_today ?? source?.dailyCasesUsed ?? 0),
    lastCaseDate: source?.lastCaseDate ?? null,
    unlockedDifficulties: sanitizeUnlockedDifficulties([
      ...unlockedFromSource,
      ...getUnlockedDifficultyKeys(
        { progressionConfig: input.progressionConfig },
        level
      )
    ]),
    isPremium: normalizeSubscriptionTier(source?.subscription_tier) === "premium" || Boolean(source?.isPremium),
    badges: Array.isArray(input.dashboardState?.stats?.recent_badges)
      ? [...input.dashboardState.stats.recent_badges]
      : Array.isArray(source?.badges)
        ? [...source.badges]
        : [],
    recentResults: [],
    recentPracticeAttempts: [],
    appliedProtectedCaseTokens: [],
    learnProgress: {}
  }, input.progressionConfig);
}

export function syncUserStateDerivedFields(userState: UserState, progressionConfig: ProgressionConfig | null): UserState {
  const cappedXp = clampXpToLevelCap(progressionConfig, userState.xp);
  const nextLevel = Math.max(1, getLevelFromXp(progressionConfig, cappedXp, userState.level));
  return {
    ...userState,
    xp: cappedXp,
    level: nextLevel,
    recentPracticeAttempts: normalizePracticeAttemptSummaries(userState.recentPracticeAttempts),
    unlockedDifficulties: sanitizeUnlockedDifficulties(getSkillEligibleDifficultyKeys(userState))
  };
}

export function createEmptyUserState(): UserState {
  return {
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
    recentPracticeAttempts: [],
    appliedProtectedCaseTokens: [],
    learnProgress: {}
  };
}

