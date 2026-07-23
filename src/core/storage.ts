import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CalibrationCompletionRecord,
  CalibrationPlacement,
  ProgressRow,
  ResultsExplanationPreferenceKey,
  ResultsExplanationPreferences,
  SaveFailureKind,
  StorageAdapter,
  StorageInitOptions,
  UserState
} from "./types";
import { mapProgressRowToUserState as mapRemoteProgressRowToUserState } from "./progression";
import {
  FEATURED_CASE_DRAFT_STORAGE_KEY,
  FEATURED_CASE_INTRO_SEEN_STORAGE_KEY,
  FEATURED_CASE_INVITATION_DISMISSAL_STORAGE_KEY
} from "./featuredCase";

const USER_STATE_STORAGE_KEY = "abgmaster_userState";
const USER_STATE_MODE_STORAGE_KEY = "abgmaster_userState_mode";
const PRACTICE_INTRO_SEEN_STORAGE_KEY = "practiceIntroSeen";
const APP_AREA_VISITED_STORAGE_KEY = "abgmaster_appAreaVisited";
const ADVANCED_RANGES_STORAGE_KEY = "abgmaster_showAdvancedRanges";
const LAST_PRACTICE_DIFFICULTY_STORAGE_KEY = "abgmaster_lastPracticeDifficulty";
const RESULTS_EXPLANATION_PREFERENCES_STORAGE_KEY = "abgmaster_resultsExplanationPreferences";
const RESULTS_REVIEW_EXPANDED_STORAGE_KEY = "abgmaster_resultsReviewExpanded";
const SEEN_CASES_STORAGE_KEY = "abgmaster_seenCasesByDifficulty";
const CALIBRATION_COMPLETION_STORAGE_KEY = "abgmaster_calibrationCompletion";
const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "master"];
const CALIBRATION_PLACEMENTS: CalibrationPlacement[] = ["beginner", "intermediate", "advanced"];
const RESULTS_EXPLANATION_PREFERENCE_KEYS: ResultsExplanationPreferenceKey[] = [
  "primary_disorder",
  "compensation",
  "anion_gap",
  "additional_metabolic_process",
  "clinical_context"
];

export const STORAGE_KEYS = {
  USER_STATE_STORAGE_KEY,
  USER_STATE_MODE_STORAGE_KEY,
  PRACTICE_INTRO_SEEN_STORAGE_KEY,
  APP_AREA_VISITED_STORAGE_KEY,
  ADVANCED_RANGES_STORAGE_KEY,
  LAST_PRACTICE_DIFFICULTY_STORAGE_KEY,
  RESULTS_EXPLANATION_PREFERENCES_STORAGE_KEY,
  RESULTS_REVIEW_EXPANDED_STORAGE_KEY,
  SEEN_CASES_STORAGE_KEY,
  CALIBRATION_COMPLETION_STORAGE_KEY,
  FEATURED_CASE_DRAFT_STORAGE_KEY,
  FEATURED_CASE_INTRO_SEEN_STORAGE_KEY,
  FEATURED_CASE_INVITATION_DISMISSAL_STORAGE_KEY
} as const;

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): BrowserStorageLike {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function createEmptySeenCaseState() {
  return Object.fromEntries(DIFFICULTY_ORDER.map(key => [key, [] as string[]]));
}

function createDefaultResultsExplanationPreferences(): ResultsExplanationPreferences {
  return {
    primary_disorder: true,
    compensation: true,
    anion_gap: true,
    additional_metabolic_process: true,
    clinical_context: true
  };
}

function safeGetItem(storage: BrowserStorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: BrowserStorageLike, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(storage: BrowserStorageLike, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function parseStoredUserState(raw: string | null): UserState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UserState) : null;
  } catch {
    return null;
  }
}

export function sanitizeSeenCaseState(source: unknown): Record<string, string[]> {
  const sanitized = createEmptySeenCaseState();
  if (!source || typeof source !== "object") return sanitized;

  DIFFICULTY_ORDER.forEach(difficultyKey => {
    const caseIds = Array.isArray((source as Record<string, unknown>)[difficultyKey])
      ? (source as Record<string, unknown[]>)[difficultyKey]
      : [];
    sanitized[difficultyKey] = caseIds
      .map(caseId => String(caseId ?? "").trim())
      .filter((caseId, index, values) => caseId && values.indexOf(caseId) === index);
  });

  return sanitized;
}

export function sanitizePracticeDifficulty(source: unknown): string | null {
  const normalized = String(source ?? "").trim().toLowerCase();
  return DIFFICULTY_ORDER.includes(normalized) ? normalized : null;
}

export function sanitizeCalibrationCompletion(source: unknown): CalibrationCompletionRecord | null {
  if (!source || typeof source !== "object") return null;

  const record = source as Record<string, unknown>;
  const placement = String(record.placement ?? "").trim().toLowerCase();
  const version = Number(record.version);

  if (record.completed !== true) return null;
  if (!CALIBRATION_PLACEMENTS.includes(placement as CalibrationPlacement)) return null;
  if (!Number.isFinite(version) || version < 1) return null;

  return {
    completed: true,
    placement: placement as CalibrationPlacement,
    version
  };
}

export function sanitizeResultsExplanationPreferences(source: unknown): ResultsExplanationPreferences {
  const defaults = createDefaultResultsExplanationPreferences();
  if (!source || typeof source !== "object") return defaults;

  const typedSource = source as Record<string, unknown>;
  return RESULTS_EXPLANATION_PREFERENCE_KEYS.reduce((preferences, key) => {
    preferences[key] = typedSource[key] == null ? defaults[key] : Boolean(typedSource[key]);
    return preferences;
  }, { ...defaults });
}

function getCoreUserState(source: UserState | Record<string, unknown> | null | undefined) {
  const userState = source && typeof source === "object" ? source : {};
  return {
    xp: Number((userState as Record<string, unknown>).xp ?? 0),
    level: Number((userState as Record<string, unknown>).level ?? 1),
    streak: Number((userState as Record<string, unknown>).streak ?? 0),
    casesCompleted: Number((userState as Record<string, unknown>).casesCompleted ?? 0),
    correctAnswers: Number((userState as Record<string, unknown>).correctAnswers ?? 0),
    totalAnswers: Number((userState as Record<string, unknown>).totalAnswers ?? 0),
    lastCaseDate: ((userState as Record<string, unknown>).lastCaseDate ?? null) as string | null
  };
}

function hasMeaningfulCoreProgress(source: UserState | Record<string, unknown> | null | undefined): boolean {
  const core = getCoreUserState(source);
  return (
    core.xp > 0 ||
    core.level > 1 ||
    core.casesCompleted > 0 ||
    core.correctAnswers > 0 ||
    core.totalAnswers > 0
  );
}

export function mapUserStateToProgressRow(source: UserState, userId: string): ProgressRow {
  const core = getCoreUserState(source);
  return {
    user_id: userId,
    progression_version: source.progressionVersion ?? null,
    beta_release_number: source.betaReleaseNumber ?? null,
    xp: core.xp,
    level: core.level,
    streak: core.streak,
    cases_completed: core.casesCompleted,
    correct_answers: core.correctAnswers,
    total_answers: core.totalAnswers,
    last_case_date: core.lastCaseDate
  };
}

export function mapProgressRowToUserState(source: Partial<ProgressRow> | null | undefined): Partial<UserState> | null {
  return mapRemoteProgressRowToUserState(source);
}

function isEmptyRemoteProgress(source: Partial<ProgressRow> | null | undefined): boolean {
  return !Boolean(
    source?.calibration_completed ||
    source?.calibration_placement ||
    source?.intermediate_unlocked_at ||
    source?.advanced_unlocked_at ||
    source?.master_unlocked_at ||
    source?.placement_boost_completed_at ||
    source?.reset_at ||
    hasMeaningfulCoreProgress(mapProgressRowToUserState(source))
  );
}

export function createLocalStorageAdapter(browserStorage: BrowserStorageLike): StorageAdapter {
  const state = {
    releaseSignature: null as string | null
  };

  return {
    async init(options?: StorageInitOptions) {
      state.releaseSignature = options?.releaseSignature ?? null;
      const persistedReleaseSignature = safeGetItem(browserStorage, USER_STATE_MODE_STORAGE_KEY);

      if (persistedReleaseSignature !== state.releaseSignature) {
        safeRemoveItem(browserStorage, USER_STATE_STORAGE_KEY);
        safeRemoveItem(browserStorage, CALIBRATION_COMPLETION_STORAGE_KEY);
        safeSetItem(browserStorage, USER_STATE_MODE_STORAGE_KEY, String(state.releaseSignature ?? ""));
      }
    },

    async loadUserState() {
      return parseStoredUserState(safeGetItem(browserStorage, USER_STATE_STORAGE_KEY));
    },

    async saveUserState(userState) {
      safeSetItem(browserStorage, USER_STATE_MODE_STORAGE_KEY, String(state.releaseSignature ?? ""));
      safeSetItem(browserStorage, USER_STATE_STORAGE_KEY, JSON.stringify(userState ?? {}));
    },

    async resetUserState() {
      safeRemoveItem(browserStorage, USER_STATE_STORAGE_KEY);
      safeRemoveItem(browserStorage, FEATURED_CASE_DRAFT_STORAGE_KEY);
      safeRemoveItem(browserStorage, FEATURED_CASE_INTRO_SEEN_STORAGE_KEY);
      safeRemoveItem(browserStorage, FEATURED_CASE_INVITATION_DISMISSAL_STORAGE_KEY);
      safeSetItem(browserStorage, USER_STATE_MODE_STORAGE_KEY, String(state.releaseSignature ?? ""));
    },

    loadSeenCaseState() {
      const raw = safeGetItem(browserStorage, SEEN_CASES_STORAGE_KEY);
      if (!raw) return createEmptySeenCaseState();

      try {
        return sanitizeSeenCaseState(JSON.parse(raw));
      } catch {
        return createEmptySeenCaseState();
      }
    },

    saveSeenCaseState(seenState) {
      safeSetItem(browserStorage, SEEN_CASES_STORAGE_KEY, JSON.stringify(sanitizeSeenCaseState(seenState)));
    },

    loadPracticeIntroSeen() {
      return safeGetItem(browserStorage, PRACTICE_INTRO_SEEN_STORAGE_KEY) === "true";
    },

    savePracticeIntroSeen(value) {
      safeSetItem(browserStorage, PRACTICE_INTRO_SEEN_STORAGE_KEY, String(Boolean(value)));
    },

    loadAppAreaVisited() {
      return safeGetItem(browserStorage, APP_AREA_VISITED_STORAGE_KEY) === "true";
    },

    saveAppAreaVisited(value) {
      safeSetItem(browserStorage, APP_AREA_VISITED_STORAGE_KEY, String(Boolean(value)));
    },

    loadAdvancedRangesPreference() {
      return safeGetItem(browserStorage, ADVANCED_RANGES_STORAGE_KEY) === "true";
    },

    saveAdvancedRangesPreference(value) {
      safeSetItem(browserStorage, ADVANCED_RANGES_STORAGE_KEY, String(Boolean(value)));
    },

    loadLastPracticeDifficulty() {
      return sanitizePracticeDifficulty(safeGetItem(browserStorage, LAST_PRACTICE_DIFFICULTY_STORAGE_KEY));
    },

    saveLastPracticeDifficulty(value) {
      const sanitized = sanitizePracticeDifficulty(value);
      if (sanitized) {
        safeSetItem(browserStorage, LAST_PRACTICE_DIFFICULTY_STORAGE_KEY, sanitized);
      } else {
        safeRemoveItem(browserStorage, LAST_PRACTICE_DIFFICULTY_STORAGE_KEY);
      }
    },

    loadResultsExplanationPreferences() {
      const raw = safeGetItem(browserStorage, RESULTS_EXPLANATION_PREFERENCES_STORAGE_KEY);
      if (!raw) return createDefaultResultsExplanationPreferences();

      try {
        return sanitizeResultsExplanationPreferences(JSON.parse(raw));
      } catch {
        return createDefaultResultsExplanationPreferences();
      }
    },

    saveResultsExplanationPreferences(value) {
      safeSetItem(
        browserStorage,
        RESULTS_EXPLANATION_PREFERENCES_STORAGE_KEY,
        JSON.stringify(sanitizeResultsExplanationPreferences(value))
      );
    },

    loadResultsReviewExpandedPreference() {
      return safeGetItem(browserStorage, RESULTS_REVIEW_EXPANDED_STORAGE_KEY) === "true";
    },

    saveResultsReviewExpandedPreference(value) {
      safeSetItem(browserStorage, RESULTS_REVIEW_EXPANDED_STORAGE_KEY, String(Boolean(value)));
    },

    loadCalibrationCompletion() {
      const raw = safeGetItem(browserStorage, CALIBRATION_COMPLETION_STORAGE_KEY);
      if (!raw) return null;

      try {
        const sanitized = sanitizeCalibrationCompletion(JSON.parse(raw));
        if (!sanitized) safeRemoveItem(browserStorage, CALIBRATION_COMPLETION_STORAGE_KEY);
        return sanitized;
      } catch {
        safeRemoveItem(browserStorage, CALIBRATION_COMPLETION_STORAGE_KEY);
        return null;
      }
    },

    saveCalibrationCompletion(value) {
      const sanitized = sanitizeCalibrationCompletion(value);
      if (sanitized) {
        safeSetItem(browserStorage, CALIBRATION_COMPLETION_STORAGE_KEY, JSON.stringify(sanitized));
      } else {
        safeRemoveItem(browserStorage, CALIBRATION_COMPLETION_STORAGE_KEY);
      }
    },

    clearCalibrationCompletion() {
      safeRemoveItem(browserStorage, CALIBRATION_COMPLETION_STORAGE_KEY);
    }
  };
}

export function createSupabaseStorageAdapter(
  localAdapter: StorageAdapter,
  options: {
    supabase: SupabaseClient;
    userId: string;
    onSyncUnavailable?: (error?: unknown) => void;
    onSaveFailure?: (kind: SaveFailureKind, error?: unknown) => void;
  }
): StorageAdapter {
  const state = {
    remoteDisabled: false,
    progressionVersion: null as string | null,
    betaReleaseNumber: null as number | null
  };

  function notifySyncUnavailable(error: unknown) {
    options.onSyncUnavailable?.(error);
  }

  function notifySaveFailure(kind: SaveFailureKind, error: unknown) {
    options.onSaveFailure?.(kind, error);
  }

  async function runRemote<T>(
    operation: (supabase: SupabaseClient) => Promise<T>,
    fallbackValue: T,
    remoteOptions?: { notifySaveFailure?: boolean; failureKind?: SaveFailureKind }
  ): Promise<T> {
    if (state.remoteDisabled) return fallbackValue;

    try {
      return await operation(options.supabase);
    } catch (error) {
      state.remoteDisabled = true;
      notifySyncUnavailable(error);
      if (remoteOptions?.notifySaveFailure) {
        notifySaveFailure(remoteOptions.failureKind ?? "save", error);
      }
      return fallbackValue;
    }
  }

  async function fetchRemoteProgress() {
    return runRemote(async supabase => {
      const { data, error } = await supabase
        .from("user_progress")
        .select("xp, level, streak, cases_completed, correct_answers, total_answers, last_case_date, progression_version, beta_release_number, calibration_completed, calibration_placement, calibration_completed_at, placement_boost_completed_at, intermediate_unlocked_at, advanced_unlocked_at, master_unlocked_at, reset_at, updated_at")
        .eq("user_id", options.userId)
        .eq("progression_version", state.progressionVersion ?? "v2")
        .eq("beta_release_number", state.betaReleaseNumber ?? 2)
        .maybeSingle();

      if (error) throw error;
      return data as Partial<ProgressRow> | null;
    }, null);
  }

  return {
    async init(initOptions) {
      await localAdapter.init(initOptions);
      state.progressionVersion = initOptions?.progressionVersion ?? "v2";
      state.betaReleaseNumber = initOptions?.betaReleaseNumber ?? 2;
    },

    async loadUserState() {
      const localUserState = await localAdapter.loadUserState();
      const remoteRow = await fetchRemoteProgress();

      if (!remoteRow) {
        return localUserState;
      }

      if (isEmptyRemoteProgress(remoteRow)) {
        return localUserState;
      }

      return {
        ...(localUserState ?? {}),
        ...(mapProgressRowToUserState(remoteRow) ?? {})
      } as UserState;
    },

    async saveUserState(userState) {
      await localAdapter.saveUserState(userState);
    },

    async resetUserState() {
      await localAdapter.resetUserState();
      await runRemote(async supabase => {
        const { error } = await supabase.rpc("reset_progress", {
          p_progression_version: state.progressionVersion ?? "v2",
          p_beta_release_number: state.betaReleaseNumber ?? 2
        });

        if (error) throw error;
        return true;
      }, false, {
        notifySaveFailure: true,
        failureKind: "progress"
      });
    },

    loadSeenCaseState() {
      return localAdapter.loadSeenCaseState();
    },

    saveSeenCaseState(seenState) {
      localAdapter.saveSeenCaseState(seenState);
    },

    loadPracticeIntroSeen() {
      return localAdapter.loadPracticeIntroSeen();
    },

    savePracticeIntroSeen(value) {
      localAdapter.savePracticeIntroSeen(value);
    },

    loadAppAreaVisited() {
      return localAdapter.loadAppAreaVisited();
    },

    saveAppAreaVisited(value) {
      localAdapter.saveAppAreaVisited(value);
    },

    loadAdvancedRangesPreference() {
      return localAdapter.loadAdvancedRangesPreference();
    },

    saveAdvancedRangesPreference(value) {
      localAdapter.saveAdvancedRangesPreference(value);
    },

    loadLastPracticeDifficulty() {
      return localAdapter.loadLastPracticeDifficulty();
    },

    saveLastPracticeDifficulty(value) {
      localAdapter.saveLastPracticeDifficulty(value);
    },

    loadResultsExplanationPreferences() {
      return localAdapter.loadResultsExplanationPreferences();
    },

    saveResultsExplanationPreferences(value) {
      localAdapter.saveResultsExplanationPreferences(value);
    },

    loadResultsReviewExpandedPreference() {
      return localAdapter.loadResultsReviewExpandedPreference();
    },

    saveResultsReviewExpandedPreference(value) {
      localAdapter.saveResultsReviewExpandedPreference(value);
    },

    loadCalibrationCompletion() {
      return localAdapter.loadCalibrationCompletion();
    },

    saveCalibrationCompletion(value) {
      localAdapter.saveCalibrationCompletion(value);
    },

    clearCalibrationCompletion() {
      localAdapter.clearCalibrationCompletion();
    }
  };
}

export function createAppStorage(options?: {
  browserStorage?: BrowserStorageLike;
  supabase?: SupabaseClient | null;
  supabaseEnabled?: boolean;
}): StorageAdapter {
  const browserStorage = options?.browserStorage ?? createMemoryStorage();
  const localAdapter = createLocalStorageAdapter(browserStorage);
  let activeAdapter: StorageAdapter = localAdapter;

  return {
    async init(initOptions) {
      const shouldUseSupabase = Boolean(options?.supabaseEnabled && options.supabase && initOptions?.userId);

      activeAdapter = shouldUseSupabase
        ? createSupabaseStorageAdapter(localAdapter, {
          supabase: options?.supabase as SupabaseClient,
          userId: String(initOptions?.userId),
          onSyncUnavailable: initOptions?.onSyncUnavailable,
          onSaveFailure: initOptions?.onSaveFailure
        })
        : localAdapter;

      await activeAdapter.init(initOptions);
    },
    async loadUserState() {
      return activeAdapter.loadUserState();
    },
    async saveUserState(userState) {
      return activeAdapter.saveUserState(userState);
    },
    async resetUserState() {
      return activeAdapter.resetUserState();
    },
    loadSeenCaseState() {
      return activeAdapter.loadSeenCaseState();
    },
    saveSeenCaseState(seenState) {
      activeAdapter.saveSeenCaseState(seenState);
    },
    loadPracticeIntroSeen() {
      return activeAdapter.loadPracticeIntroSeen();
    },
    savePracticeIntroSeen(value) {
      activeAdapter.savePracticeIntroSeen(value);
    },
    loadAppAreaVisited() {
      return activeAdapter.loadAppAreaVisited();
    },
    saveAppAreaVisited(value) {
      activeAdapter.saveAppAreaVisited(value);
    },
    loadAdvancedRangesPreference() {
      return activeAdapter.loadAdvancedRangesPreference();
    },
    saveAdvancedRangesPreference(value) {
      activeAdapter.saveAdvancedRangesPreference(value);
    },
    loadLastPracticeDifficulty() {
      return activeAdapter.loadLastPracticeDifficulty();
    },
    saveLastPracticeDifficulty(value) {
      activeAdapter.saveLastPracticeDifficulty(value);
    },
    loadResultsExplanationPreferences() {
      return activeAdapter.loadResultsExplanationPreferences();
    },
    saveResultsExplanationPreferences(value) {
      activeAdapter.saveResultsExplanationPreferences(value);
    },
    loadResultsReviewExpandedPreference() {
      return activeAdapter.loadResultsReviewExpandedPreference();
    },
    saveResultsReviewExpandedPreference(value) {
      activeAdapter.saveResultsReviewExpandedPreference(value);
    },

    loadCalibrationCompletion() {
      return activeAdapter.loadCalibrationCompletion();
    },

    saveCalibrationCompletion(value) {
      activeAdapter.saveCalibrationCompletion(value);
    },

    clearCalibrationCompletion() {
      activeAdapter.clearCalibrationCompletion();
    }
  };
}
