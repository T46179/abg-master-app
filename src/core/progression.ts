import type {
  DashboardState,
  DefaultUserStateSnapshot,
  ProgressionConfig,
  ReleaseFlags,
  UserState
} from "./types";

export const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "master"] as const;

interface ProgressionStateInput {
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
    enable_beta_badge: Boolean(flags.enable_beta_badge)
  };
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

export function getXpRequiredForLevel(progressionConfig: ProgressionConfig | null, level: number): number {
  return Number(progressionConfig?.xp_required_per_level?.[level] ?? 0);
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
  let consumedXp = 0;
  for (let level = 1; level < userState.level; level += 1) {
    consumedXp += getXpRequiredForLevel(progressionConfig, level);
  }

  const xpForNextLevel = getXpRequiredForLevel(progressionConfig, userState.level);
  const xpIntoLevel = Math.max(0, userState.xp - consumedXp);
  const progressPercent = xpForNextLevel
    ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
    : 100;

  return {
    xpIntoLevel,
    xpForNextLevel,
    progressPercent
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

  if (subscriptionTier === "premium") {
    return getUnlockedDifficultyKeys(input, userState?.level ?? 1).length;
  }

  return 1;
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

export function normalizeDifficultyKey(input: ProgressionStateInput, difficultyKey: string): string {
  const normalized = String(difficultyKey ?? "").toLowerCase();
  const requestedLevel = getDifficultyLevel(input.progressionConfig, normalized);

  if (canAccessDifficulty(input, requestedLevel)) {
    return getDifficultyLabel(input.progressionConfig, requestedLevel);
  }

  const accessible = getAccessibleDifficultyKeys(input);
  return accessible[accessible.length - 1] ?? "beginner";
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
  const releaseFlags = getReleaseFlags(progressionConfig);
  return JSON.stringify({
    enable_all_difficulties: releaseFlags.enable_all_difficulties,
    enable_unlimited_cases: releaseFlags.enable_unlimited_cases,
    enable_learn_preview: releaseFlags.enable_learn_preview,
    xp_multiplier: releaseFlags.xp_multiplier
  });
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

  return {
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
    appliedProtectedCaseTokens: []
  };
}

export function syncUserStateDerivedFields(userState: UserState, progressionConfig: ProgressionConfig | null): UserState {
  const nextLevel = Math.max(1, getLevelFromXp(progressionConfig, userState.xp, userState.level));
  return {
    ...userState,
    level: nextLevel,
    unlockedDifficulties: sanitizeUnlockedDifficulties([
      ...userState.unlockedDifficulties,
      ...getUnlockedDifficultyKeys({ progressionConfig }, nextLevel)
    ])
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
    appliedProtectedCaseTokens: []
  };
}

