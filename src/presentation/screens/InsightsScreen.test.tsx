// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InsightsViewModel } from "../../core/insights";
import { InsightsScreen } from "./InsightsScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockInsights = vi.hoisted(() => ({
  viewModel: null as InsightsViewModel | null
}));

vi.mock("../../app/useInsightsData", () => ({
  useInsightsData: () => {
    if (!mockInsights.viewModel) throw new Error("Missing insights test view model");
    return mockInsights.viewModel;
  }
}));

vi.mock("../layout/AppFooter", () => ({
  AppFooter: () => <footer data-testid="app-footer">Footer</footer>
}));

const lockedViewModel: InsightsViewModel = {
  viewModelVersion: 1,
  state: "locked",
  currentLevelLabel: "Beginner",
  casesCompleted: 3,
  casesRequired: 5,
  casesRemaining: 2,
  practiceHref: "/practice"
};

const readyViewModel: InsightsViewModel = {
  viewModelVersion: 1,
  state: "ready",
  currentLevelLabel: "Advanced",
  recentAccuracy: {
    valuePercent: 54,
    correctSteps: 38,
    totalSteps: 50,
    windowSize: 10,
    enoughData: true
  },
  accuracyTrend: {
    recentPercent: 54,
    previousPercent: 90,
    deltaPercent: -36,
    direction: "declining",
    recentWindowSize: 10,
    previousWindowSize: 10
  },
  reasoningStepAccuracy: [
    { stepKey: "pH", label: "pH", correct: 5, attempts: 5, accuracyPercent: 100, enoughData: true },
    { stepKey: "compensation", label: "Compensation", correct: 2, attempts: 5, accuracyPercent: 40, enoughData: true },
    {
      stepKey: "additional_metabolic_process",
      label: "Additional Metabolic Process",
      correct: 0,
      attempts: 1,
      accuracyPercent: 0,
      enoughData: false
    }
  ],
  currentFocus: {
    state: "available",
    stepKey: "compensation",
    label: "Compensation",
    accuracyPercent: 40,
    attempts: 5,
    explanation: "Focus on deciding whether the respiratory or metabolic response fits the expected pattern."
  },
  commonMissPattern: {
    state: "available",
    stepKey: "compensation",
    stepLabel: "Compensation",
    contextKey: "metabolic_acidosis_cases",
    contextLabel: "metabolic acidosis cases",
    missCount: 3,
    sampleSize: 5,
    missRatePercent: 60,
    headline: "You seem more likely to miss compensation when completing metabolic acidosis cases.",
    detail: "You answered this incorrectly 3 out of 5 times (60%) in this context."
  },
  clinicalPatternCoverage: {
    encounteredCount: 1,
    totalCount: null,
    coveragePercent: null,
    encounteredPatterns: [{ key: "pattern-1", label: "DKA", attempts: 2 }]
  },
  difficultyProgress: [
    {
      difficulty: "Beginner",
      completedCount: 5,
      recentAccuracyPercent: 54,
      allTimeAccuracyPercent: 72,
      enoughData: true
    }
  ],
  unlockReadiness: {
    state: "available",
    nextDifficulty: "Intermediate",
    currentPercent: 54,
    requiredPercent: 75,
    eligibleAttemptsUsed: 5,
    requiredAttempts: 5,
    status: "ready"
  },
  recentCaseReview: [
    {
      caseId: "case-1",
      completedAt: new Date().toISOString(),
      difficulty: "Beginner",
      accuracyPercent: 80,
      correctSteps: 4,
      totalSteps: 5,
      missedSteps: [{ stepKey: "compensation", label: "Compensation" }],
      clinicalPatternLabel: "DKA",
      caseMetadata: {
        source_type: "authored",
        case_features: ["true_abg", "oxygenation_focus"]
      },
      canReview: false
    }
  ],
  primaryCtas: [
    { label: "Continue practice", href: "/practice", kind: "practice" },
    { label: "Open learning module", href: "/learn", kind: "learn" },
    { label: "Back to dashboard", href: "/dashboard", kind: "dashboard" }
  ]
};

describe("InsightsScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    mockInsights.viewModel = null;
  });

  function renderWithViewModel(viewModel: InsightsViewModel) {
    mockInsights.viewModel = viewModel;
    act(() => {
      root.render(
        <MemoryRouter>
          <InsightsScreen />
        </MemoryRouter>
      );
    });
  }

  it("renders the locked state with remaining count and practice CTA", () => {
    renderWithViewModel(lockedViewModel);

    expect(container.querySelector("h1")?.textContent).toBe("Beginner");
    expect(container.textContent).toContain("2 more cases to unlock your insights");
    expect(container.textContent).toContain("Continue practice");
    expect(container.querySelector<HTMLAnchorElement>("a[href='/practice']")).not.toBeNull();
    expect(container.querySelector(".insights-locked-card__cta svg")).toBeNull();
    expect(container.querySelector(".insights-locked-card__cta-arrow")).not.toBeNull();
    expect(container.querySelector(".insights-locked-ring__lock-icon")).not.toBeNull();
  });

  it("renders the ready metric sections without the Figma preview toggle", () => {
    renderWithViewModel(readyViewModel);

    expect(container.querySelector("h1")?.textContent).toBe("Advanced");
    expect(container.textContent).toContain("Recent performance");
    expect(container.textContent).toContain("Accuracy by Step");
    expect(container.textContent).not.toContain("Additional Metabolic Process");
    expect(container.textContent).toContain("Current focus");
    expect(container.textContent).toContain("based on 5 answers");
    expect(container.textContent).toContain("Focus on deciding whether the respiratory or metabolic response fits the expected pattern.");
    expect(container.querySelector<HTMLAnchorElement>("a[href='/learn/intermediate?mode=review']")?.textContent).toContain("Review Compensation");
    expect(container.textContent).toContain("Pattern detected");
    expect(container.textContent).toContain("You seem more likely to miss compensation when completing metabolic acidosis cases.");
    expect(container.textContent).toContain("You answered this incorrectly 3 out of 5 times (60%) in this context.");
    expect((container.textContent ?? "").indexOf("Pattern detected")).toBeLessThan((container.textContent ?? "").indexOf("Accuracy by Step"));
    expect(container.textContent).toContain("Case Coverage");
    expect(container.textContent).toContain("Progress by Difficulty");
    expect(container.textContent).toContain("Recent 54% · Overall 72%");
    expect(container.textContent).not.toContain("all time");
    expect(container.textContent).toContain("Recent Cases");
    expect(container.textContent).not.toContain("Next tier");
    expect(container.textContent).not.toContain("Almost there");
    expect(container.textContent).not.toContain("recent attempts");
    expect(container.textContent).not.toContain("move the needle");
    expect(container.textContent).not.toContain("reasoning steps correct - vs. previous");
    expect(container.textContent).not.toContain("Ready preview");
    expect(container.textContent).not.toContain("Locked preview");
    expect(container.textContent).not.toContain("Open learning module");
    expect(container.textContent).not.toContain("Back to dashboard");
  });

  it("hides the pattern detected card when no pattern qualifies", () => {
    renderWithViewModel({
      ...readyViewModel,
      commonMissPattern: { state: "none" }
    });

    expect(container.textContent).not.toContain("Pattern detected");
    expect(container.textContent).not.toContain("No recurring patterns detected yet.");
    expect(container.textContent).not.toContain("If ABG Master detects a consistent pattern of mistakes, it will appear here.");
    expect(container.textContent).not.toContain("No recurring miss pattern detected yet.");
  });

  it("shows only the last five recent case rows without visible case IDs", () => {
    renderWithViewModel({
      ...readyViewModel,
      recentCaseReview: Array.from({ length: 6 }, (_, index) => ({
        caseId: `SIMPLE_MET_ALK_00${index + 1}`,
        completedAt: new Date(Date.now() - index * 60000).toISOString(),
        difficulty: "Beginner",
        accuracyPercent: 80,
        correctSteps: 4,
        totalSteps: 5,
        missedSteps: [{ stepKey: "compensation", label: "Compensation" }],
        clinicalPatternLabel: `Pattern ${index + 1}`,
        canReview: false
      }))
    });

    expect(container.querySelectorAll(".insights-case-row")).toHaveLength(5);
    expect(container.textContent).toContain("Pattern 1");
    expect(container.textContent).toContain("Pattern 5");
    expect(container.textContent).not.toContain("Pattern 6");
    expect(container.textContent).not.toContain("SIMPLE_MET_ALK_001");
  });

  it("renders recent case difficulty pill before label and metadata icons", () => {
    renderWithViewModel(readyViewModel);

    const row = container.querySelector(".insights-case-row");
    const title = row?.querySelector(".insights-case-row__title");
    const difficultyPill = title?.querySelector(".insights-chip");
    const label = title?.querySelector(".insights-case-row__label");
    const metadataIcons = title?.querySelector(".case-metadata-icons");
    const time = title?.querySelector(".insights-case-row__time");
    const children = title ? Array.from(title.children) : [];

    expect(difficultyPill).not.toBeNull();
    expect(label).not.toBeNull();
    expect(metadataIcons).not.toBeNull();
    expect(time).not.toBeNull();
    expect(children.indexOf(difficultyPill as Element)).toBeLessThan(children.indexOf(label as Element));
    expect(children.indexOf(label as Element)).toBeLessThan(children.indexOf(metadataIcons as Element));
    expect(container.querySelector(".case-metadata-icon--authored")).not.toBeNull();
    expect(container.querySelector(".case-metadata-icon--oxygenation")).not.toBeNull();
    expect(container.textContent).toContain("This case has been adapted from a real-life clinical scenario");
    expect(container.textContent).toContain("This is an arterial blood gas and requires oxygenation interpretation");
  });

  it("uses the positive score style for recent case percentages over 75", () => {
    renderWithViewModel({
      ...readyViewModel,
      recentCaseReview: [
        {
          caseId: "case-strong",
          completedAt: new Date().toISOString(),
          difficulty: "Advanced",
          accuracyPercent: 80,
          correctSteps: 4,
          totalSteps: 5,
          missedSteps: [{ stepKey: "compensation", label: "Compensation" }],
          clinicalPatternLabel: "DKA",
          canReview: false
        },
        {
          caseId: "case-low",
          completedAt: new Date(Date.now() - 60000).toISOString(),
          difficulty: "Advanced",
          accuracyPercent: 75,
          correctSteps: 3,
          totalSteps: 4,
          missedSteps: [{ stepKey: "diagnosis", label: "Diagnosis" }],
          clinicalPatternLabel: "Uraemia",
          canReview: false
        }
      ]
    });

    const scores = Array.from(container.querySelectorAll(".insights-case-row__score"));

    expect(scores[0]?.classList.contains("is-correct")).toBe(true);
    expect(scores[1]?.classList.contains("is-missed")).toBe(true);
  });

  it("limits clinical pattern tags to six with an expand toggle", () => {
    renderWithViewModel({
      ...readyViewModel,
      clinicalPatternCoverage: {
        encounteredCount: 7,
        totalCount: null,
        coveragePercent: null,
        encounteredPatterns: Array.from({ length: 7 }, (_, index) => ({
          key: `pattern-${index + 1}`,
          label: `Pattern ${index + 1}`,
          attempts: index + 1
        }))
      }
    });

    expect(container.textContent).toContain("Pattern 1");
    expect(container.textContent).toContain("Pattern 6");
    expect(container.textContent).not.toContain("Pattern 7");
    expect(container.querySelector(".insights-pattern-cells")).toBeNull();

    const toggle = container.querySelector<HTMLButtonElement>(".insights-pattern-toggle");
    expect(toggle?.textContent).toContain("Expand");
    expect(toggle?.querySelector(".insights-pattern-toggle__icon.is-collapsed")).not.toBeNull();

    act(() => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Pattern 7");
    expect(container.querySelector(".insights-pattern-toggle__icon.is-expanded")).not.toBeNull();
  });

  it("renders the recent performance tooltip copy", () => {
    renderWithViewModel(readyViewModel);

    expect(container.querySelector(".insights-info-tooltip__icon")).not.toBeNull();
    expect(container.textContent).toContain("Tracks your step accuracy across your last 10 completed cases");
    expect(container.textContent).toContain("not just whether the final answer was correct");
  });

  it("renders the accuracy by step tooltip with the shared information icon pattern", () => {
    renderWithViewModel(readyViewModel);

    const trigger = container.querySelector<HTMLButtonElement>("button[aria-label='About accuracy by step']");

    expect(trigger).not.toBeNull();
    expect(trigger?.querySelector(".insights-info-tooltip__icon")).not.toBeNull();
    expect(container.textContent).toContain("across your last 50 completed cases");
    expect(container.textContent).toContain("Some steps may appear less often because not every case includes every step.");
  });

  it("renders the progress by difficulty tooltip copy", () => {
    renderWithViewModel(readyViewModel);

    expect(container.querySelector<HTMLButtonElement>("button[aria-label='About progress by difficulty']")).not.toBeNull();
    expect(container.textContent).toContain("Shows your recent step accuracy for each difficulty you have completed");
    expect(container.textContent).toContain("compared with your overall accuracy in that difficulty");
  });

  it("falls back to the current focus registry when explanation is missing from the view model", () => {
    renderWithViewModel({
      ...readyViewModel,
      currentFocus: {
        state: "available",
        stepKey: "primary_disorder",
        label: "Primary Disorder",
        accuracyPercent: 28,
        attempts: 199
      }
    });

    expect(container.textContent).toContain("This is your lowest-scoring reasoning step, based on 199 answers.");
    expect(container.textContent).toContain("Use ROME to identify the primary driver of the acid-base disorder.");
    expect(container.querySelector<HTMLAnchorElement>("a[href='/learn/beginner?mode=review']")?.textContent).toContain("Review Primary Disorder");
  });

  it("links current focus to learn when no specific module is available", () => {
    renderWithViewModel({
      ...readyViewModel,
      currentFocus: {
        state: "available",
        stepKey: "oxygenation",
        label: "Oxygenation",
        accuracyPercent: 48,
        attempts: 12
      }
    });

    expect(container.querySelector<HTMLAnchorElement>("a[href='/learn']")?.textContent).toContain("Review Oxygenation");
  });

  it("does not render current focus explanation copy without an available focus", () => {
    renderWithViewModel({
      ...readyViewModel,
      currentFocus: { state: "insufficient_data" }
    });

    expect(container.textContent).toContain("Not enough data. Keep practising.");
    expect(container.textContent).not.toContain("based on");
    expect(container.textContent).not.toContain("Focus on deciding whether");

    renderWithViewModel({
      ...readyViewModel,
      currentFocus: { state: "none" }
    });

    expect(container.textContent).toContain("Not enough data. Keep practising.");
    expect(container.textContent).not.toContain("based on");
    expect(container.textContent).not.toContain("Focus on deciding whether");
  });

  it("anchors the accuracy sparkline endpoint to the current recent accuracy", () => {
    renderWithViewModel(readyViewModel);

    const endpoint = container.querySelector<SVGCircleElement>(".insights-sparkline__endpoint");

    expect(Number(endpoint?.getAttribute("cy"))).toBeCloseTo(76.67, 2);
  });

  it("renders a baseline state before the recent performance window is full", () => {
    renderWithViewModel({
      ...readyViewModel,
      recentAccuracy: {
        ...readyViewModel.recentAccuracy,
        valuePercent: 77,
        windowSize: 7
      },
      accuracyTrend: {
        ...readyViewModel.accuracyTrend,
        previousPercent: null,
        deltaPercent: null,
        direction: "insufficient_data"
      }
    });

    expect(container.textContent).toContain("Building baseline");
    expect(container.textContent).toContain("Based on 7 completed cases. Complete 3 more to fill your recent window.");
    expect(container.querySelector(".insights-sparkline__line--baseline")).not.toBeNull();
    expect(container.querySelector(".insights-sparkline__endpoint")).toBeNull();
  });

  it("renders unavailable states with non-misleading copy", () => {
    renderWithViewModel({
      viewModelVersion: 1,
      state: "unavailable",
      messageKey: "insights.supabase_unavailable",
      practiceHref: "/practice",
      dashboardHref: "/dashboard"
    });

    expect(container.textContent).toContain("Insights are unavailable while cloud sync is offline.");
    expect(container.textContent).toContain("Continue practice");
    expect(container.textContent).toContain("Back to dashboard");
  });

  it("uses display-safe clinical pattern labels without raw archetype terminology", () => {
    renderWithViewModel(readyViewModel);

    expect(container.textContent).toContain("DKA");
    expect(container.textContent).not.toContain("dka_vomiting");
    expect(container.textContent).not.toContain("archetype");
  });
});
