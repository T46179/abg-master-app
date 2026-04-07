// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useAppContext } from "./AppProvider";
import { savePendingPracticeSubmission, savePracticeSlotsCache, loadPendingPracticeSubmission } from "../core/protectedPracticeCache";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const loadRuntimeConfig = vi.fn();
const loadCasesPayload = vi.fn();
const createRuntimeSupabaseClient = vi.fn();
const ensureAnonymousSession = vi.fn();
const createAppStorage = vi.fn();
const submitProtectedPracticeCase = vi.fn();
const applyProtectedCaseCompletion = vi.fn();
const isProtectedPracticeError = vi.fn();

vi.mock("../core/runtime", () => ({
  loadRuntimeConfig: (...args: unknown[]) => loadRuntimeConfig(...args),
  loadCasesPayload: (...args: unknown[]) => loadCasesPayload(...args)
}));

vi.mock("../core/supabase", () => ({
  createRuntimeSupabaseClient: (...args: unknown[]) => createRuntimeSupabaseClient(...args),
  ensureAnonymousSession: (...args: unknown[]) => ensureAnonymousSession(...args)
}));

vi.mock("../core/storage", () => ({
  createAppStorage: (...args: unknown[]) => createAppStorage(...args)
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
  const { state, retryPendingSubmissionNow } = useAppContext();
  return (
    <div>
      <div data-testid="sync-state">{state.practiceState.syncState}</div>
      <div data-testid="sync-message">{state.practiceState.syncMessage ?? ""}</div>
      <button type="button" onClick={retryPendingSubmissionNow}>retry</button>
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
  loadResultsExplanationPreferences: vi.fn(() => ({
    compensation: true,
    anion_gap: true,
    clinical_context: true
  })),
  saveResultsExplanationPreferences: vi.fn(),
  loadPracticeIntroSeen: vi.fn(() => false),
  savePracticeIntroSeen: vi.fn(),
  loadSeenCaseState: vi.fn(() => ({})),
  saveSeenCaseState: vi.fn()
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
    submitProtectedPracticeCase.mockReset();
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
    expect(syncMessageText()).toBe("This unsaved case expired. Please start a new one.");
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
    expect(syncMessageText()).toBe("This unsaved case no longer matches the current content. Please start a new one.");
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
});
