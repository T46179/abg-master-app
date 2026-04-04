import { createEmptyUserState } from "../core/progression";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppStatus,
  CasesPayload,
  PracticeFlowState,
  RuntimeConfig,
  SessionState,
  StorageAdapter,
  UserState
} from "../core/types";

export interface AppState {
  status: "idle" | "loading" | "ready" | "error";
  runtimeConfig: RuntimeConfig | null;
  payload: CasesPayload | null;
  userState: UserState;
  sessionState: SessionState;
  practiceState: PracticeFlowState;
  appStatus: AppStatus;
  storage: StorageAdapter | null;
  supabase: SupabaseClient | null;
  supabaseEnabled: boolean;
  userId: string | null;
  syncUnavailable: boolean;
  errorMessage: string | null;
}

export type AppAction =
  | { type: "loading" }
  | {
    type: "ready";
    payload: {
      runtimeConfig: RuntimeConfig;
      payload: CasesPayload;
      userState: UserState;
      sessionState: SessionState;
      practiceState: PracticeFlowState;
      storage: StorageAdapter;
      supabase: SupabaseClient | null;
      supabaseEnabled: boolean;
      userId: string | null;
      syncUnavailable: boolean;
    };
  }
  | { type: "error"; message: string }
  | { type: "user_state_updated"; userState: UserState }
  | { type: "session_state_patched"; patch: Partial<SessionState> }
  | { type: "practice_state_patched"; patch: Partial<PracticeFlowState> };

export const initialSessionState: SessionState = {
  currentView: "dashboard",
  currentDifficulty: "beginner",
  currentStepIndex: 0,
  selectedAnswers: [],
  stepResults: [],
  stepOptionOverrides: {},
  caseStartMs: null,
  timedMode: false,
  showAdvancedRanges: false
};

export const initialAppStatus: AppStatus = {
  blocking: null,
  warnings: {}
};

export const initialPracticeState: PracticeFlowState = {
  currentCase: null,
  currentCaseToken: null,
  currentCaseExpiresAt: null,
  lastCaseSummary: null,
  practiceSlotsByDifficulty: {},
  pendingSubmission: null,
  syncState: "idle",
  syncMessage: null
};

export const initialAppState: AppState = {
  status: "idle",
  runtimeConfig: null,
  payload: null,
  userState: createEmptyUserState(),
  sessionState: initialSessionState,
  practiceState: initialPracticeState,
  appStatus: initialAppStatus,
  storage: null,
  supabase: null,
  supabaseEnabled: false,
  userId: null,
  syncUnavailable: false,
  errorMessage: null
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "loading":
      return {
        ...state,
        status: "loading",
        errorMessage: null
      };
    case "ready":
      return {
        ...state,
        status: "ready",
        runtimeConfig: action.payload.runtimeConfig,
        payload: action.payload.payload,
        userState: action.payload.userState,
        sessionState: action.payload.sessionState,
        practiceState: action.payload.practiceState,
        storage: action.payload.storage,
        supabase: action.payload.supabase,
        supabaseEnabled: action.payload.supabaseEnabled,
        userId: action.payload.userId,
        syncUnavailable: action.payload.syncUnavailable,
        appStatus: {
          ...state.appStatus,
          warnings: action.payload.syncUnavailable
            ? { sync_unavailable: { message: "Cloud sync is unavailable. Using local mode for now." } }
            : {}
        }
      };
    case "error":
      return {
        ...state,
        status: "error",
        errorMessage: action.message,
        appStatus: {
          ...state.appStatus,
          blocking: {
            title: "Frontend failed to initialize.",
            message: action.message
          }
        }
      };
    case "user_state_updated":
      return {
        ...state,
        userState: action.userState
      };
    case "session_state_patched":
      return {
        ...state,
        sessionState: {
          ...state.sessionState,
          ...action.patch
        }
      };
    case "practice_state_patched":
      return {
        ...state,
        practiceState: {
          ...state.practiceState,
          ...action.patch
        }
      };
    default:
      return state;
  }
}
