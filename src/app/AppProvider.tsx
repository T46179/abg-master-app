import { createContext, startTransition, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { loadCasesPayload, loadRuntimeConfig } from "../core/runtime";
import { createAppStorage } from "../core/storage";
import { createRuntimeSupabaseClient, ensureAnonymousSession } from "../core/supabase";
import { applyProtectedCaseCompletion, isProtectedPracticeError, submitProtectedPracticeCase } from "../core/protectedPractice";
import {
  clearPracticeSlotCache,
  clearPendingPracticeSubmission,
  loadPendingPracticeSubmission,
  loadPracticeSlotsCache,
  slotMatchesDifficultyKey,
  savePracticeSlotsCache
} from "../core/protectedPracticeCache";
import type { PracticeFlowState, SessionState, UserState } from "../core/types";
import {
  createEmptyUserState,
  getAwardableXp,
  getReleaseSignature,
  mapDefaultUserState,
  sanitizeUnlockedDifficulties,
  syncUserStateDerivedFields
} from "../core/progression";
import { getPendingRetryDelayMs, getPendingSubmissionInvalidReason } from "./protectedPracticeRecovery";
import { appReducer, initialAppState, type AppState } from "./state";

interface AppContextValue {
  state: AppState;
  setUserState: (userState: UserState) => Promise<void>;
  patchSessionState: (patch: Partial<SessionState>) => void;
  patchPracticeState: (patch: Partial<PracticeFlowState>) => void;
  retryPendingSubmissionNow: () => void;
  discardPendingSubmission: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryInFlightRef = useRef(false);
  const retryAttemptCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      dispatch({ type: "loading" });

      try {
        const runtimeConfig = await loadRuntimeConfig();
        const payload = await loadCasesPayload();
        const supabaseRuntime = createRuntimeSupabaseClient(runtimeConfig);
        const { userId, syncUnavailable } = await ensureAnonymousSession(supabaseRuntime);

        const fallbackUserState = payload.defaultUserState
          ? mapDefaultUserState(payload.defaultUserState, {
            progressionConfig: payload.progressionConfig,
            dashboardState: payload.dashboardState
          })
          : createEmptyUserState();

        const storage = createAppStorage({
          browserStorage: window.localStorage,
          supabase: supabaseRuntime.supabase,
          supabaseEnabled: supabaseRuntime.supabaseEnabled
        });

        await storage.init({
          userId,
          releaseSignature: getReleaseSignature(payload.progressionConfig),
          fallbackUserState
        });

        const persistedUserState = await storage.loadUserState();
        const hydratedUserState = syncUserStateDerivedFields(
          {
            ...fallbackUserState,
            ...(persistedUserState ?? {}),
            unlockedDifficulties: sanitizeUnlockedDifficulties(
              persistedUserState?.unlockedDifficulties ?? fallbackUserState.unlockedDifficulties
            ),
            badges: Array.isArray(persistedUserState?.badges)
              ? persistedUserState.badges
              : fallbackUserState.badges,
            appliedProtectedCaseTokens: Array.isArray(persistedUserState?.appliedProtectedCaseTokens)
              ? persistedUserState.appliedProtectedCaseTokens
              : fallbackUserState.appliedProtectedCaseTokens
          },
          payload.progressionConfig
        );

        await storage.saveUserState(hydratedUserState);

        if (cancelled) return;

        startTransition(() => {
          let practiceSlotsByDifficulty = loadPracticeSlotsCache(window.localStorage, payload.contentVersion);
          let pendingSubmission = loadPendingPracticeSubmission(window.localStorage);
          let syncState: PracticeFlowState["syncState"] = pendingSubmission ? "pending_retry" : "idle";
          let syncMessage: string | null = null;

          if (pendingSubmission) {
            const invalidReason = getPendingSubmissionInvalidReason(pendingSubmission, payload.contentVersion);
            if (invalidReason === "expired") {
              clearPendingPracticeSubmission(window.localStorage);
              practiceSlotsByDifficulty = clearPracticeSlotCache(
                window.localStorage,
                practiceSlotsByDifficulty,
                pendingSubmission.difficultyKey,
                pendingSubmission.caseToken
              );
              pendingSubmission = null;
              syncState = "idle";
              syncMessage = "This unsaved case expired. Please start a new one.";
            } else if (invalidReason === "content_mismatch") {
              clearPendingPracticeSubmission(window.localStorage);
              practiceSlotsByDifficulty = clearPracticeSlotCache(
                window.localStorage,
                practiceSlotsByDifficulty,
                pendingSubmission.difficultyKey,
                pendingSubmission.caseToken
              );
              pendingSubmission = null;
              syncState = "idle";
              syncMessage = "This unsaved case no longer matches the current content. Please start a new one.";
            }
          }

          dispatch({
            type: "ready",
            payload: {
              runtimeConfig,
              payload,
              userState: hydratedUserState,
              sessionState: {
                ...initialAppState.sessionState,
                showAdvancedRanges: storage.loadAdvancedRangesPreference()
              },
              practiceState: {
                ...initialAppState.practiceState,
                practiceSlotsByDifficulty,
                pendingSubmission,
                syncState,
                syncMessage
              },
              storage,
              supabase: supabaseRuntime.supabase,
              supabaseEnabled: supabaseRuntime.supabaseEnabled,
              userId,
              syncUnavailable
            }
          });
        });
      } catch (error) {
        if (cancelled) return;
        dispatch({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown frontend initialization failure."
        });
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const setUserState = useCallback(async (userState: UserState) => {
    if (state.storage) {
      await state.storage.saveUserState(userState);
    }

    dispatch({
      type: "user_state_updated",
      userState
    });
  }, [state.storage]);

  const patchSessionState = useCallback((patch: Partial<SessionState>) => {
    dispatch({
      type: "session_state_patched",
      patch
    });
  }, []);

  const patchPracticeState = useCallback((patch: Partial<PracticeFlowState>) => {
    dispatch({
      type: "practice_state_patched",
      patch
    });
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const clearPendingSubmissionState = useCallback((pendingSubmission: PracticeFlowState["pendingSubmission"], message: string | null) => {
    if (typeof window === "undefined" || !pendingSubmission) return;

    clearPendingPracticeSubmission(window.localStorage);
    const nextSlots = clearPracticeSlotCache(
      window.localStorage,
      state.practiceState.practiceSlotsByDifficulty,
      pendingSubmission.difficultyKey,
      pendingSubmission.caseToken
    );

    retryAttemptCountRef.current = 0;
    clearRetryTimer();

    patchPracticeState({
      currentCase: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCase,
      currentCaseToken: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCaseToken,
      currentCaseExpiresAt: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCaseExpiresAt,
      practiceSlotsByDifficulty: nextSlots,
      pendingSubmission: null,
      syncState: "idle",
      syncMessage: message
    });

    patchSessionState({
      currentStepIndex: 0,
      selectedAnswers: [],
      stepResults: [],
      stepOptionOverrides: {},
      caseStartMs: null
    });
  }, [
    clearRetryTimer,
    patchPracticeState,
    patchSessionState,
    state.practiceState.currentCase,
    state.practiceState.currentCaseExpiresAt,
    state.practiceState.currentCaseToken,
    state.practiceState.practiceSlotsByDifficulty
  ]);

  const completePendingSubmissionSuccess = useCallback(async (pendingSubmission: NonNullable<PracticeFlowState["pendingSubmission"]>) => {
    if (!state.runtimeConfig || !state.payload || !state.supabase || typeof window === "undefined") return;

    const result = await submitProtectedPracticeCase(state.runtimeConfig, state.supabase, pendingSubmission);
    const cappedSummary = {
      ...result.summary,
      caseToken: pendingSubmission.caseToken,
      totalXpAward: getAwardableXp(state.payload.progressionConfig, state.userState.xp, result.summary.totalXpAward)
    };
    const nextUserState = applyProtectedCaseCompletion({
      userState: state.userState,
      summary: cappedSummary,
      progressionConfig: state.payload.progressionConfig
    });

    if (nextUserState !== state.userState) {
      await setUserState(nextUserState);
    }

    const nextSlots = {
      ...loadPracticeSlotsCache(window.localStorage, state.payload.contentVersion),
      [pendingSubmission.difficultyKey]: {
        ...result.replacementSlot,
        contentVersion: state.payload.contentVersion ?? pendingSubmission.contentVersion,
        difficultyKey: pendingSubmission.difficultyKey
      }
    };
    if (!slotMatchesDifficultyKey(nextSlots[pendingSubmission.difficultyKey], pendingSubmission.difficultyKey)) {
      nextSlots[pendingSubmission.difficultyKey] = null;
    }
    savePracticeSlotsCache(window.localStorage, nextSlots);
    clearPendingPracticeSubmission(window.localStorage);
    retryAttemptCountRef.current = 0;
    clearRetryTimer();

    patchPracticeState({
      currentCase: null,
      currentCaseToken: null,
      currentCaseExpiresAt: null,
      lastCaseSummary: cappedSummary,
      practiceSlotsByDifficulty: nextSlots,
      pendingSubmission: null,
      syncState: "idle",
      syncMessage: null
    });
  }, [
    clearRetryTimer,
    patchPracticeState,
    setUserState,
    state.payload,
    state.runtimeConfig,
    state.supabase,
    state.userState
  ]);

  const retryPendingSubmissionNow = useCallback(() => {
    if (
      retryInFlightRef.current ||
      state.status !== "ready" ||
      state.payload?.deliveryMode !== "protected_runtime" ||
      !state.supabase ||
      !state.runtimeConfig ||
      typeof window === "undefined"
    ) {
      return;
    }

    const pendingSubmission = loadPendingPracticeSubmission(window.localStorage) ?? state.practiceState.pendingSubmission;
    if (!pendingSubmission) return;

    const invalidReason = getPendingSubmissionInvalidReason(pendingSubmission, state.payload?.contentVersion);
    if (invalidReason === "expired") {
      clearPendingSubmissionState(pendingSubmission, "This unsaved case expired. Please start a new one.");
      return;
    }
    if (invalidReason === "content_mismatch") {
      clearPendingSubmissionState(pendingSubmission, "This unsaved case no longer matches the current content. Please start a new one.");
      return;
    }

    retryInFlightRef.current = true;
    clearRetryTimer();
    patchPracticeState({
      pendingSubmission,
      syncState: "pending_retry",
      syncMessage: "We're retrying your submission."
    });

    void completePendingSubmissionSuccess(pendingSubmission)
      .catch((error) => {
        if (isProtectedPracticeError(error) && error.code === "CASE_TOKEN_EXPIRED") {
          clearPendingSubmissionState(pendingSubmission, "This case expired before it could be checked. Please start a new one.");
          return;
        }

        retryAttemptCountRef.current += 1;
        patchPracticeState({
          pendingSubmission,
          syncState: "pending_retry",
          syncMessage: "Your answers are saved. We'll finish submitting when you're back online."
        });
      })
      .finally(() => {
        retryInFlightRef.current = false;
      });
  }, [
    clearPendingSubmissionState,
    clearRetryTimer,
    completePendingSubmissionSuccess,
    patchPracticeState,
    state.payload,
    state.practiceState.pendingSubmission,
    state.runtimeConfig,
    state.status,
    state.supabase
  ]);

  const discardPendingSubmission = useCallback(() => {
    if (!state.practiceState.pendingSubmission) return;
    clearPendingSubmissionState(state.practiceState.pendingSubmission, null);
  }, [clearPendingSubmissionState, state.practiceState.pendingSubmission]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.payload?.deliveryMode !== "protected_runtime" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const pendingSubmission = loadPendingPracticeSubmission(window.localStorage) ?? state.practiceState.pendingSubmission;
    if (!pendingSubmission) return;

    const invalidReason = getPendingSubmissionInvalidReason(pendingSubmission, state.payload?.contentVersion);
    if (invalidReason === "expired") {
      clearPendingSubmissionState(pendingSubmission, "This unsaved case expired. Please start a new one.");
      return;
    }
    if (invalidReason === "content_mismatch") {
      clearPendingSubmissionState(pendingSubmission, "This unsaved case no longer matches the current content. Please start a new one.");
    }
  }, [clearPendingSubmissionState, state.payload, state.practiceState.pendingSubmission, state.status]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.payload?.deliveryMode !== "protected_runtime" ||
      !state.practiceState.pendingSubmission ||
      state.practiceState.syncState !== "pending_retry" ||
      typeof window === "undefined"
    ) {
      clearRetryTimer();
      return;
    }

    function handleResumeOrReconnect() {
      retryPendingSubmissionNow();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        retryPendingSubmissionNow();
      }
    }

    clearRetryTimer();
    retryTimerRef.current = setTimeout(() => {
      retryPendingSubmissionNow();
    }, getPendingRetryDelayMs(retryAttemptCountRef.current));

    window.addEventListener("online", handleResumeOrReconnect);
    window.addEventListener("focus", handleResumeOrReconnect);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearRetryTimer();
      window.removeEventListener("online", handleResumeOrReconnect);
      window.removeEventListener("focus", handleResumeOrReconnect);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    clearRetryTimer,
    retryPendingSubmissionNow,
    state.payload,
    state.practiceState.pendingSubmission,
    state.practiceState.syncState,
    state.status
  ]);

  return (
    <AppContext.Provider
      value={{
        state,
        setUserState,
        patchSessionState,
        patchPracticeState,
        retryPendingSubmissionNow,
        discardPendingSubmission
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider.");
  }
  return context;
}
