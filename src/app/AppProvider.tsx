import { createContext, startTransition, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { captureAppException } from "../core/monitoring";
import { getRuntimeBootstrapUserMessage, isRuntimeBootstrapError, loadCasesPayload, loadRuntimeConfig } from "../core/runtime";
import { createAppStorage } from "../core/storage";
import { createRuntimeSupabaseClient, ensureAnonymousSession } from "../core/supabase";
import { CALIBRATION_COMPLETION_VERSION, createCalibrationCompletionRecord } from "../core/calibration";
import {
  REMOTE_PROGRESS_TIMEOUT_MS,
  resolveCalibrationState,
  settleWithTimeout
} from "../core/calibrationOnboarding";
import {
  clearPendingCalibrationCompletion,
  createPendingCalibrationCompletion,
  loadPendingCalibrationCompletion,
  savePendingCalibrationCompletion
} from "../core/calibrationRecovery";
import { completeCalibrationProgress, loadRemoteProgressRow } from "../core/progressionSync";
import { applyProtectedCaseCompletion, isProtectedPracticeError, submitProtectedPracticeCase } from "../core/protectedPractice";
import {
  clearPracticeSlotCache,
  clearPendingPracticeSubmission,
  loadPendingPracticeSubmission,
  loadPracticeSlotsCache,
  slotMatchesDifficultyKey,
  savePracticeSlotsCache
} from "../core/protectedPracticeCache";
import type { CalibrationCompletionRecord, PracticeFlowState, SessionState, UserState } from "../core/types";
import {
  createEmptyUserState,
  getBetaReleaseNumber,
  getProgressionVersion,
  appendPracticeAttemptSummary,
  getAwardableXpWithReadinessGates,
  getReleaseSignature,
  getCalibrationCompletionFromUserState,
  mapDefaultUserState,
  mapProgressRowToUserState,
  sanitizeUnlockedDifficulties,
  syncUserStateDerivedFields
} from "../core/progression";
import { getPendingRetryDelayMs, getPendingSubmissionInvalidReason } from "./protectedPracticeRecovery";
import { PROTECTED_PRACTICE_MESSAGES } from "./protectedPracticeMessages";
import { appReducer, initialAppState, type AppState } from "./state";

interface AppContextValue {
  state: AppState;
  setUserState: (userState: UserState) => Promise<void>;
  patchSessionState: (patch: Partial<SessionState>) => void;
  patchPracticeState: (patch: Partial<PracticeFlowState>) => void;
  retryPendingSubmissionNow: () => void;
  discardPendingSubmission: () => void;
  saveLocalCalibrationCompletion: (completion: CalibrationCompletionRecord) => Promise<void>;
  skipCalibrationOnboarding: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [pendingCalibrationCompletion, setPendingCalibrationCompletion] = useState(() => (
    typeof window === "undefined" ? null : loadPendingCalibrationCompletion(window.localStorage)
  ));
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryInFlightRef = useRef(false);
  const retryAttemptCountRef = useRef(0);
  const calibrationRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calibrationRetryInFlightRef = useRef(false);
  const calibrationRetryAttemptCountRef = useRef(0);
  const calibrationSkipInFlightRef = useRef(false);
  const remoteHydrationRetryInFlightRef = useRef(false);
  const remoteHydrationRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runtimeSupabaseRef = useRef<ReturnType<typeof createRuntimeSupabaseClient> | null>(null);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      dispatch({ type: "loading" });

      try {
        const runtimeConfig = await loadRuntimeConfig();
        const payload = await loadCasesPayload();
        const supabaseRuntime = createRuntimeSupabaseClient(runtimeConfig);
        runtimeSupabaseRef.current = supabaseRuntime;

        const fallbackUserState = payload.defaultUserState
          ? mapDefaultUserState(payload.defaultUserState, {
            progressionConfig: payload.progressionConfig,
            dashboardState: payload.dashboardState
          })
          : createEmptyUserState();

        const storage = createAppStorage({
          browserStorage: window.localStorage,
          supabaseEnabled: false
        });
        const storageInitOptions = {
          releaseSignature: getReleaseSignature(payload.progressionConfig),
          progressionVersion: getProgressionVersion(payload.progressionConfig),
          betaReleaseNumber: getBetaReleaseNumber(payload.progressionConfig),
          fallbackUserState
        };
        await storage.init(storageInitOptions);

        const persistedUserState = await storage.loadUserState();
        const localCompletion = storage.loadCalibrationCompletion()
          ?? getCalibrationCompletionFromUserState(persistedUserState);
        if (localCompletion) storage.saveCalibrationCompletion(localCompletion);
        const hydratedUserState = syncUserStateDerivedFields(
          {
            ...fallbackUserState,
            ...(persistedUserState ?? {}),
            ...(localCompletion ? {
              calibrationCompleted: true,
              calibrationPlacement: localCompletion.placement
            } : {}),
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
          let practiceSlotsByDifficulty = loadPracticeSlotsCache(window.localStorage, payload.contentVersion, null);
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
                pendingSubmission.caseToken,
                null
              );
              pendingSubmission = null;
              syncState = "idle";
              syncMessage = PROTECTED_PRACTICE_MESSAGES.savedCaseExpired;
            } else if (invalidReason === "content_mismatch") {
              clearPendingPracticeSubmission(window.localStorage);
              practiceSlotsByDifficulty = clearPracticeSlotCache(
                window.localStorage,
                practiceSlotsByDifficulty,
                pendingSubmission.difficultyKey,
                pendingSubmission.caseToken,
                null
              );
              pendingSubmission = null;
              syncState = "idle";
              syncMessage = PROTECTED_PRACTICE_MESSAGES.savedCaseOutOfDate;
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
              supabase: null,
              supabaseEnabled: supabaseRuntime.supabaseEnabled,
              userId: null,
              syncUnavailable: false,
              calibrationState: resolveCalibrationState({
                localCompletion,
                remoteCompletion: null,
                remoteStatus: supabaseRuntime.supabaseEnabled ? "loading" : "unavailable"
              })
            }
          });
        });

        if (!supabaseRuntime.supabaseEnabled || !supabaseRuntime.supabase) return;

        try {
          const remoteResult = await settleWithTimeout((async () => {
            const session = await ensureAnonymousSession(supabaseRuntime);
            if (session.syncUnavailable || !session.userId || !supabaseRuntime.supabase) {
              throw new Error("Remote progress is unavailable.");
            }
            const progress = await loadRemoteProgressRow({
              supabase: supabaseRuntime.supabase,
              userId: session.userId,
              progressionConfig: payload.progressionConfig
            });
            return { progress, userId: session.userId };
          })(), REMOTE_PROGRESS_TIMEOUT_MS);

          if (cancelled) return;
          if (remoteResult.status === "timeout") {
            dispatch({
              type: "remote_state_unavailable",
              calibrationState: resolveCalibrationState({
                localCompletion: latestStateRef.current.calibrationState.localCompletion ?? localCompletion,
                remoteCompletion: null,
                remoteStatus: "unavailable"
              })
            });
            return;
          }

          const remoteStorage = createAppStorage({
            browserStorage: window.localStorage,
            supabase: supabaseRuntime.supabase,
            supabaseEnabled: true
          });
          await remoteStorage.init({ ...storageInitOptions, userId: remoteResult.value.userId });

          const remotePatch = mapProgressRowToUserState(remoteResult.value.progress);
          const remoteCompletion = remotePatch
            ? getCalibrationCompletionFromUserState({ ...createEmptyUserState(), ...remotePatch })
            : null;
          if (latestStateRef.current.calibrationState.remoteStatus === "loaded") return;
          const currentUserState = latestStateRef.current.status === "ready"
            ? latestStateRef.current.userState
            : hydratedUserState;
          const currentLocalCompletion = latestStateRef.current.calibrationState.localCompletion ?? localCompletion;
          const remoteUserState = remotePatch
            ? syncUserStateDerivedFields({ ...currentUserState, ...remotePatch }, payload.progressionConfig)
            : currentUserState;
          const reconciledUserState = !remoteCompletion && currentLocalCompletion
            ? syncUserStateDerivedFields({
                ...remoteUserState,
                calibrationCompleted: true,
                calibrationPlacement: currentLocalCompletion.placement
              }, payload.progressionConfig)
            : remoteUserState;

          if (remoteCompletion) remoteStorage.saveCalibrationCompletion(remoteCompletion);
          await remoteStorage.saveUserState(reconciledUserState);
          if (remoteCompletion) {
            clearPendingCalibrationCompletion(window.localStorage);
            setPendingCalibrationCompletion(null);
          }

          dispatch({
            type: "remote_state_reconciled",
            payload: {
              userState: reconciledUserState,
              storage: remoteStorage,
              supabase: supabaseRuntime.supabase,
              userId: remoteResult.value.userId,
              syncUnavailable: false,
              calibrationState: resolveCalibrationState({
                localCompletion: remoteCompletion ?? currentLocalCompletion,
                remoteCompletion,
                remoteStatus: remoteCompletion ? "loaded" : "absent"
              })
            }
          });
        } catch {
          if (cancelled) return;
          dispatch({
            type: "remote_state_unavailable",
            calibrationState: resolveCalibrationState({
              localCompletion: latestStateRef.current.calibrationState.localCompletion ?? localCompletion,
              remoteCompletion: null,
              remoteStatus: "unavailable"
            })
          });
        }
      } catch (error) {
        if (cancelled) return;
        captureAppException(error, {
          name: "app_initialization",
          extra: {
            phase: "bootstrap"
          }
        });
        dispatch({
          type: "error",
          message: isRuntimeBootstrapError(error)
            ? getRuntimeBootstrapUserMessage()
            : "Something went wrong while starting ABG Master. Please refresh and try again."
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

  const saveLocalCalibrationCompletion = useCallback(async (completion: CalibrationCompletionRecord) => {
    if (!state.storage) return;

    const effectiveCompletion = state.calibrationState.remoteCompletion ?? completion;
    state.storage.saveCalibrationCompletion(effectiveCompletion);
    const nextUserState = syncUserStateDerivedFields({
      ...state.userState,
      calibrationCompleted: true,
      calibrationPlacement: effectiveCompletion.placement
    }, state.payload?.progressionConfig ?? null);
    await state.storage.saveUserState(nextUserState);

    dispatch({
      type: "calibration_state_updated",
      userState: nextUserState,
      calibrationState: resolveCalibrationState({
        localCompletion: effectiveCompletion,
        remoteCompletion: state.calibrationState.remoteCompletion,
        remoteStatus: state.calibrationState.remoteStatus
      })
    });
  }, [state.calibrationState, state.payload, state.storage, state.userState]);

  const reconcileRemoteProgress = useCallback(async (input: {
    progress: Awaited<ReturnType<typeof loadRemoteProgressRow>>;
    supabase: NonNullable<AppState["supabase"]>;
    userId: string;
  }) => {
    if (!state.payload || typeof window === "undefined") return null;

    const progressPatch = mapProgressRowToUserState(input.progress);
    const remoteCompletion = progressPatch
      ? getCalibrationCompletionFromUserState({ ...createEmptyUserState(), ...progressPatch })
      : null;
    const nextUserState = progressPatch
      ? syncUserStateDerivedFields({ ...state.userState, ...progressPatch }, state.payload.progressionConfig)
      : state.userState;
    const remoteStorage = createAppStorage({
      browserStorage: window.localStorage,
      supabase: input.supabase,
      supabaseEnabled: true
    });
    await remoteStorage.init({
      userId: input.userId,
      releaseSignature: getReleaseSignature(state.payload.progressionConfig),
      progressionVersion: getProgressionVersion(state.payload.progressionConfig),
      betaReleaseNumber: getBetaReleaseNumber(state.payload.progressionConfig),
      fallbackUserState: state.userState
    });

    const localCompletion = remoteCompletion ?? state.calibrationState.localCompletion;
    const reconciledUserState = !remoteCompletion && localCompletion
      ? syncUserStateDerivedFields({
          ...nextUserState,
          calibrationCompleted: true,
          calibrationPlacement: localCompletion.placement
        }, state.payload.progressionConfig)
      : nextUserState;

    if (remoteCompletion) remoteStorage.saveCalibrationCompletion(remoteCompletion);
    await remoteStorage.saveUserState(reconciledUserState);
    dispatch({
      type: "remote_state_reconciled",
      payload: {
        userState: reconciledUserState,
        storage: remoteStorage,
        supabase: input.supabase,
        userId: input.userId,
        syncUnavailable: false,
        calibrationState: resolveCalibrationState({
          localCompletion,
          remoteCompletion,
          remoteStatus: remoteCompletion ? "loaded" : "absent"
        })
      }
    });
    return remoteCompletion;
  }, [state.calibrationState.localCompletion, state.payload, state.userState]);

  const clearCalibrationRetryTimer = useCallback(() => {
    if (calibrationRetryTimerRef.current != null) {
      clearTimeout(calibrationRetryTimerRef.current);
      calibrationRetryTimerRef.current = null;
    }
  }, []);

  const retryRemoteHydrationNow = useCallback(() => {
    if (
      remoteHydrationRetryInFlightRef.current ||
      state.status !== "ready" ||
      state.calibrationState.remoteStatus !== "unavailable" ||
      !state.payload
    ) {
      return;
    }

    const runtime = runtimeSupabaseRef.current;
    if (!runtime?.supabaseEnabled || !runtime.supabase) return;
    if (remoteHydrationRetryTimerRef.current != null) {
      clearTimeout(remoteHydrationRetryTimerRef.current);
    }
    remoteHydrationRetryTimerRef.current = null;
    remoteHydrationRetryInFlightRef.current = true;

    void settleWithTimeout((async () => {
      const session = await ensureAnonymousSession(runtime);
      if (session.syncUnavailable || !session.userId || !runtime.supabase) {
        throw new Error("Remote progress is unavailable.");
      }
      const progress = await loadRemoteProgressRow({
        supabase: runtime.supabase,
        userId: session.userId,
        progressionConfig: state.payload?.progressionConfig ?? null
      });
      return { progress, supabase: runtime.supabase, userId: session.userId };
    })(), REMOTE_PROGRESS_TIMEOUT_MS)
      .then(result => {
        if (result.status !== "resolved") return;
        return reconcileRemoteProgress(result.value);
      })
      .catch(() => undefined)
      .finally(() => {
        remoteHydrationRetryInFlightRef.current = false;
        if (
          latestStateRef.current.calibrationState.remoteStatus === "unavailable" &&
          remoteHydrationRetryTimerRef.current == null
        ) {
          remoteHydrationRetryTimerRef.current = setTimeout(retryRemoteHydrationNow, 30_000);
        }
      });
  }, [reconcileRemoteProgress, state.calibrationState.remoteStatus, state.payload, state.status]);

  const retryPendingCalibrationNow = useCallback(() => {
    if (
      calibrationRetryInFlightRef.current ||
      !pendingCalibrationCompletion ||
      state.status !== "ready" ||
      !state.payload ||
      typeof window === "undefined"
    ) {
      return;
    }

    const runtime = runtimeSupabaseRef.current;
    if (!runtime?.supabaseEnabled || !runtime.supabase) return;
    const payload = state.payload;

    calibrationRetryInFlightRef.current = true;
    clearCalibrationRetryTimer();
    const pending = {
      ...pendingCalibrationCompletion,
      lastAttemptAt: new Date().toISOString()
    };
    savePendingCalibrationCompletion(window.localStorage, pending);
    setPendingCalibrationCompletion(pending);

    void settleWithTimeout((async () => {
      const session = await ensureAnonymousSession(runtime);
      if (session.syncUnavailable || !session.userId || !runtime.supabase) {
        throw new Error("Remote progress is unavailable.");
      }

      const existingProgress = await loadRemoteProgressRow({
        supabase: runtime.supabase,
        userId: session.userId,
        progressionConfig: payload.progressionConfig,
        progressionVersion: pending.progressionVersion,
        betaReleaseNumber: pending.betaReleaseNumber
      });
      const existingPatch = mapProgressRowToUserState(existingProgress);
      const existingCompletion = existingPatch
        ? getCalibrationCompletionFromUserState({ ...createEmptyUserState(), ...existingPatch })
        : null;

      if (existingCompletion) {
        await reconcileRemoteProgress({
          progress: existingProgress,
          supabase: runtime.supabase,
          userId: session.userId
        });
        return;
      }

      const completion: CalibrationCompletionRecord = {
        completed: true,
        placement: pending.placement,
        version: pending.calibrationVersion
      };
      const completedProgress = await completeCalibrationProgress({
        supabase: runtime.supabase,
        progressionConfig: payload.progressionConfig,
        placement: pending.placement,
        completion,
        progressionVersion: pending.progressionVersion,
        betaReleaseNumber: pending.betaReleaseNumber,
        attemptPayload: {
          source: pending.source,
          operation_id: pending.operationId
        }
      });
      await reconcileRemoteProgress({
        progress: completedProgress,
        supabase: runtime.supabase,
        userId: session.userId
      });
    })(), REMOTE_PROGRESS_TIMEOUT_MS)
      .then(result => {
        if (result.status === "timeout") throw new Error("Calibration reconciliation timed out.");
        clearPendingCalibrationCompletion(window.localStorage);
        setPendingCalibrationCompletion(null);
        calibrationRetryAttemptCountRef.current = 0;
      })
      .catch(() => {
        calibrationRetryAttemptCountRef.current += 1;
        const retainedPending = {
          ...pending,
          lastAttemptAt: new Date().toISOString()
        };
        savePendingCalibrationCompletion(window.localStorage, retainedPending);
        setPendingCalibrationCompletion(retainedPending);
      })
      .finally(() => {
        calibrationRetryInFlightRef.current = false;
      });
  }, [
    clearCalibrationRetryTimer,
    pendingCalibrationCompletion,
    reconcileRemoteProgress,
    state.payload,
    state.status
  ]);

  const skipCalibrationOnboarding = useCallback(async () => {
    if (
      calibrationSkipInFlightRef.current ||
      !state.payload ||
      !state.storage ||
      typeof window === "undefined"
    ) {
      return;
    }

    calibrationSkipInFlightRef.current = true;
    try {
      const existingPending = loadPendingCalibrationCompletion(window.localStorage);
      const operationId = typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `calibration-skip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const pending = existingPending ?? createPendingCalibrationCompletion({
        operationId,
        calibrationVersion: CALIBRATION_COMPLETION_VERSION,
        progressionVersion: getProgressionVersion(state.payload.progressionConfig),
        betaReleaseNumber: getBetaReleaseNumber(state.payload.progressionConfig)
      });

      if (!existingPending) savePendingCalibrationCompletion(window.localStorage, pending);
      setPendingCalibrationCompletion(pending);
      await saveLocalCalibrationCompletion(createCalibrationCompletionRecord("beginner"));
    } finally {
      calibrationSkipInFlightRef.current = false;
    }
  }, [saveLocalCalibrationCompletion, state.payload, state.storage]);

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
      pendingSubmission.caseToken,
      state.userId
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
    const progressPatch = mapProgressRowToUserState(result.progress);
    const currentAttempt = {
      difficulty: pendingSubmission.difficultyKey,
      correctSteps: result.summary.correctSteps,
      totalSteps: result.summary.totalSteps,
      completedAt: pendingSubmission.clientCompletedAt
    };
    const nextRecentPracticeAttempts = appendPracticeAttemptSummary(state.userState, currentAttempt);
    const cappedSummary = {
      ...result.summary,
      caseToken: pendingSubmission.caseToken,
      totalXpAward: result.progress
        ? result.summary.totalXpAward
        : getAwardableXpWithReadinessGates({
            progressionConfig: state.payload.progressionConfig,
            userState: state.userState,
            requestedXp: result.summary.totalXpAward,
            attemptsIncludingCurrent: nextRecentPracticeAttempts
          })
    };
    const nextUserState = progressPatch
      ? syncUserStateDerivedFields({
        ...state.userState,
        ...progressPatch,
        recentResults: [...state.userState.recentResults, result.summary.correctSteps === result.summary.totalSteps].slice(-20),
        recentPracticeAttempts: nextRecentPracticeAttempts
      }, state.payload.progressionConfig)
      : applyProtectedCaseCompletion({
        userState: state.userState,
        summary: cappedSummary,
        progressionConfig: state.payload.progressionConfig
      });

    if (nextUserState !== state.userState) {
      await setUserState(nextUserState);
    }

    const nextSlots = {
      ...loadPracticeSlotsCache(window.localStorage, state.payload.contentVersion, state.userId),
      [pendingSubmission.difficultyKey]: {
        ...result.replacementSlot,
        contentVersion: state.payload.contentVersion ?? pendingSubmission.contentVersion,
        difficultyKey: pendingSubmission.difficultyKey
      }
    };
    if (!slotMatchesDifficultyKey(nextSlots[pendingSubmission.difficultyKey], pendingSubmission.difficultyKey)) {
      nextSlots[pendingSubmission.difficultyKey] = null;
    }
    savePracticeSlotsCache(window.localStorage, nextSlots, state.userId);
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
      clearPendingSubmissionState(pendingSubmission, PROTECTED_PRACTICE_MESSAGES.savedCaseExpired);
      return;
    }
    if (invalidReason === "content_mismatch") {
      clearPendingSubmissionState(pendingSubmission, PROTECTED_PRACTICE_MESSAGES.savedCaseOutOfDate);
      return;
    }

    retryInFlightRef.current = true;
    clearRetryTimer();
    patchPracticeState({
      pendingSubmission,
      syncState: "pending_retry",
      syncMessage: PROTECTED_PRACTICE_MESSAGES.retrying
    });

    void completePendingSubmissionSuccess(pendingSubmission)
      .catch((error) => {
        if (
          isProtectedPracticeError(error) &&
          (error.code === "CASE_TOKEN_EXPIRED" || (error.code === "CASE_SLOT_UNAVAILABLE" && error.status === 404))
        ) {
          clearPendingSubmissionState(pendingSubmission, PROTECTED_PRACTICE_MESSAGES.caseExpiredBeforeCheck);
          return;
        }

        retryAttemptCountRef.current += 1;
        patchPracticeState({
          pendingSubmission,
          syncState: "pending_retry",
          syncMessage: PROTECTED_PRACTICE_MESSAGES.savedUntilOnline
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
      typeof window === "undefined"
    ) {
      return;
    }

    const pendingSubmission = loadPendingPracticeSubmission(window.localStorage) ?? state.practiceState.pendingSubmission;
    if (!pendingSubmission) return;

    const invalidReason = getPendingSubmissionInvalidReason(pendingSubmission, state.payload?.contentVersion);
    if (invalidReason === "expired") {
      clearPendingSubmissionState(pendingSubmission, PROTECTED_PRACTICE_MESSAGES.savedCaseExpired);
      return;
    }
    if (invalidReason === "content_mismatch") {
      clearPendingSubmissionState(pendingSubmission, PROTECTED_PRACTICE_MESSAGES.savedCaseOutOfDate);
    }
  }, [clearPendingSubmissionState, state.payload, state.practiceState.pendingSubmission, state.status]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
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

  useEffect(() => {
    if (
      state.status !== "ready" ||
      !pendingCalibrationCompletion ||
      typeof window === "undefined"
    ) {
      clearCalibrationRetryTimer();
      return;
    }

    function handleResumeOrReconnect() {
      retryPendingCalibrationNow();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") retryPendingCalibrationNow();
    }

    clearCalibrationRetryTimer();
    calibrationRetryTimerRef.current = setTimeout(
      retryPendingCalibrationNow,
      pendingCalibrationCompletion.lastAttemptAt
        ? getPendingRetryDelayMs(calibrationRetryAttemptCountRef.current)
        : 0
    );

    window.addEventListener("online", handleResumeOrReconnect);
    window.addEventListener("focus", handleResumeOrReconnect);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearCalibrationRetryTimer();
      window.removeEventListener("online", handleResumeOrReconnect);
      window.removeEventListener("focus", handleResumeOrReconnect);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    clearCalibrationRetryTimer,
    pendingCalibrationCompletion,
    retryPendingCalibrationNow,
    state.status
  ]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      state.calibrationState.remoteStatus !== "unavailable" ||
      typeof window === "undefined"
    ) {
      if (remoteHydrationRetryTimerRef.current != null) {
        clearTimeout(remoteHydrationRetryTimerRef.current);
        remoteHydrationRetryTimerRef.current = null;
      }
      return;
    }

    function handleRetryOpportunity() {
      retryRemoteHydrationNow();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") retryRemoteHydrationNow();
    }

    remoteHydrationRetryTimerRef.current = setTimeout(retryRemoteHydrationNow, 30_000);
    window.addEventListener("online", handleRetryOpportunity);
    window.addEventListener("focus", handleRetryOpportunity);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (remoteHydrationRetryTimerRef.current != null) {
        clearTimeout(remoteHydrationRetryTimerRef.current);
        remoteHydrationRetryTimerRef.current = null;
      }
      window.removeEventListener("online", handleRetryOpportunity);
      window.removeEventListener("focus", handleRetryOpportunity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [retryRemoteHydrationNow, state.calibrationState.remoteStatus, state.status]);

  return (
    <AppContext.Provider
      value={{
        state,
        setUserState,
        patchSessionState,
        patchPracticeState,
        retryPendingSubmissionNow,
        discardPendingSubmission,
        saveLocalCalibrationCompletion,
        skipCalibrationOnboarding
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
