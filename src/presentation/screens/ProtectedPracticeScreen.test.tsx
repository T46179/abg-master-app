// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const patchPracticeState = vi.fn();
const patchSessionState = vi.fn();
const setUserState = vi.fn();
const trackEvent = vi.fn();
let latestQuestionFlowCardProps: Record<string, unknown> | null = null;

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
  runtimeConfig: null;
  supabase: null;
  userState: {
    xp: number;
    level: number;
    abandonedCases: number;
    recentResults: boolean[];
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
    currentCaseToken: null;
    currentCaseExpiresAt: null;
    lastCaseSummary: null;
    practiceSlotsByDifficulty: Record<string, unknown>;
    pendingSubmission: null;
    syncState: "idle" | "unavailable";
    syncMessage: string | null;
  };
  storage: {
    loadPracticeIntroSeen: () => boolean;
    savePracticeIntroSeen: ReturnType<typeof vi.fn>;
    saveAdvancedRangesPreference: ReturnType<typeof vi.fn>;
    loadSeenCaseState: () => Record<string, never>;
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
  getPracticeDifficultyMismatchAction: () => null,
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
  canStartNewCase: () => false,
  getAccessibleDifficultyKeys: () => [],
  getAwardableXp: vi.fn(),
  getDifficultyLabel: () => "beginner",
  getDifficultyMeta: () => [],
  getHighestAccessibleDifficultyKey: () => "beginner",
  getLevelProgress: () => ({ xpIntoLevel: 0, xpForNextLevel: 0, progressPercent: 0 }),
  normalizeDifficultyKey: (_input: unknown, requestedDifficulty: string) => requestedDifficulty || "beginner",
  syncUserStateDerivedFields: <T,>(value: T) => value
}));

vi.mock("../../core/selection", () => ({
  createEmptySeenCasesState: () => ({}),
  markCaseSeen: vi.fn(),
  rememberRecentArchetype: vi.fn((previous: string[]) => previous)
}));

vi.mock("../practice/PracticeDifficultyRail", () => ({
  PracticeDifficultyRail: () => null
}));

vi.mock("../practice/PracticeIntroModal", () => ({
  PracticeIntroModal: () => null
}));

vi.mock("../practice/QuestionFlowCard", () => ({
  QuestionFlowCard: (props: Record<string, unknown>) => {
    latestQuestionFlowCardProps = props;
    return null;
  }
}));

vi.mock("../practice/ResultsSummaryCard", () => ({
  ResultsSummaryCard: () => null,
  ResultsSummaryHeader: () => null
}));

vi.mock("../practice/ScenarioCard", () => ({
  ScenarioCard: () => null
}));

vi.mock("../practice/ValuePanels", () => ({
  ValuePanels: () => null
}));

import { ProtectedPracticeScreen } from "./ProtectedPracticeScreen";

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
    latestQuestionFlowCardProps = null;
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
        loadPracticeIntroSeen: () => true,
        savePracticeIntroSeen: vi.fn(),
        saveAdvancedRangesPreference: vi.fn(),
        loadSeenCaseState: () => ({})
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
