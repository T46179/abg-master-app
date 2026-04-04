import { createContext, startTransition, useCallback, useContext, useEffect, useReducer, type ReactNode } from "react";
import { loadCasesPayload, loadRuntimeConfig } from "../core/runtime";
import { createAppStorage } from "../core/storage";
import { createRuntimeSupabaseClient, ensureAnonymousSession } from "../core/supabase";
import { applyProtectedCaseCompletion, isProtectedPracticeError, submitProtectedPracticeCase } from "../core/protectedPractice";
import {
  clearPendingPracticeSubmission,
  loadPendingPracticeSubmission,
  loadPracticeSlotsCache,
  savePracticeSlotsCache
} from "../core/protectedPracticeCache";
import type { PracticeFlowState, SessionState, UserState } from "../core/types";
import {
  createEmptyUserState,
  getReleaseSignature,
  mapDefaultUserState,
  sanitizeUnlockedDifficulties,
  syncUserStateDerivedFields
} from "../core/progression";
import { appReducer, initialAppState, type AppState } from "./state";

interface AppContextValue {
  state: AppState;
  setUserState: (userState: UserState) => Promise<void>;
  patchSessionState: (patch: Partial<SessionState>) => void;
  patchPracticeState: (patch: Partial<PracticeFlowState>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

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
                practiceSlotsByDifficulty: loadPracticeSlotsCache(window.localStorage, payload.contentVersion),
                pendingSubmission: loadPendingPracticeSubmission(window.localStorage),
                syncState: loadPendingPracticeSubmission(window.localStorage) ? "pending_retry" : "idle"
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

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.payload?.deliveryMode !== "protected_runtime" ||
      !state.supabase ||
      !state.runtimeConfig ||
      typeof window === "undefined"
    ) {
      return;
    }

    let cancelled = false;

    async function retryPendingSubmission() {
      const pendingSubmission = loadPendingPracticeSubmission(window.localStorage);
      const runtimeConfig = state.runtimeConfig;
      const payload = state.payload;
      const supabase = state.supabase;
      if (!pendingSubmission || !runtimeConfig || !payload || !supabase) return;

      patchPracticeState({
        pendingSubmission,
        syncState: "pending_retry",
        syncMessage: "Retrying your pending practice submission."
      });

      try {
        const result = await submitProtectedPracticeCase(runtimeConfig, supabase, pendingSubmission);
        if (cancelled) return;

        const nextUserState = applyProtectedCaseCompletion({
          userState: state.userState,
          summary: {
            ...result.summary,
            caseToken: pendingSubmission.caseToken
          },
          progressionConfig: payload.progressionConfig
        });

        if (nextUserState !== state.userState) {
          await setUserState(nextUserState);
        }

        const nextSlots = {
          ...loadPracticeSlotsCache(window.localStorage, payload.contentVersion),
          [pendingSubmission.difficultyKey]: {
            ...result.replacementSlot,
            contentVersion: payload.contentVersion ?? pendingSubmission.contentVersion,
            difficultyKey: pendingSubmission.difficultyKey
          }
        };
        savePracticeSlotsCache(window.localStorage, nextSlots);
        clearPendingPracticeSubmission(window.localStorage);

        patchPracticeState({
          currentCase: null,
          currentCaseToken: null,
          currentCaseExpiresAt: null,
          lastCaseSummary: {
            ...result.summary,
            caseToken: pendingSubmission.caseToken
          },
          practiceSlotsByDifficulty: nextSlots,
          pendingSubmission: null,
          syncState: "idle",
          syncMessage: null
        });
      } catch (error) {
        if (cancelled) return;

        if (isProtectedPracticeError(error) && error.code === "CASE_TOKEN_EXPIRED") {
          clearPendingPracticeSubmission(window.localStorage);
          const nextSlots = {
            ...loadPracticeSlotsCache(window.localStorage, payload.contentVersion),
            [pendingSubmission.difficultyKey]: null
          };
          savePracticeSlotsCache(window.localStorage, nextSlots);

          patchPracticeState({
            currentCase: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCase,
            currentCaseToken: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCaseToken,
            currentCaseExpiresAt: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCaseExpiresAt,
            practiceSlotsByDifficulty: nextSlots,
            pendingSubmission: null,
            syncState: "idle",
            syncMessage: "Your pending case expired before it could sync. Start a fresh case."
          });
          return;
        }

        patchPracticeState({
          pendingSubmission,
          syncState: "pending_retry",
          syncMessage: "Your answers are saved locally. We will keep retrying when the connection comes back."
        });
      }
    }

    void retryPendingSubmission();

    function handleResumeOrReconnect() {
      void retryPendingSubmission();
    }

    window.addEventListener("online", handleResumeOrReconnect);
    window.addEventListener("focus", handleResumeOrReconnect);
    document.addEventListener("visibilitychange", handleResumeOrReconnect);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleResumeOrReconnect);
      window.removeEventListener("focus", handleResumeOrReconnect);
      document.removeEventListener("visibilitychange", handleResumeOrReconnect);
    };
  }, [
    patchPracticeState,
    setUserState,
    state.payload,
    state.practiceState.currentCase,
    state.practiceState.currentCaseExpiresAt,
    state.practiceState.currentCaseToken,
    state.runtimeConfig,
    state.status,
    state.supabase,
    state.userState
  ]);

  return (
    <AppContext.Provider
      value={{
        state,
        setUserState,
        patchSessionState,
        patchPracticeState
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
