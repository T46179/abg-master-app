import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AttemptRecord,
  AttemptRow,
  ProgressRow,
  ResultsExplanationPreferenceKey,
  ResultsExplanationPreferences,
  SaveFailureKind,
  StorageAdapter,
  StorageInitOptions,
  UserState
} from "./types";

const USER_STATE_STORAGE_KEY = "abgmaster_userState";
const USER_STATE_MODE_STORAGE_KEY = "abgmaster_userState_mode";
const PRACTICE_INTRO_SEEN_STORAGE_KEY = "practiceIntroSeen";
const ADVANCED_RANGES_STORAGE_KEY = "abgmaster_showAdvancedRanges";
const RESULTS_EXPLANATION_PREFERENCES_STORAGE_KEY = "abgmaster_resultsExplanationPreferences";
const SEEN_CASES_STORAGE_KEY = "abgmaster_seenCasesByDifficulty";
const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "master"];
const RESULTS_EXPLANATION_PREFERENCE_KEYS: ResultsExplanationPreferenceKey[] = [
  "compensation",
  "anion_gap",
  "additional_metabolic_process",
  "clinical_context"
];

export const STORAGE_KEYS = {
  USER_STATE_STORAGE_KEY,
  USER_STATE_MODE_STORAGE_KEY,
  PRACTICE_INTRO_SEEN_STORAGE_KEY,
  ADVANCED_RANGES_STORAGE_KEY,
  RESULTS_EXPLANATION_PREFERENCES_STORAGE_KEY,
  SEEN_CASES_STORAGE_KEY
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
  if (!source || typeof source !== "object") return null;

  return {
    xp: Number(source.xp ?? 0),
    level: Number(source.level ?? 1),
    streak: Number(source.streak ?? 0),
    casesCompleted: Number(source.cases_completed ?? 0),
    correctAnswers: Number(source.correct_answers ?? 0),
    totalAnswers: Number(source.total_answers ?? 0),
    lastCaseDate: source.last_case_date ?? null
  };
}

export function mapAttemptToAttemptRow(attempt: AttemptRecord): AttemptRow {
  const totalSteps = Math.max(0, Number(attempt.total_steps ?? attempt.total_questions ?? 0));
  const correctSteps = Math.max(0, Number(attempt.correct_steps ?? attempt.correct ?? 0));
  const accuracyPercent = Number.isFinite(Number(attempt.accuracy_percent))
    ? Math.round(Number(attempt.accuracy_percent))
    : totalSteps > 0
      ? Math.round((correctSteps / totalSteps) * 100)
      : 0;
  const elapsedSeconds = attempt.elapsed_seconds != null
    ? Math.max(0, Math.round(Number(attempt.elapsed_seconds)))
    : Math.max(0, Math.round(Number(attempt.time_taken_ms ?? 0) / 1000));

  return {
    user_id: attempt.user_id ?? null,
    case_id: attempt.case_id ?? null,
    archetype: attempt.archetype ?? null,
    difficulty_label: String(attempt.difficulty_label ?? attempt.difficulty ?? ""),
    difficulty_level: attempt.difficulty_level != null ? Number(attempt.difficulty_level) : null,
    xp_total_awarded: Number(attempt.xp_total_awarded ?? attempt.xp_earned ?? 0),
    correct_steps: correctSteps,
    total_steps: totalSteps,
    elapsed_seconds: elapsedSeconds,
    completed_at: attempt.completed_at ?? null,
    final_diagnosis_correct: Boolean(
      attempt.final_diagnosis_correct ??
      (totalSteps > 0 && correctSteps === totalSteps)
    ),
    accuracy_percent: Number.isFinite(accuracyPercent) ? accuracyPercent : 0,
    step_results_json: Array.isArray(attempt.step_results_json) ? attempt.step_results_json : [],
    app_version: attempt.app_version ?? null,
    content_version: attempt.content_version ?? null,
    mode: String(attempt.mode ?? "practice")
  };
}

function isEmptyRemoteProgress(source: Partial<ProgressRow> | null | undefined): boolean {
  return !hasMeaningfulCoreProgress(mapProgressRowToUserState(source));
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
      safeSetItem(browserStorage, USER_STATE_MODE_STORAGE_KEY, String(state.releaseSignature ?? ""));
    },

    async saveAttempt() {
      return;
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

    loadAdvancedRangesPreference() {
      return safeGetItem(browserStorage, ADVANCED_RANGES_STORAGE_KEY) === "true";
    },

    saveAdvancedRangesPreference(value) {
      safeSetItem(browserStorage, ADVANCED_RANGES_STORAGE_KEY, String(Boolean(value)));
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
    remoteDisabled: false
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
        .select("xp, level, streak, cases_completed, correct_answers, total_answers, last_case_date")
        .eq("user_id", options.userId)
        .maybeSingle();

      if (error) throw error;
      return data as Partial<ProgressRow> | null;
    }, null);
  }

  async function saveRemoteCoreFields(userState: UserState) {
    return runRemote(async supabase => {
      const { error } = await supabase
        .from("user_progress")
        .upsert(mapUserStateToProgressRow(userState, options.userId), { onConflict: "user_id" });

      if (error) throw error;
      return true;
    }, false, {
      notifySaveFailure: true,
      failureKind: "progress"
    });
  }

  async function saveRemoteAttempt(attempt: AttemptRecord) {
    return runRemote(async supabase => {
      const { error } = await supabase
        .from("attempts")
        .insert(mapAttemptToAttemptRow(attempt));

      if (error) throw error;
      return true;
    }, false, {
      notifySaveFailure: true,
      failureKind: "attempt"
    });
  }

  return {
    async init(initOptions) {
      await localAdapter.init(initOptions);

      await runRemote(async supabase => {
        const { error } = await supabase
          .from("user_progress")
          .upsert(
            {
              user_id: options.userId,
              xp: 0,
              level: 1,
              streak: 0,
              cases_completed: 0,
              correct_answers: 0,
              total_answers: 0,
              last_case_date: null
            },
            { onConflict: "user_id" }
          );

        if (error) throw error;
        return true;
      }, false);
    },

    async loadUserState() {
      const localUserState = await localAdapter.loadUserState();
      const remoteRow = await fetchRemoteProgress();

      if (!remoteRow) {
        return localUserState;
      }

      if (isEmptyRemoteProgress(remoteRow)) {
        if (localUserState && hasMeaningfulCoreProgress(localUserState)) {
          await saveRemoteCoreFields(localUserState);
        }
        return localUserState;
      }

      return {
        ...(localUserState ?? {}),
        ...(mapProgressRowToUserState(remoteRow) ?? {})
      } as UserState;
    },

    async saveUserState(userState) {
      await localAdapter.saveUserState(userState);
      await saveRemoteCoreFields(userState);
    },

    async resetUserState() {
      await localAdapter.resetUserState();
    },

    async saveAttempt(attempt) {
      await saveRemoteAttempt(attempt);
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

    loadAdvancedRangesPreference() {
      return localAdapter.loadAdvancedRangesPreference();
    },

    saveAdvancedRangesPreference(value) {
      localAdapter.saveAdvancedRangesPreference(value);
    },

    loadResultsExplanationPreferences() {
      return localAdapter.loadResultsExplanationPreferences();
    },

    saveResultsExplanationPreferences(value) {
      localAdapter.saveResultsExplanationPreferences(value);
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
    async saveAttempt(attempt) {
      return activeAdapter.saveAttempt(attempt);
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
    loadAdvancedRangesPreference() {
      return activeAdapter.loadAdvancedRangesPreference();
    },
    saveAdvancedRangesPreference(value) {
      activeAdapter.saveAdvancedRangesPreference(value);
    },
    loadResultsExplanationPreferences() {
      return activeAdapter.loadResultsExplanationPreferences();
    },
    saveResultsExplanationPreferences(value) {
      activeAdapter.saveResultsExplanationPreferences(value);
    }
  };
}
