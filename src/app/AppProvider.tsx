import { createContext, startTransition, useCallback, useContext, useEffect, useReducer, type ReactNode } from "react";
import { loadCasesPayload, loadRuntimeConfig } from "../core/runtime";
import { createAppStorage } from "../core/storage";
import { createRuntimeSupabaseClient, ensureAnonymousSession } from "../core/supabase";
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
              : fallbackUserState.badges
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
              storage,
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
