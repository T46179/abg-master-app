// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseSummary, IssuedPracticeSlot } from "../../core/types";
import { mapProgressRowToUserState } from "../../core/progression";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const patchPracticeState = vi.fn();
const patchSessionState = vi.fn();
const setUserState = vi.fn();
const trackEvent = vi.fn();
const mockCanStartNewCase = vi.hoisted(() => vi.fn(() => false));
let latestQuestionFlowCardProps: Record<string, unknown> | null = null;
let latestResultsSummaryCardProps: Record<string, unknown> | null = null;
let latestResultsSummaryHeaderProps: Record<string, unknown> | null = null;
let latestLearnUnlockModalProps: Record<string, unknown> | null = null;

let currentState: {
  status: "ready";
  errorMessage: null;
  payload: {
    progressionConfig: null;
    dashboardState: null;
    defaultUserState: null;
    cases: unknown[];
    contentVersion: string;
    deliveryMode: "protected_runtime";
  };
  runtimeConfig: Record<string, unknown> | null;
  supabase: Record<string, unknown> | null;
  userState: {
    xp: number;
    level: number;
    abandonedCases: number;
    recentResults: boolean[];
    recentPracticeAttempts?: Array<{
      difficulty: string;
      correctSteps: number;
      totalSteps: number;
      completedAt?: string | null;
    }>;
    casesCompleted: number;
    correctAnswers: number;
    totalAnswers: number;
    streak: number;
    dailyCasesUsed: number;
    lastCaseDate: null;
    unlockedDifficulties: string[];
    isPremium: boolean;
    badges: string[];
    appliedProtectedCaseTokens: string[];
  };
  sessionState: {
    currentDifficulty: string;
    currentStepIndex: number;
    selectedAnswers: Array<Record<string, unknown>>;
    stepResults: Array<Record<string, unknown>>;
    stepOptionOverrides: Record<string, unknown>;
    caseStartMs: null;
    timedMode: false;
    showAdvancedRanges: false;
  };
  practiceState: {
    currentCase: Record<string, unknown> | null;
    currentCaseToken: string | null;
    currentCaseExpiresAt: string | null;
    lastCaseSummary: CaseSummary | Record<string, unknown> | null;
    practiceSlotsByDifficulty: Record<string, unknown>;
    pendingSubmission: null;
    syncState: "idle" | "unavailable";
    syncMessage: string | null;
  };
  storage: {
    loadCalibrationCompletion: () => null;
    loadPracticeIntroSeen: () => boolean;
    savePracticeIntroSeen: ReturnType<typeof vi.fn>;
    loadAppAreaVisited: () => boolean;
    saveAppAreaVisited: ReturnType<typeof vi.fn>;
    saveAdvancedRangesPreference: ReturnType<typeof vi.fn>;
    loadLastPracticeDifficulty: () => string | null;
    saveLastPracticeDifficulty: ReturnType<typeof vi.fn>;
    loadSeenCaseState: () => Record<string, string[]>;
    saveSeenCaseState: ReturnType<typeof vi.fn>;
  };
};

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: currentState,
    setUserState,
    patchPracticeState,
    patchSessionState
  })
}));

vi.mock("../../app/viewHelpers", () => ({
  getCalibrationAllowedDifficulties: () => ["beginner"],
  getDefaultPracticeDifficulty: () => "beginner",
  getPracticeDifficultyMismatchAction: () => null,
  hasCompletedCalibration: () => false,
  resolvePracticeDifficulty: ({ requestedDifficulty }: { requestedDifficulty?: string | null }) => ({
    resolvedDifficulty: requestedDifficulty || "beginner",
    shouldRedirect: false
  }),
  shouldConfirmDifficultySwitch: () => false,
  shouldShowPracticeIntro: () => false
}));

vi.mock("../../core/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args)
}));

vi.mock("../../core/feedback", () => ({
  openCaseFeedbackForm: vi.fn()
}));

vi.mock("../../core/metrics", () => ({
  shouldShowMetricReferences: () => false
}));

vi.mock("../../core/explanations", () => ({
  buildConciseStepFeedback: vi.fn()
}));

vi.mock("../../core/protectedPractice", () => ({
  applyProtectedCaseCompletion: vi.fn(),
  buildPendingPracticeSubmission: vi.fn(),
  isProtectedPracticeError: vi.fn(),
  prepareProtectedPracticeCases: vi.fn(),
  submitProtectedPracticeCase: vi.fn()
}));

vi.mock("../../core/protectedPracticeCache", () => ({
  clearPracticeSlotCache: vi.fn((_storage, slots) => ({ ...slots, beginner: null })),
  clearPendingPracticeSubmission: vi.fn(),
  loadPracticeSlotsCache: vi.fn(() => ({})),
  slotMatchesDifficultyKey: vi.fn(() => true),
  savePendingPracticeSubmission: vi.fn(),
  savePracticeSlotsCache: vi.fn()
}));

vi.mock("../../core/practice", () => ({
  canUseClientSidePracticeFeedback: () => false,
  getCorrectAnswer: vi.fn(),
  isCorrectAnswer: vi.fn(),
  prettyStepLabel: vi.fn((value: string) => value),
  reconcileProtectedSummaryWithLockedStepResults: vi.fn()
}));

vi.mock("../../core/progression", () => ({
  appendPracticeAttemptSummary: (_userState: unknown, attempt: unknown) => [attempt],
  canStartNewCase: () => mockCanStartNewCase(),
  getCalibrationCompletionFromUserState: () => null,
  getAccessibleDifficultyKeys: (input: { userState?: { unlockedDifficulties?: string[] } }) => input.userState?.unlockedDifficulties ?? [],
  getAwardableXpWithReadinessGates: ({ requestedXp }: { requestedXp: number }) => requestedXp,
  getDifficultyLabel: () => "beginner",
  getDifficultyMeta: () => [],
  getHighestAccessibleDifficultyKey: () => "beginner",
  getLevelProgress: () => ({ xpIntoLevel: 0, xpForNextLevel: 0, progressPercent: 0, isBlockedByReadinessGate: false }),
  getMaxReachableLevel: () => 20,
  getReleaseFlags: () => ({ enableCalibrationAccessGuard: false }),
  isPlacementXpBoostActive: () => false,
  mapProgressRowToUserState: vi.fn(() => null),
  normalizeDifficultyKey: (_input: unknown, requestedDifficulty: string) => requestedDifficulty || "beginner",
  syncUserStateDerivedFields: <T extends { xp?: number; level?: number }>(value: T) => ({
    ...value,
    level: Math.max(1, Math.floor(Math.max(0, Number(value.xp ?? 0)) / 100) + 1)
  })
}));

vi.mock("../../core/progressionSync", () => ({
  completeCalibrationProgress: vi.fn()
}));

vi.mock("../../core/selection", () => ({
  buildStepOptionOverrides: vi.fn(() => ({})),
  createEmptySeenCasesState: () => ({}),
  markCaseSeen: vi.fn(),
  rememberRecentArchetype: vi.fn((previous: string[]) => previous)
}));

vi.mock("../practice/PracticeDifficultyRail", () => ({
  PracticeDifficultyRail: () => null
}));

vi.mock("../practice/CalibrationIntroModal", () => ({
  CalibrationIntroModal: () => null
}));

vi.mock("../practice/QuestionFlowCard", () => ({
  QuestionFlowCard: (props: Record<string, unknown>) => {
    latestQuestionFlowCardProps = props;
    return null;
  }
}));

vi.mock("../practice/ResultsSummaryCard", () => ({
  ResultsSummaryCard: (props: Record<string, unknown>) => {
    latestResultsSummaryCardProps = props;
    return <button data-testid="results-summary-card" type="button" onClick={() => (props.onNextCase as () => void)?.()}>Next case</button>;
  },
  ResultsSummaryHeader: (props: Record<string, unknown>) => {
    latestResultsSummaryHeaderProps = props;
    return <div data-testid="results-summary-header" />;
  }
}));

vi.mock("../practice/ResultsPatternTip", () => ({
  ResultsPatternTip: () => <div data-testid="results-pattern-tip" />
}));

vi.mock("../learn/LearnUnlockModal", () => ({
  LearnUnlockModal: (props: Record<string, unknown>) => {
    latestLearnUnlockModalProps = props;
    return null;
  }
}));

vi.mock("../practice/ScenarioCard", () => ({
  ScenarioCard: () => null
}));

vi.mock("../practice/ValuePanels", () => ({
  ValuePanels: () => null
}));

import {
  applyProtectedCaseCompletion,
  buildPendingPracticeSubmission,
  isProtectedPracticeError,
  submitProtectedPracticeCase
} from "../../core/protectedPractice";
import {
  clearPendingPracticeSubmission,
  clearPracticeSlotCache,
  savePracticeSlotsCache
} from "../../core/protectedPracticeCache";
import { reconcileProtectedSummaryWithLockedStepResults } from "../../core/practice";
import { ProtectedPracticeScreen } from "./ProtectedPracticeScreen";

function makeCaseSummary(overrides: Partial<CaseSummary> = {}): CaseSummary {
  return {
    caseToken: "summary-token",
    caseId: "CASE_005",
    title: "Test case",
    difficulty: "beginner",
    explanation: { overview: "Test explanation", sections: [] },
    learningObjective: "Test learning objective",
    elapsedSeconds: 30,
    accuracy: 1,
    correctSteps: 5,
    totalSteps: 5,
    totalXpAward: 10,
    baseXp: 10,
    perfectBonus: 0,
    speedBonus: 0,
    level: 1,
    stepResults: [],
    caseData: {
      case_id: "CASE_005",
      archetype: "simple_nagma",
      difficulty_level: 1
    },
    ...overrides
  };
}

function makePracticeSlot(overrides: Partial<IssuedPracticeSlot> = {}): IssuedPracticeSlot {
  return {
    caseToken: "token-next",
    issuedAt: "2026-04-30T00:00:00.000Z",
    expiresAt: "2026-04-30T01:00:00.000Z",
    contentVersion: "beta-1",
    difficultyKey: "beginner",
    caseData: {
      case_id: "CASE_NEXT",
      archetype: "simple_nagma",
      difficulty_level: 1
    },
    ...overrides
  };
}

describe("ProtectedPracticeScreen unavailable messaging", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    patchPracticeState.mockReset();
    patchSessionState.mockReset();
    setUserState.mockReset();
    trackEvent.mockReset();
    mockCanStartNewCase.mockReset();
    mockCanStartNewCase.mockReturnValue(false);
    latestQuestionFlowCardProps = null;
    latestResultsSummaryCardProps = null;
    latestResultsSummaryHeaderProps = null;
    latestLearnUnlockModalProps = null;
    vi.mocked(buildPendingPracticeSubmission).mockReturnValue({
      caseToken: "token-1",
      caseId: "CASE_001",
      contentVersion: "beta-1",
      difficultyKey: "beginner",
      answers: [],
      elapsedSeconds: 0,
      timedMode: false,
      clientCompletedAt: "2026-04-30T00:00:00.000Z"
    });
    vi.mocked(reconcileProtectedSummaryWithLockedStepResults).mockImplementation(({ summary }) => summary);
    vi.mocked(applyProtectedCaseCompletion).mockImplementation(({ userState }) => userState);
    vi.mocked(isProtectedPracticeError).mockImplementation((error: unknown) => {
      return Boolean((error as { __protectedError?: boolean } | null)?.__protectedError);
    });
    vi.mocked(submitProtectedPracticeCase).mockResolvedValue({
      summary: makeCaseSummary({
        caseId: "CASE_005",
        caseData: {
          case_id: "CASE_005",
          archetype: "simple_nagma",
          difficulty_level: 1
        }
      }),
      replacementSlot: makePracticeSlot({
        caseToken: "token-next",
        caseData: {
          case_id: "CASE_NEXT",
          archetype: "simple_nagma",
          difficulty_level: 1
        }
      })
    });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true
    });
    currentState = {
      status: "ready",
      errorMessage: null,
      payload: {
        progressionConfig: null,
        dashboardState: null,
        defaultUserState: null,
        cases: [],
        contentVersion: "beta-1",
        deliveryMode: "protected_runtime"
      },
      runtimeConfig: null,
      supabase: null,
      userState: {
        xp: 0,
        level: 1,
        abandonedCases: 0,
        recentResults: [],
        casesCompleted: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        streak: 0,
        dailyCasesUsed: 0,
        lastCaseDate: null,
        unlockedDifficulties: ["beginner"],
        isPremium: false,
        badges: [],
        appliedProtectedCaseTokens: []
      },
      sessionState: {
        currentDifficulty: "beginner",
        currentStepIndex: 0,
        selectedAnswers: [],
        stepResults: [],
        stepOptionOverrides: {},
        caseStartMs: null,
        timedMode: false,
        showAdvancedRanges: false
      },
      practiceState: {
        currentCase: null,
        currentCaseToken: null,
        currentCaseExpiresAt: null,
        lastCaseSummary: null,
        practiceSlotsByDifficulty: {},
        pendingSubmission: null,
        syncState: "unavailable",
        syncMessage: null
      },
      storage: {
        loadCalibrationCompletion: () => null,
        loadPracticeIntroSeen: () => true,
        savePracticeIntroSeen: vi.fn(),
        loadAppAreaVisited: () => true,
        saveAppAreaVisited: vi.fn(),
        saveAdvancedRangesPreference: vi.fn(),
        loadLastPracticeDifficulty: () => null,
        saveLastPracticeDifficulty: vi.fn(),
        loadSeenCaseState: () => ({}),
        saveSeenCaseState: vi.fn()
      }
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function renderScreen(initialEntry = "/practice?difficulty=beginner") {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <ProtectedPracticeScreen />
        </MemoryRouter>
      );
    });
  }

  it("tracks practice page opens with the selected difficulty", () => {
    renderScreen("/practice?difficulty=beginner&source=landing");

    expect(trackEvent).toHaveBeenCalledWith("practice_opened", {
      difficulty: "beginner",
      source: "landing"
    });
  });

  it("tracks practice case starts when a cached case is activated", async () => {
    mockCanStartNewCase.mockReturnValue(true);
    currentState.runtimeConfig = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon"
    };
    currentState.supabase = {};
    currentState.practiceState.practiceSlotsByDifficulty = {
      beginner: {
        caseToken: "token-1",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        contentVersion: "beta-1",
        difficultyKey: "beginner",
        caseData: {
          case_id: "CASE_001",
          archetype: "simple_nagma",
          difficulty_level: 1,
          questions_flow: [{ key: "ph_status", options: ["Acidaemia"] }]
        }
      }
    };

    renderScreen("/practice?difficulty=beginner&source=landing");
    await flushEffects();

    expect(trackEvent).toHaveBeenCalledWith("practice_case_started", {
      difficulty: "beginner",
      case_id: "CASE_001",
      archetype: "simple_nagma",
      source: "landing"
    });
  });

  it("tracks practice step answers with correctness", () => {
    currentState.practiceState.currentCase = {
      case_id: "CASE_002",
      archetype: "simple_nagma",
      difficulty_level: 1,
      clinical_stem: "Test stem",
      questions_flow: [{ key: "ph_status", options: ["Acidaemia", "Alkalaemia", "Normal"] }]
    };

    renderScreen("/practice?difficulty=beginner&source=landing");

    act(() => {
      (latestQuestionFlowCardProps?.onAnswer as (option: string) => void)?.("Acidaemia");
    });

    expect(trackEvent).toHaveBeenCalledWith("practice_step_answered", {
      difficulty: "beginner",
      case_id: "CASE_002",
      archetype: "simple_nagma",
      step: "ph_status",
      is_correct: false,
      total_steps: 1,
      source: "landing"
    });
  });

  it("tracks practice case completion", async () => {
    currentState.runtimeConfig = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon"
    };
    currentState.supabase = {};
    currentState.practiceState.currentCaseToken = "token-5";
    currentState.practiceState.currentCase = {
      case_id: "CASE_005",
      archetype: "simple_nagma",
      difficulty_level: 1,
      clinical_stem: "Test stem",
      questions_flow: [{ key: "ph_status", options: ["Acidaemia"] }]
    };
    currentState.sessionState.selectedAnswers = [
      {
        key: "ph_status",
        chosen: "Acidaemia"
      }
    ];

    renderScreen();

    await act(async () => {
      (latestQuestionFlowCardProps?.onContinueStep as () => void)?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(trackEvent).toHaveBeenCalledWith("practice_case_completed", {
      difficulty: "beginner",
      case_id: "CASE_005",
      archetype: "simple_nagma",
      total_steps: 5,
      correct_steps: 5,
      completed: true
    });
  });

  it("preserves server-applied xp when locked-step reconciliation recalculates requested xp", async () => {
    currentState.runtimeConfig = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon"
    };
    currentState.supabase = {};
    currentState.practiceState.currentCaseToken = "token-locked";
    currentState.practiceState.currentCase = {
      case_id: "CASE_005",
      archetype: "simple_nagma",
      difficulty_level: 4,
      questions_flow: [{ key: "ph_status", options: ["Acidaemia"] }]
    };
    currentState.sessionState.selectedAnswers = [
      {
        key: "ph_status",
        chosen: "Acidaemia"
      }
    ];
    vi.mocked(submitProtectedPracticeCase).mockResolvedValueOnce({
      summary: makeCaseSummary({
        totalXpAward: 0,
        correctSteps: 0,
        totalSteps: 1
      }),
      replacementSlot: makePracticeSlot(),
      progress: { xp: 1717, level: 14 }
    });
    vi.mocked(mapProgressRowToUserState).mockReturnValueOnce({ xp: 1717, level: 14 });
    vi.mocked(reconcileProtectedSummaryWithLockedStepResults).mockReturnValueOnce(makeCaseSummary({
      totalXpAward: 65,
      correctSteps: 0,
      totalSteps: 1
    }));

    renderScreen();

    await act(async () => {
      (latestQuestionFlowCardProps?.onContinueStep as () => void)?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(patchPracticeState).toHaveBeenCalledWith(expect.objectContaining({
      lastCaseSummary: expect.objectContaining({
        totalXpAward: 0
      })
    }));
    expect(setUserState).toHaveBeenCalledWith(expect.objectContaining({
      recentResults: [false],
      recentPracticeAttempts: [
        expect.objectContaining({
          difficulty: "beginner",
          correctSteps: 0,
          totalSteps: 1
        })
      ]
    }));
  });

  it("clears stale protected practice cases when the server no longer has the case slot", async () => {
    currentState.runtimeConfig = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon"
    };
    currentState.supabase = {};
    currentState.practiceState.currentCaseToken = "stale-token";
    currentState.practiceState.practiceSlotsByDifficulty = {
      beginner: {
        caseToken: "stale-token",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        contentVersion: "beta-1",
        difficultyKey: "beginner",
        caseData: {
          case_id: "CASE_STALE",
          archetype: "simple_nagma",
          difficulty_level: 1,
          questions_flow: [{ key: "ph_status", options: ["Acidaemia"] }]
        }
      }
    };
    currentState.practiceState.currentCase = {
      case_id: "CASE_STALE",
      archetype: "simple_nagma",
      difficulty_level: 1,
      questions_flow: [{ key: "ph_status", options: ["Acidaemia"] }]
    };
    currentState.sessionState.selectedAnswers = [
      {
        key: "ph_status",
        chosen: "Acidaemia"
      }
    ];
    vi.mocked(buildPendingPracticeSubmission).mockReturnValue({
      caseToken: "stale-token",
      caseId: "CASE_STALE",
      contentVersion: "beta-1",
      difficultyKey: "beginner",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 0,
      timedMode: false,
      clientCompletedAt: "2026-04-30T00:00:00.000Z"
    });
    vi.mocked(submitProtectedPracticeCase).mockRejectedValue({
      __protectedError: true,
      code: "CASE_SLOT_UNAVAILABLE",
      status: 404
    });

    renderScreen();

    await act(async () => {
      (latestQuestionFlowCardProps?.onContinueStep as () => void)?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearPracticeSlotCache).toHaveBeenCalledWith(
      window.localStorage,
      currentState.practiceState.practiceSlotsByDifficulty,
      "beginner",
      "stale-token",
      undefined
    );
    expect(savePracticeSlotsCache).toHaveBeenCalled();
    expect(clearPendingPracticeSubmission).toHaveBeenCalledWith(window.localStorage);
    expect(patchPracticeState).toHaveBeenCalledWith(expect.objectContaining({
      currentCase: null,
      currentCaseToken: null,
      pendingSubmission: null,
      syncState: "idle",
      syncMessage: "This case is no longer available. Please start a new case."
    }));
  });

  it("tracks summary views and next-case clicks", () => {
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      caseToken: "summary-token",
      caseId: "CASE_003",
      difficulty: "beginner",
      correctSteps: 4,
      totalSteps: 5,
      caseData: {
        case_id: "CASE_003",
        archetype: "simple_nagma",
        difficulty_level: 1
      }
    });
    currentState.practiceState.practiceSlotsByDifficulty = {
      beginner: makePracticeSlot({
        caseData: {
          case_id: "CASE_004",
          archetype: "simple_nagma",
          difficulty_level: 1
        }
      })
    };

    renderScreen();

    expect(trackEvent).toHaveBeenCalledWith("case_explanation_viewed", {
      difficulty: "beginner",
      case_id: "CASE_003",
      archetype: "simple_nagma",
      total_steps: 5,
      correct_steps: 4
    });

    act(() => {
      (latestResultsSummaryCardProps?.onNextCase as () => void)?.();
    });

    expect(trackEvent).toHaveBeenCalledWith("practice_next_case_clicked", {
      difficulty: "beginner",
      completed_case_id: "CASE_003",
      next_case_id: "CASE_004",
      archetype: "simple_nagma",
      source: "case_summary"
    });
  });

  it("places the pattern tip between the XP header and detailed summary", () => {
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      caseToken: "summary-token-pattern-tip"
    });

    renderScreen();

    const header = container.querySelector("[data-testid='results-summary-header']");
    const patternTip = container.querySelector("[data-testid='results-pattern-tip']");
    const summaryCard = container.querySelector("[data-testid='results-summary-card']");

    expect(header?.compareDocumentPosition(patternTip as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(patternTip?.compareDocumentPosition(summaryCard as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not replay the XP progress animation when an existing summary is remounted", () => {
    currentState.userState = {
      ...currentState.userState,
      xp: 30,
      level: 1
    };
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      caseToken: "summary-token-animation-once",
      caseId: "CASE_ANIMATION_ONCE",
      totalXpAward: 10,
      caseData: {
        case_id: "CASE_ANIMATION_ONCE",
        archetype: "simple_nagma",
        difficulty_level: 1
      }
    });

    renderScreen();

    expect((latestResultsSummaryHeaderProps as { progressAnimate?: boolean } | null)?.progressAnimate).toBe(true);

    act(() => {
      root.unmount();
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestResultsSummaryHeaderProps = null;

    renderScreen();

    expect((latestResultsSummaryHeaderProps as { progressAnimate?: boolean } | null)?.progressAnimate).toBe(false);
  });

  it("does not show the Advanced unlock modal when only the level threshold is reached", () => {
    currentState.payload.progressionConfig = {
      xp_required_per_level: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 100])),
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
      difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
    } as never;
    currentState.userState = {
      ...currentState.userState,
      xp: 900,
      level: 10,
      unlockedDifficulties: ["beginner", "intermediate"]
    };
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      totalXpAward: 10,
      caseData: {
        case_id: "CASE_003",
        archetype: "simple_nagma",
        difficulty_level: 1
      }
    });

    renderScreen();

    expect((latestLearnUnlockModalProps as { level?: unknown } | null)?.level).toBeNull();
  });

  it("shows the Intermediate unlock modal when the difficulty becomes accessible at level 5", () => {
    currentState.payload.progressionConfig = {
      xp_required_per_level: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 100])),
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
      difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
    } as never;
    currentState.userState = {
      ...currentState.userState,
      xp: 400,
      level: 5,
      unlockedDifficulties: ["beginner", "intermediate"]
    };
    (currentState.userState as typeof currentState.userState & { intermediateUnlockedAt?: string }).intermediateUnlockedAt = "2026-05-10T00:00:00.000Z";
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      caseToken: "summary-token-intermediate-unlock",
      totalXpAward: 10,
      caseData: {
        case_id: "CASE_INTERMEDIATE_UNLOCK",
        archetype: "simple_nagma",
        difficulty_level: 1
      }
    });

    renderScreen();

    expect((latestLearnUnlockModalProps as { level?: unknown } | null)?.level).toMatchObject({
      slug: "intermediate"
    });
  });

  it("does not show the Intermediate unlock modal when level 5 is reached but access is not available", () => {
    currentState.payload.progressionConfig = {
      xp_required_per_level: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 100])),
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
      difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
    } as never;
    currentState.userState = {
      ...currentState.userState,
      xp: 400,
      level: 5,
      unlockedDifficulties: ["beginner"]
    };
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      caseToken: "summary-token-intermediate-threshold-only",
      totalXpAward: 10,
      caseData: {
        case_id: "CASE_INTERMEDIATE_THRESHOLD_ONLY",
        archetype: "simple_nagma",
        difficulty_level: 1
      }
    });

    renderScreen();

    expect((latestLearnUnlockModalProps as { level?: unknown } | null)?.level).toBeNull();
  });

  it("does not show the same difficulty unlock modal again after it is dismissed and remounted", () => {
    currentState.payload.progressionConfig = {
      xp_required_per_level: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 100])),
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
      difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
    } as never;
    currentState.userState = {
      ...currentState.userState,
      xp: 400,
      level: 5,
      unlockedDifficulties: ["beginner", "intermediate"]
    };
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      caseToken: "summary-token-intermediate-dismiss-once",
      totalXpAward: 10,
      caseData: {
        case_id: "CASE_INTERMEDIATE_DISMISS_ONCE",
        archetype: "simple_nagma",
        difficulty_level: 1
      }
    });

    renderScreen();

    expect((latestLearnUnlockModalProps as { level?: unknown } | null)?.level).toMatchObject({
      slug: "intermediate"
    });

    act(() => {
      (latestLearnUnlockModalProps?.onClose as () => void)?.();
    });

    act(() => {
      root.unmount();
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestLearnUnlockModalProps = null;

    renderScreen();

    expect((latestLearnUnlockModalProps as { level?: unknown } | null)?.level).toBeNull();
  });

  it("shows the Advanced unlock modal when the difficulty actually becomes accessible", () => {
    currentState.payload.progressionConfig = {
      xp_required_per_level: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 100])),
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
      difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
    } as never;
    currentState.userState = {
      ...currentState.userState,
      xp: 900,
      level: 10,
      unlockedDifficulties: ["beginner", "intermediate", "advanced"]
    };
    (currentState.userState as typeof currentState.userState & { advancedUnlockedAt?: string }).advancedUnlockedAt = "2026-05-10T00:00:00.000Z";
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      totalXpAward: 10,
      caseData: {
        case_id: "CASE_003",
        archetype: "simple_nagma",
        difficulty_level: 1
      }
    });

    renderScreen();

    expect((latestLearnUnlockModalProps as { level?: unknown } | null)?.level).toMatchObject({
      slug: "advanced"
    });
  });

  it("shows the Master unlock modal when the difficulty actually becomes accessible", () => {
    currentState.payload.progressionConfig = {
      xp_required_per_level: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 100])),
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
      difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
    } as never;
    currentState.userState = {
      ...currentState.userState,
      xp: 1400,
      level: 15,
      unlockedDifficulties: ["beginner", "intermediate", "advanced", "master"]
    };
    (currentState.userState as typeof currentState.userState & { masterUnlockedAt?: string }).masterUnlockedAt = "2026-05-10T00:00:00.000Z";
    currentState.practiceState.lastCaseSummary = makeCaseSummary({
      totalXpAward: 10,
      caseData: {
        case_id: "CASE_003",
        archetype: "simple_nagma",
        difficulty_level: 3
      }
    });

    renderScreen();

    expect((latestLearnUnlockModalProps as { level?: unknown } | null)?.level).toMatchObject({
      slug: "master"
    });
  });

  it("shows a specific unavailable message from state instead of the generic fallback", () => {
    currentState.practiceState.syncMessage = "New cases aren't ready to load right now. Please try again in a moment.";

    renderScreen();

    expect(container.textContent).toContain("New cases aren't ready to load right now. Please try again in a moment.");
    expect(container.textContent).not.toContain("We can't load a new case right now. Please try again.");
  });

  it("falls back to the offline unavailable message when no specific message is present", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false
    });

    renderScreen();

    expect(container.textContent).toContain("You're offline right now. Reconnect to load a new case.");
  });

  it("falls back to the generic unavailable message when online and no specific message is present", () => {
    renderScreen();

    expect(container.textContent).toContain("We can't load a new case right now. Please try again.");
  });

  async function flushEffects() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("self-heals intro flags when existing progress is present", () => {
    currentState.userState.casesCompleted = 1;
    currentState.storage.loadPracticeIntroSeen = () => false;
    currentState.storage.loadAppAreaVisited = () => false;

    renderScreen();

    expect(currentState.storage.savePracticeIntroSeen).toHaveBeenCalledWith(true);
    expect(currentState.storage.saveAppAreaVisited).toHaveBeenCalledWith(true);
  });

  it("treats stored seen cases as existing practice progress", () => {
    currentState.storage.loadPracticeIntroSeen = () => false;
    currentState.storage.loadAppAreaVisited = () => false;
    currentState.storage.loadSeenCaseState = () => ({ beginner: ["case-1"] });

    renderScreen();

    expect(currentState.storage.savePracticeIntroSeen).toHaveBeenCalledWith(true);
    expect(currentState.storage.saveAppAreaVisited).toHaveBeenCalledWith(true);
  });

  it("passes the current non-final multi-select selection to the question flow card", () => {
    currentState.practiceState.syncState = "idle";
    currentState.practiceState.currentCase = {
      case_id: "SALICYLATE_001",
      difficulty_level: 4,
      clinical_stem: "Test stem",
      questions_flow: [
        { key: "ph_status", options: ["Acidaemia", "Alkalaemia", "Normal"] },
        {
          key: "acid_base_processes",
          selection_mode: "multi",
          options: [
            "Metabolic acidosis",
            "Metabolic alkalosis",
            "Respiratory acidosis",
            "Respiratory alkalosis"
          ]
        },
        { key: "compensation", options: ["Appropriate", "Inappropriate"] },
        { key: "anion_gap", options: ["Raised", "Normal"] },
        {
          key: "additional_metabolic_process",
          options: [
            "No additional metabolic process",
            "Additional NAGMA",
            "Additional metabolic alkalosis",
            "Cannot assess / not applicable"
          ]
        },
        { key: "final_diagnosis", options: ["Salicylate toxicity"] }
      ]
    };
    currentState.sessionState.currentStepIndex = 1;
    currentState.sessionState.selectedAnswers = [
      {},
      {
        key: "acid_base_processes",
        label: "Acid-base processes",
        chosen: ["Metabolic acidosis"]
      }
    ];

    renderScreen("/practice?difficulty=master");

    expect(latestQuestionFlowCardProps?.currentStepIndex).toBe(1);
    expect(latestQuestionFlowCardProps?.currentSelection).toEqual({
      key: "acid_base_processes",
      label: "Acid-base processes",
      chosen: ["Metabolic acidosis"]
    });
  });
});
