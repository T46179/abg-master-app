// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InsightsReadyViewModel, InsightsViewModel } from "../../core/insights";
import { ResultsPatternTip } from "./ResultsPatternTip";

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

const readyViewModel: InsightsReadyViewModel = {
  viewModelVersion: 1,
  state: "ready",
  currentLevelLabel: "Beginner",
  recentAccuracy: { valuePercent: 60, correctSteps: 3, totalSteps: 5, windowSize: 5, enoughData: true },
  accuracyTrend: { recentPercent: 60, previousPercent: null, deltaPercent: null, direction: "stable", recentWindowSize: 5, previousWindowSize: 0 },
  reasoningStepAccuracy: [],
  currentFocus: { state: "insufficient_data" },
  commonMissPattern: {
    state: "available",
    stepKey: "compensation",
    stepLabel: "Compensation",
    contextKey: "respiratory_cases",
    contextLabel: "respiratory cases",
    headline: "You seem more likely to miss compensation on respiratory cases.",
    tip: "In respiratory cases, first decide whether the process is acute or chronic before checking the expected bicarbonate response."
  },
  clinicalPatternCoverage: { encounteredCount: 0, totalCount: null, coveragePercent: null, encounteredPatterns: [] },
  difficultyProgress: [],
  unlockReadiness: { state: "not_applicable" },
  recentCaseReview: [],
  primaryCtas: []
};

describe("ResultsPatternTip", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockInsights.viewModel = readyViewModel;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps a dismissed pattern hidden across later Results renders", () => {
    const patternKey = "compensation::respiratory_cases";
    const onDismiss = vi.fn();

    act(() => root.render(<ResultsPatternTip dismissedPatternKey={null} onDismiss={onDismiss} />));

    expect(container.textContent).toContain("Pattern Detected");
    expect(container.textContent).toContain("You seem more likely to miss compensation on respiratory cases.");
    expect(container.textContent).toContain("Tip: In respiratory cases, first decide whether the process is acute or chronic before checking the expected bicarbonate response.");
    expect(container.textContent).toContain("In respiratory cases, first decide whether the process is acute or chronic before checking the expected bicarbonate response.");

    act(() => container.querySelector<HTMLButtonElement>("button[aria-label='Dismiss pattern tip']")?.click());

    expect(onDismiss).toHaveBeenCalledWith(patternKey);

    act(() => root.render(<ResultsPatternTip dismissedPatternKey={patternKey} onDismiss={onDismiss} />));

    expect(container.querySelector("[aria-label='Pattern tip']")).toBeNull();
  });

  it("shows a newly detected pattern after a different pattern was dismissed", () => {
    act(() => root.render(
      <ResultsPatternTip
        dismissedPatternKey="compensation::metabolic_acidosis_cases"
        onDismiss={vi.fn()}
      />
    ));

    expect(container.querySelector("[aria-label='Pattern tip']")).not.toBeNull();
  });

  it("renders nothing when the shared detector does not qualify", () => {
    mockInsights.viewModel = {
      ...readyViewModel,
      commonMissPattern: { state: "insufficient_data" }
    };

    act(() => root.render(<ResultsPatternTip dismissedPatternKey={null} onDismiss={vi.fn()} />));

    expect(container.textContent).toBe("");
  });
});
