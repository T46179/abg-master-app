// @vitest-environment jsdom

import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useAppContext } from "./AppProvider";
import { savePendingPracticeSubmission, savePracticeSlotsCache, loadPendingPracticeSubmission } from "../core/protectedPracticeCache";
import {
  createPendingCalibrationCompletion,
  loadPendingCalibrationCompletion,
  savePendingCalibrationCompletion
} from "../core/calibrationRecovery";
import type { CalibrationCompletionRecord } from "../core/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const loadRuntimeConfig = vi.fn();
const loadCasesPayload = vi.fn();
const createRuntimeSupabaseClient = vi.fn();
const ensureAnonymousSession = vi.fn();
const createAppStorage = vi.fn();
const submitProtectedPracticeCase = vi.fn();
const applyProtectedCaseCompletion = vi.fn();
const isProtectedPracticeError = vi.fn();
const captureAppException = vi.fn();
const loadRemoteProgressRow = vi.fn();
const completeCalibrationProgress = vi.fn();

vi.mock("../core/runtime", () => ({
  loadRuntimeConfig: (...args: unknown[]) => loadRuntimeConfig(...args),
  loadCasesPayload: (...args: unknown[]) => loadCasesPayload(...args),
  isRuntimeBootstrapError: (error: { name?: string }) => error?.name === "RuntimeBootstrapError",
  getRuntimeBootstrapUserMessage: () =>
    "We could not load the app data needed to start ABG Master. Please check your connection and refresh."
}));

vi.mock("../core/supabase", () => ({
  createRuntimeSupabaseClient: (...args: unknown[]) => createRuntimeSupabaseClient(...args),
  ensureAnonymousSession: (...args: unknown[]) => ensureAnonymousSession(...args)
}));

vi.mock("../core/storage", () => ({
  createAppStorage: (...args: unknown[]) => createAppStorage(...args)
}));

vi.mock("../core/monitoring", () => ({
  captureAppException: (...args: unknown[]) => captureAppException(...args)
}));

vi.mock("../core/progressionSync", () => ({
  loadRemoteProgressRow: (...args: unknown[]) => loadRemoteProgressRow(...args),
  completeCalibrationProgress: (...args: unknown[]) => completeCalibrationProgress(...args)
}));

vi.mock("../core/protectedPractice", () => ({
  submitProtectedPracticeCase: (...args: unknown[]) => submitProtectedPracticeCase(...args),
  applyProtectedCaseCompletion: (...args: unknown[]) => applyProtectedCaseCompletion(...args),
  isProtectedPracticeError: (...args: unknown[]) => isProtectedPracticeError(...args)
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe() {
  const { state, retryPendingSubmissionNow, skipCalibrationOnboarding } = useAppContext();
  return (
    <div>
      <div data-testid="sync-state">{state.practiceState.syncState}</div>
      <div data-testid="sync-message">{state.practiceState.syncMessage ?? ""}</div>
      <div data-testid="error-message">{state.errorMessage ?? ""}</div>
      <div data-testid="calibration-status">{state.calibrationState.remoteStatus}</div>
      <div data-testid="calibration-source">{state.calibrationState.completionSource}</div>
      <div data-testid="calibration-placement">{state.calibrationState.effectiveCompletion?.placement ?? ""}</div>
      <button type="button" onClick={retryPendingSubmissionNow}>retry</button>
      <button type="button" onClick={() => { void skipCalibrationOnboarding(); }}>skip calibration</button>
    </div>
  );
}

const payload = {
  deliveryMode: "protected_runtime",
  contentVersion: "beta-1",
  progressionConfig: null,
  dashboardState: null,
  defaultUserState: null
};

const runtimeConfig = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon"
};

const storageAdapter = {
  init: vi.fn(async () => undefined),
  loadUserState: vi.fn(async () => null),
  saveUserState: vi.fn(async () => undefined),
  resetUserState: vi.fn(async () => undefined),
  loadAdvancedRangesPreference: vi.fn(() => false),
  saveAdvancedRangesPreference: vi.fn(),
  loadLastPracticeDifficulty: vi.fn(() => null),
  saveLastPracticeDifficulty: vi.fn(),
  loadResultsExplanationPreferences: vi.fn(() => ({
    primary_disorder: true,
    compensation: true,
    anion_gap: true,
    additional_metabolic_process: true,
    clinical_context: true
  })),
  saveResultsExplanationPreferences: vi.fn(),
  loadResultsReviewExpandedPreference: vi.fn(() => false),
  saveResultsReviewExpandedPreference: vi.fn(),
  loadPracticeIntroSeen: vi.fn(() => false),
  savePracticeIntroSeen: vi.fn(),
  loadAppAreaVisited: vi.fn(() => false),
  saveAppAreaVisited: vi.fn(),
  loadSeenCaseState: vi.fn(() => ({})),
  saveSeenCaseState: vi.fn(),
  loadCalibrationCompletion: vi.fn<() => CalibrationCompletionRecord | null>(() => null),
  saveCalibrationCompletion: vi.fn(),
  clearCalibrationCompletion: vi.fn()
};

describe("AppProvider protected practice recovery", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function syncStateText() {
    return container.querySelector("[data-testid='sync-state']")?.textContent;
  }

  function syncMessageText() {
    return container.querySelector("[data-testid='sync-message']")?.textContent;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    loadRuntimeConfig.mockResolvedValue(runtimeConfig);
    loadCasesPayload.mockResolvedValue(payload);
    createRuntimeSupabaseClient.mockReturnValue({ supabase: { auth: {} }, supabaseEnabled: true });
    ensureAnonymousSession.mockResolvedValue({ userId: "user-1", syncUnavailable: false });
    createAppStorage.mockReturnValue(storageAdapter);
    storageAdapter.loadUserState.mockResolvedValue(null);
    storageAdapter.loadCalibrationCompletion.mockReturnValue(null);
    storageAdapter.saveCalibrationCompletion.mockClear();
    loadRemoteProgressRow.mockReset();
    loadRemoteProgressRow.mockResolvedValue(null);
    completeCalibrationProgress.mockReset();
    completeCalibrationProgress.mockResolvedValue(null);
    submitProtectedPracticeCase.mockReset();
    captureAppException.mockReset();
    applyProtectedCaseCompletion.mockImplementation(({ userState }: { userState: unknown }) => userState);
    isProtectedPracticeError.mockImplementation((error: { __protectedError?: boolean }) => Boolean(error?.__protectedError));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads a pending submission into pending_retry on startup", async () => {
    savePendingPracticeSubmission(localStorage, {
      caseToken: "token-1",
      caseId: "case-1",
      contentVersion: "beta-1",
      difficultyKey: "advanced",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 12,
      timedMode: false,
      clientCompletedAt: new Date().toISOString()
    });

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    expect(syncStateText()).toBe("pending_retry");
  });

  it("shows a friendly runtime bootstrap error while reporting the detailed failure", async () => {
    const bootstrapError = new Error("Unable to load protected runtime bootstrap from /runtime_bootstrap.json: Failed to fetch");
    bootstrapError.name = "RuntimeBootstrapError";
    Object.defineProperty(bootstrapError, "userMessage", {
      value: "We could not load the app data needed to start ABG Master. Please check your connection and refresh."
    });
    loadCasesPayload.mockRejectedValue(bootstrapError);

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    expect(container.querySelector("[data-testid='error-message']")?.textContent).toBe(
      "We could not load the app data needed to start ABG Master. Please check your connection and refresh."
    );
    expect(captureAppException).toHaveBeenCalledWith(bootstrapError, {
      name: "app_initialization",
      extra: {
        phase: "bootstrap"
      }
    });
  });

  it("clears stale pending submissions without attempting a retry", async () => {
    savePendingPracticeSubmission(localStorage, {
      caseToken: "token-1",
      caseId: "case-1",
      contentVersion: "beta-1",
      difficultyKey: "advanced",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 12,
      timedMode: false,
      clientCompletedAt: "2020-01-01T00:00:00Z"
    });

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    expect(syncStateText()).toBe("idle");
    expect(syncMessageText()).toBe("Your last case is no longer available. Please start a new case.");
    expect(loadPendingPracticeSubmission(localStorage)).toBeNull();
    expect(submitProtectedPracticeCase).not.toHaveBeenCalled();
  });

  it("clears pending submissions when the content version no longer matches", async () => {
    savePendingPracticeSubmission(localStorage, {
      caseToken: "token-1",
      caseId: "case-1",
      contentVersion: "old-version",
      difficultyKey: "advanced",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 12,
      timedMode: false,
      clientCompletedAt: new Date().toISOString()
    });

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    expect(syncStateText()).toBe("idle");
    expect(syncMessageText()).toBe("Your saved answers no longer match this case. Please start a new case.");
    expect(loadPendingPracticeSubmission(localStorage)).toBeNull();
    expect(submitProtectedPracticeCase).not.toHaveBeenCalled();
  });

  it("retries immediately when requested and clears pending state on success", async () => {
    savePendingPracticeSubmission(localStorage, {
      caseToken: "token-1",
      caseId: "case-1",
      contentVersion: "beta-1",
      difficultyKey: "advanced",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 12,
      timedMode: false,
      clientCompletedAt: new Date().toISOString()
    });
    savePracticeSlotsCache(localStorage, {
      advanced: {
        caseToken: "token-1",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        contentVersion: "beta-1",
        difficultyKey: "advanced",
        caseData: {
          case_id: "case-1",
          title: "Sample case",
          archetype: "dka",
          difficulty_level: 3,
          difficulty_label: "advanced",
          clinical_stem: "Test stem",
          inputs: { gas: {}, electrolytes: {}, other: {} },
          answer_key: { final_diagnosis: "DKA" },
          questions_flow: []
        }
      }
    });
    submitProtectedPracticeCase.mockResolvedValue({
      summary: {
        caseToken: "token-1",
        caseId: "case-1",
        correctSteps: 3,
        totalSteps: 4,
        totalXpAward: 15
      },
      progress: {
        xp: 15,
        level: 1,
        streak: 1,
        cases_completed: 1,
        correct_answers: 3,
        total_answers: 4,
        last_case_date: new Date().toISOString()
      },
      replacementSlot: {
        caseToken: "token-2",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        contentVersion: "beta-1",
        difficultyKey: "advanced",
        caseData: {
          case_id: "case-2",
          title: "Replacement case",
          archetype: "dka",
          difficulty_level: 3,
          difficulty_label: "advanced",
          clinical_stem: "Replacement stem",
          inputs: { gas: {}, electrolytes: {}, other: {} },
          answer_key: { final_diagnosis: "DKA" },
          questions_flow: []
        }
      }
    });

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    const retryButton = container.querySelector("button");
    act(() => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(submitProtectedPracticeCase).toHaveBeenCalledTimes(1);
    expect(syncStateText()).toBe("idle");
    expect(loadPendingPracticeSubmission(localStorage)).toBeNull();
    expect(storageAdapter.saveUserState).toHaveBeenCalledWith(expect.objectContaining({
      recentResults: [false],
      recentPracticeAttempts: [
        expect.objectContaining({
          difficulty: "advanced",
          correctSteps: 3,
          totalSteps: 4
        })
      ]
    }));
  });

  it("uses timed background retries and does not overlap in-flight submissions", async () => {
    const deferred = createDeferred<{
      summary: { caseToken: string; caseId: string };
      replacementSlot: {
        caseToken: string;
        issuedAt: string;
        expiresAt: string;
        contentVersion: string;
        difficultyKey: string;
        caseData: {
          case_id: string;
          title: string;
          archetype: string;
          difficulty_level: number;
          difficulty_label: string;
          clinical_stem: string;
          inputs: { gas: {}; electrolytes: {}; other: {} };
          answer_key: { final_diagnosis: string };
          questions_flow: never[];
        };
      };
    }>();

    savePendingPracticeSubmission(localStorage, {
      caseToken: "token-1",
      caseId: "case-1",
      contentVersion: "beta-1",
      difficultyKey: "advanced",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 12,
      timedMode: false,
      clientCompletedAt: new Date().toISOString()
    });

    submitProtectedPracticeCase.mockReturnValue(deferred.promise);

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(submitProtectedPracticeCase).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(submitProtectedPracticeCase).toHaveBeenCalledTimes(1);

    deferred.resolve({
      summary: {
        caseToken: "token-1",
        caseId: "case-1"
      },
      replacementSlot: {
        caseToken: "token-2",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        contentVersion: "beta-1",
        difficultyKey: "advanced",
        caseData: {
          case_id: "case-2",
          title: "Replacement case",
          archetype: "dka",
          difficulty_level: 3,
          difficulty_label: "advanced",
          clinical_stem: "Replacement stem",
          inputs: { gas: {}, electrolytes: {}, other: {} },
          answer_key: { final_diagnosis: "DKA" },
          questions_flow: []
        }
      }
    });
    await flush();

    expect(syncStateText()).toBe("idle");
  });

  it("clears pending state when the server reports an expired case token", async () => {
    savePendingPracticeSubmission(localStorage, {
      caseToken: "token-1",
      caseId: "case-1",
      contentVersion: "beta-1",
      difficultyKey: "advanced",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 12,
      timedMode: false,
      clientCompletedAt: new Date().toISOString()
    });
    savePracticeSlotsCache(localStorage, {
      advanced: {
        caseToken: "token-1",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        contentVersion: "beta-1",
        difficultyKey: "advanced",
        caseData: {
          case_id: "case-1",
          title: "Sample case",
          archetype: "dka",
          difficulty_level: 3,
          difficulty_label: "advanced",
          clinical_stem: "Test stem",
          inputs: { gas: {}, electrolytes: {}, other: {} },
          answer_key: { final_diagnosis: "DKA" },
          questions_flow: []
        }
      }
    });
    submitProtectedPracticeCase.mockRejectedValue({
      __protectedError: true,
      code: "CASE_TOKEN_EXPIRED"
    });

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    const retryButton = container.querySelector("button");
    act(() => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(syncStateText()).toBe("idle");
    expect(loadPendingPracticeSubmission(localStorage)).toBeNull();
  });

  it("permits a valid local completion immediately while remote progress remains unresolved", async () => {
    storageAdapter.loadCalibrationCompletion.mockReturnValue({
      completed: true,
      placement: "beginner",
      version: 1
    });
    ensureAnonymousSession.mockReturnValue(new Promise(() => undefined));

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();

    expect(container.querySelector("[data-testid='calibration-status']")?.textContent).toBe("loading");
    expect(container.querySelector("[data-testid='calibration-source']")?.textContent).toBe("local");
    expect(container.querySelector("[data-testid='calibration-placement']")?.textContent).toBe("beginner");
  });

  it("reconciles a disagreeing remote completion as authoritative", async () => {
    storageAdapter.loadCalibrationCompletion.mockReturnValue({
      completed: true,
      placement: "beginner",
      version: 1
    });
    loadRemoteProgressRow.mockResolvedValue({
      calibration_completed: true,
      calibration_placement: "advanced"
    });

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();
    await flush();

    expect(container.querySelector("[data-testid='calibration-status']")?.textContent).toBe("loaded");
    expect(container.querySelector("[data-testid='calibration-source']")?.textContent).toBe("remote");
    expect(container.querySelector("[data-testid='calibration-placement']")?.textContent).toBe("advanced");
    expect(storageAdapter.saveCalibrationCompletion).toHaveBeenLastCalledWith(expect.objectContaining({ placement: "advanced" }));
  });

  it("resolves rejected remote hydration to unavailable", async () => {
    ensureAnonymousSession.mockRejectedValue(new Error("offline"));

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();
    await flush();

    expect(container.querySelector("[data-testid='calibration-status']")?.textContent).toBe("unavailable");
  });

  it("resolves stalled remote hydration to unavailable after ten seconds", async () => {
    ensureAnonymousSession.mockReturnValue(new Promise(() => undefined));

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();
    expect(container.querySelector("[data-testid='calibration-status']")?.textContent).toBe("loading");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(container.querySelector("[data-testid='calibration-status']")?.textContent).toBe("unavailable");
  });

  it("reconciles authoritative remote progress on a later reconnect", async () => {
    storageAdapter.loadCalibrationCompletion.mockReturnValue({
      completed: true,
      placement: "beginner",
      version: 1
    });
    ensureAnonymousSession.mockRejectedValueOnce(new Error("offline"));

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();
    await flush();
    expect(container.querySelector("[data-testid='calibration-status']")?.textContent).toBe("unavailable");

    ensureAnonymousSession.mockResolvedValue({ userId: "user-1", syncUnavailable: false });
    loadRemoteProgressRow.mockResolvedValue({
      calibration_completed: true,
      calibration_placement: "advanced"
    });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector("[data-testid='calibration-status']")?.textContent).toBe("loaded");
    expect(container.querySelector("[data-testid='calibration-placement']")?.textContent).toBe("advanced");
  });

  it("deduplicates rapid Skip actions and retains one pending operation after sync failure", async () => {
    completeCalibrationProgress.mockRejectedValue(new Error("offline"));

    act(() => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
    await flush();
    await flush();

    const skipButton = Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent === "skip calibration");
    await act(async () => {
      skipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      skipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(storageAdapter.saveCalibrationCompletion).toHaveBeenCalledTimes(1);
    expect(completeCalibrationProgress).toHaveBeenCalledTimes(1);
    expect(loadPendingCalibrationCompletion(localStorage)?.placement).toBe("beginner");
    expect(loadPendingCalibrationCompletion(localStorage)?.operationId).toBeTruthy();
  });

  it("does not duplicate pending calibration completion calls in Strict Mode", async () => {
    savePendingCalibrationCompletion(localStorage, createPendingCalibrationCompletion({
      operationId: "strict-mode-skip",
      calibrationVersion: 1,
      progressionVersion: "v2",
      betaReleaseNumber: 2
    }));
    completeCalibrationProgress.mockReturnValue(new Promise(() => undefined));

    act(() => {
      root.render(
        <StrictMode>
          <AppProvider><Probe /></AppProvider>
        </StrictMode>
      );
    });
    await flush();
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(completeCalibrationProgress).toHaveBeenCalledTimes(1);
  });
});
