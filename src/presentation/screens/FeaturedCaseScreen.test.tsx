// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEATURED_CASE_DRAFT_STORAGE_KEY,
  FEATURED_CASE_DRAFT_VERSION
} from "../../core/featuredCase";
import { getQuestionFlowStepStatus } from "../../core/practice";
import type { AnswerSelection, CaseData, CaseSummary, StepResult } from "../../core/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const prepareFeaturedCase = vi.hoisted(() => vi.fn());
const confirmFeaturedCaseOpen = vi.hoisted(() => vi.fn());
const submitFeaturedCase = vi.hoisted(() => vi.fn());
let latestActivePracticeCaseProps: Record<string, unknown> | null = null;
let latestResultsSummaryHeaderProps: Record<string, unknown> | null = null;
let latestResultsSummaryCardProps: Record<string, unknown> | null = null;

const state = {
  status: "ready" as const,
  errorMessage: null,
  runtimeConfig: { supabaseUrl: "https://staging.example.test" },
  supabase: {},
  userId: "user-1",
  payload: {
    featuredRelease: {
      releaseId: "featured-authored-001-r1"
    }
  },
  userState: {
    level: 1
  },
  storage: {
    loadAdvancedRangesPreference: () => false,
    saveAdvancedRangesPreference: vi.fn()
  }
};

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({ state })
}));

vi.mock("../../core/featuredCase", async importOriginal => {
  const actual = await importOriginal<typeof import("../../core/featuredCase")>();
  return {
    ...actual,
    prepareFeaturedCase: (...args: unknown[]) => prepareFeaturedCase(...args),
    confirmFeaturedCaseOpen: (...args: unknown[]) => confirmFeaturedCaseOpen(...args),
    submitFeaturedCase: (...args: unknown[]) => submitFeaturedCase(...args)
  };
});

vi.mock("../../core/metrics", () => ({
  shouldShowMetricReferences: () => false
}));

vi.mock("../practice/ActivePracticeCase", () => ({
  ActivePracticeCase: (props: Record<string, unknown>) => {
    latestActivePracticeCaseProps = props;
    return <div data-testid="active-featured-case" />;
  }
}));

vi.mock("../practice/ResultsSummaryCard", () => ({
  ResultsSummaryHeader: (props: Record<string, unknown>) => {
    latestResultsSummaryHeaderProps = props;
    return <div data-testid="featured-summary-header" />;
  },
  ResultsSummaryCard: (props: Record<string, unknown>) => {
    latestResultsSummaryCardProps = props;
    return <div data-testid="featured-summary-card" />;
  }
}));

import { FeaturedCaseScreen } from "./FeaturedCaseScreen";

function makeCase(overrides: Partial<CaseData> = {}): CaseData {
  return {
    case_id: "AUTHORED_001",
    source_type: "authored",
    clinical_stem: "A patient with a layered acid-base disorder.",
    difficulty_level: 4,
    difficulty_label: "master",
    protected_payload_mode: "practice_learning",
    inputs: {
      gas: {
        ph: 7.2,
        paco2_mmHg: 22,
        hco3_mmolL: 12
      },
      electrolytes: {
        na_mmolL: 132,
        cl_mmolL: 95
      }
    },
    questions_flow: [
      {
        key: "ph_status",
        label: "pH status",
        prompt: "What is the pH status?",
        options: ["Acidaemia", "Alkalaemia", "Normal"]
      },
      {
        key: "compensation",
        label: "Compensation",
        prompt: "Is compensation appropriate?",
        options: ["Appropriate", "Inappropriate"]
      },
      {
        key: "anion_gap",
        label: "Anion gap",
        prompt: "What is the anion gap?",
        options: ["Raised", "Normal"]
      },
      {
        key: "final_diagnosis",
        label: "Diagnosis",
        prompt: "What is the diagnosis?",
        options: ["DKA with respiratory acidosis", "Simple DKA"]
      },
      {
        key: "acid_base_processes",
        label: "Acid-base processes",
        prompt: "Select all present processes.",
        options: ["Metabolic acidosis", "Respiratory acidosis", "Metabolic alkalosis"],
        selection_mode: "multi"
      }
    ],
    answer_key: {
      ph_status: "Acidaemia",
      compensation: "Appropriate",
      anion_gap: "Raised",
      final_diagnosis: "DKA with respiratory acidosis",
      acid_base_processes: ["Metabolic acidosis", "Respiratory acidosis"]
    },
    step_feedback: {
      ph_status: {
        key: "ph_status",
        title: "pH status",
        body: "A pH of 7.20 is acidotic. Further detail.",
        order: 1
      }
    },
    ...overrides
  };
}

function makeSummary(caseItem: CaseData, overrides: Partial<CaseSummary> = {}): CaseSummary {
  return {
    caseId: caseItem.case_id,
    title: "Featured test case",
    difficulty: caseItem.difficulty_label ?? "master",
    explanation: { overview: "Explanation", sections: [] },
    learningObjective: "Interpret the whole case.",
    elapsedSeconds: 30,
    accuracy: 80,
    correctSteps: 4,
    totalSteps: 5,
    totalXpAward: 0,
    baseXp: 0,
    perfectBonus: 0,
    speedBonus: 0,
    level: 1,
    stepResults: [],
    caseData: caseItem,
    ...overrides
  };
}

describe("FeaturedCaseScreen grading parity", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    latestActivePracticeCaseProps = null;
    latestResultsSummaryHeaderProps = null;
    latestResultsSummaryCardProps = null;
    prepareFeaturedCase.mockReset();
    confirmFeaturedCaseOpen.mockReset();
    submitFeaturedCase.mockReset();
    confirmFeaturedCaseOpen.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderFeatured(caseItem: CaseData) {
    prepareFeaturedCase.mockResolvedValue({
      releaseId: "featured-authored-001-r1",
      slot: {
        caseToken: "featured-token-1",
        issuedAt: "2026-07-20T00:00:00.000Z",
        expiresAt: "2026-07-20T01:00:00.000Z",
        contentVersion: "test-content",
        difficultyKey: caseItem.difficulty_label ?? "master",
        caseData: caseItem
      }
    });
    submitFeaturedCase.mockResolvedValue({
      summary: makeSummary(caseItem),
      attemptId: "attempt-1",
      canonicalAttemptId: "attempt-1",
      isCanonical: true
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <FeaturedCaseScreen />
        </MemoryRouter>
      );
    });
    await act(async () => {});
  }

  function activeProps() {
    expect(latestActivePracticeCaseProps).not.toBeNull();
    return latestActivePracticeCaseProps as {
      caseItem: CaseData;
      questions: NonNullable<CaseData["questions_flow"]>;
      currentStepIndex: number;
      currentResult: StepResult | null;
      selectedAnswers: AnswerSelection[];
      stepResults: StepResult[];
      onAnswer: (option: string) => void;
      onContinueStep: () => void;
    };
  }

  it("marks pH 7.20 plus Acidaemia correct and preserves parity through submission", async () => {
    const caseItem = makeCase();
    await renderFeatured(caseItem);

    act(() => activeProps().onAnswer("Acidaemia"));
    expect(activeProps().currentStepIndex).toBe(1);
    expect(getQuestionFlowStepStatus({
      caseItem,
      stepKey: "ph_status",
      stepSelection: activeProps().selectedAnswers[0]
    })).toBe("correct");

    act(() => activeProps().onAnswer("Appropriate"));
    expect(activeProps().currentStepIndex).toBe(2);
    expect(getQuestionFlowStepStatus({
      caseItem,
      stepKey: "compensation",
      stepSelection: activeProps().selectedAnswers[1]
    })).toBe("correct");

    act(() => activeProps().onAnswer("Raised"));
    expect(activeProps().currentStepIndex).toBe(3);
    expect(getQuestionFlowStepStatus({
      caseItem,
      stepKey: "anion_gap",
      stepSelection: activeProps().selectedAnswers[2]
    })).toBe("correct");

    act(() => activeProps().onAnswer("DKA with respiratory acidosis"));
    expect(activeProps().currentStepIndex).toBe(4);

    act(() => activeProps().onAnswer("Metabolic acidosis"));
    act(() => activeProps().onAnswer("Respiratory acidosis"));
    expect(activeProps().selectedAnswers[4]?.chosen).toEqual([
      "Metabolic acidosis",
      "Respiratory acidosis"
    ]);

    await act(async () => {
      activeProps().onContinueStep();
    });

    expect(submitFeaturedCase).toHaveBeenCalledTimes(1);
    const submission = submitFeaturedCase.mock.calls[0][2] as {
      answers: Array<{ key: string; chosen: string | string[] }>;
    };
    expect(submission.answers.map(answer => answer.key)).toEqual([
      "ph_status",
      "compensation",
      "anion_gap",
      "final_diagnosis",
      "acid_base_processes"
    ]);
    expect(new Set(submission.answers.map(answer => answer.key)).size).toBe(5);
    expect(latestResultsSummaryHeaderProps?.summary).toEqual(makeSummary(caseItem));
    expect(latestResultsSummaryCardProps?.summary).toEqual(makeSummary(caseItem));
  });

  it("locks an incorrect Master answer, marks it red, and shows the correction before advancing", async () => {
    const caseItem = makeCase();
    await renderFeatured(caseItem);

    act(() => activeProps().onAnswer("Alkalaemia"));

    expect(activeProps().currentStepIndex).toBe(0);
    expect(activeProps().currentResult).toMatchObject({
      chosen: "Alkalaemia",
      correctAnswer: "Acidaemia",
      correct: false
    });
    expect(getQuestionFlowStepStatus({
      caseItem,
      stepKey: "ph_status",
      stepResult: activeProps().currentResult
    })).toBe("incorrect");

    act(() => activeProps().onContinueStep());
    expect(activeProps().currentStepIndex).toBe(1);
  });

  it("waits for explicit submission after a correct final Master single answer", async () => {
    const caseItem = makeCase({
      questions_flow: [{
        key: "ph_status",
        label: "pH status",
        prompt: "What is the pH status?",
        options: ["Acidaemia", "Alkalaemia", "Normal"]
      }],
      answer_key: {
        ph_status: "Acidaemia"
      }
    });
    await renderFeatured(caseItem);

    act(() => activeProps().onAnswer("Acidaemia"));

    expect(submitFeaturedCase).not.toHaveBeenCalled();
    expect(activeProps().currentResult).toBeNull();
    expect(activeProps().selectedAnswers[0]?.chosen).toBe("Acidaemia");

    await act(async () => {
      activeProps().onContinueStep();
    });
    expect(submitFeaturedCase).toHaveBeenCalledTimes(1);
  });

  it("uses normal Master multi-select comparison and correction behavior", async () => {
    const caseItem = makeCase({
      questions_flow: [{
        key: "acid_base_processes",
        label: "Acid-base processes",
        prompt: "Select all present processes.",
        options: ["Metabolic acidosis", "Respiratory acidosis", "Metabolic alkalosis"],
        selection_mode: "multi"
      }],
      answer_key: {
        acid_base_processes: ["Metabolic acidosis", "Respiratory acidosis"]
      }
    });
    await renderFeatured(caseItem);

    act(() => activeProps().onAnswer("Metabolic acidosis"));
    act(() => activeProps().onContinueStep());

    expect(submitFeaturedCase).not.toHaveBeenCalled();
    expect(activeProps().currentResult).toMatchObject({
      chosen: ["Metabolic acidosis"],
      correctAnswer: ["Metabolic acidosis", "Respiratory acidosis"],
      correct: false
    });
  });

  it("shows Beginner-Advanced inline feedback before Continue submits the final answer", async () => {
    const caseItem = makeCase({
      difficulty_level: 2,
      difficulty_label: "intermediate",
      questions_flow: [{
        key: "ph_status",
        label: "pH status",
        prompt: "What is the pH status?",
        options: ["Acidaemia", "Alkalaemia", "Normal"]
      }],
      answer_key: {
        ph_status: "Acidaemia"
      }
    });
    await renderFeatured(caseItem);

    act(() => activeProps().onAnswer("Acidaemia"));

    expect(submitFeaturedCase).not.toHaveBeenCalled();
    expect(activeProps().currentStepIndex).toBe(0);
    expect(activeProps().currentResult).toMatchObject({
      chosen: "Acidaemia",
      correctAnswer: "Acidaemia",
      correct: true,
      feedback: {
        title: "pH status",
        body: "A pH of 7.20 is acidotic."
      }
    });

    await act(async () => {
      activeProps().onContinueStep();
    });
    expect(submitFeaturedCase).toHaveBeenCalledTimes(1);
  });

  it("restores a parity-format draft including locked step results", async () => {
    const caseItem = makeCase();
    window.localStorage.setItem(FEATURED_CASE_DRAFT_STORAGE_KEY, JSON.stringify({
      version: FEATURED_CASE_DRAFT_VERSION,
      userId: "user-1",
      releaseId: "featured-authored-001-r1",
      caseToken: "featured-token-1",
      currentStepIndex: 0,
      selectedAnswers: [{
        key: "ph_status",
        label: "pH status",
        chosen: "Alkalaemia"
      }],
      stepResults: [{
        key: "ph_status",
        label: "pH status",
        chosen: "Alkalaemia",
        correctAnswer: "Acidaemia",
        correct: false
      }],
      savedAt: "2026-07-20T00:00:00.000Z"
    }));

    await renderFeatured(caseItem);

    expect(activeProps().currentStepIndex).toBe(0);
    expect(activeProps().currentResult).toMatchObject({
      chosen: "Alkalaemia",
      correctAnswer: "Acidaemia",
      correct: false
    });
  });
});
