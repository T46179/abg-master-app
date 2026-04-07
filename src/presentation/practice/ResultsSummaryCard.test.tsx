// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsSummaryCard, ResultsSummaryHeader } from "./ResultsSummaryCard";
import type { CaseData, CaseSummary, ResultsExplanationPreferences, StorageAdapter } from "../../core/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function buildCaseItem(archetype?: string): CaseData {
  return {
    case_id: "case-1",
    title: "Test case",
    archetype,
    difficulty_level: 3,
    inputs: {
      gas: {
        ph: 7.12,
        paco2_mmHg: 28,
        hco3_mmolL: 9
      },
      electrolytes: {
        na_mmolL: 140,
        cl_mmolL: 100
      }
    }
  };
}

function buildSummary(sections: CaseSummary["explanation"]["sections"]): CaseSummary {
  return {
    caseId: "case-1",
    title: "Test case",
    difficulty: "advanced",
    explanation: {
      overview: "Overview text.",
      sections
    },
    learningObjective: "Learning objective",
    elapsedSeconds: 62,
    accuracy: 80,
    correctSteps: 4,
    totalSteps: 5,
    totalXpAward: 25,
    baseXp: 25,
    perfectBonus: 0,
    speedBonus: 0,
    level: 3,
    stepResults: [
      {
        key: "ph_status",
        label: "pH status",
        chosen: "Acidaemia",
        correctAnswer: "Acidaemia",
        correct: true
      },
      {
        key: "diagnosis",
        label: "Final diagnosis",
        chosen: "Wrong answer",
        correctAnswer: "Correct answer",
        correct: false
      }
    ],
    caseData: buildCaseItem("dka")
  };
}

function createStorageAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    init: vi.fn(async () => undefined),
    loadUserState: vi.fn(async () => null),
    saveUserState: vi.fn(async () => undefined),
    resetUserState: vi.fn(async () => undefined),
    saveAttempt: vi.fn(async () => undefined),
    loadSeenCaseState: vi.fn(() => ({})),
    saveSeenCaseState: vi.fn(),
    loadPracticeIntroSeen: vi.fn(() => false),
    savePracticeIntroSeen: vi.fn(),
    loadAdvancedRangesPreference: vi.fn(() => false),
    saveAdvancedRangesPreference: vi.fn(),
    loadResultsExplanationPreferences: vi.fn(() => ({
      compensation: true,
      anion_gap: true,
      clinical_context: true
    })),
    saveResultsExplanationPreferences: vi.fn(),
    ...overrides
  };
}

describe("ResultsSummaryCard", () => {
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
    vi.restoreAllMocks();
  });

  it("renders explanation cards from sorted sections and suppresses diagnosis when clinical context exists", () => {
    const summary = buildSummary([
      { key: "key_takeaway", title: "Key Takeaway", body: "Takeaway body.", order: 999 },
      { key: "diagnosis", title: "Diagnosis", body: "Diagnosis significance.", order: 3 },
      { key: "anion_gap", title: "Duplicate gap", body: "Should not render.", order: 4 },
      { key: "clinical_context", title: "Clinical Significance", body: "Clinical significance body.", order: 3 },
      { key: "compensation", title: "Compensation", body: "Compensation explanation.", order: 1 },
      { key: "anion_gap", title: "Anion Gap Analysis", body: "Raised anion gap explanation.", order: 2 }
    ]);

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("dka_vomiting")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Mixed Disorder");
    expect(container.textContent).toContain("HAGMA + Metabolic Alkalosis (DKA + Vomiting)");
    expect(container.textContent).toContain("Detailed Explanations");
    expect(container.textContent).toContain("Compensation");
    expect(container.textContent).toContain("Compensation explanation.");
    expect(container.textContent).toContain("Key Takeaway");
    expect(container.textContent).toContain("Takeaway body.");
    expect(container.textContent).toContain("Anion Gap Analysis");
    expect(container.textContent).toContain("Raised anion gap explanation.");
    expect(container.textContent).toContain("Clinical Significance");
    expect(container.textContent).toContain("Clinical significance body.");
    expect(container.textContent).not.toContain("Diagnosis significance.");
    expect(container.textContent).not.toContain("Should not render.");
    expect(container.textContent).toContain("62.0s");
    expect(container.textContent).toContain("Answer review");
    expect(container.textContent).toContain("pH status");
    expect(container.textContent).toContain("You chose Acidaemia. Correct answer: Acidaemia.");
    expect(container.textContent).toContain("Final diagnosis");
    expect(container.textContent).toContain("You chose Wrong answer. Correct answer: Correct answer.");

    const headings = Array.from(container.querySelectorAll("h3, h4")).map(node => node.textContent);
    expect(headings).toEqual([
      "Detailed Explanations",
      "Compensation",
      "Anion Gap Analysis",
      "Clinical Significance",
      "Key Takeaway"
    ]);

    const toggles = Array.from(container.querySelectorAll(".results-card__detail-toggle")).map(node => node.textContent);
    expect(toggles).toEqual(["-", "-", "-"]);
  });

  it("falls back to diagnosis when clinical context is absent", () => {
    const summary = buildSummary([
      { key: "diagnosis", title: "Diagnosis", body: "Diagnosis significance.", order: 3 }
    ]);

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("dka")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    const headings = Array.from(container.querySelectorAll(".results-card__detail-card h4")).map(node => node.textContent);
    expect(headings).toEqual(["Diagnosis"]);
    expect(container.textContent).toContain("Diagnosis significance.");
  });

  it("renders unknown fallback and omits empty explanation cards when sections are missing", () => {
    const summary = {
      ...buildSummary([
        { key: "compensation", title: "Compensation", body: "   ", order: 1 }
      ]),
      stepResults: []
    };

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("unmapped_archetype")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Unknown");
    expect(container.textContent).not.toContain("Diabetic ketoacidosis");
    expect(container.textContent).not.toContain("Detailed Explanations");
    expect(container.querySelectorAll(".results-card__detail-card")).toHaveLength(0);
  });

  it("collapses only the targeted explanation card body and persists the setting", () => {
    const preferences: ResultsExplanationPreferences = {
      compensation: true,
      anion_gap: true,
      clinical_context: true
    };
    const storage = createStorageAdapter({
      loadResultsExplanationPreferences: vi.fn(() => ({ ...preferences })),
      saveResultsExplanationPreferences: vi.fn((nextValue: ResultsExplanationPreferences) => {
        Object.assign(preferences, nextValue);
      })
    });
    const summary = buildSummary([
      { key: "compensation", title: "Compensation", body: "Compensation explanation.", order: 1 },
      { key: "anion_gap", title: "Anion Gap Analysis", body: "Raised anion gap explanation.", order: 2 },
      { key: "clinical_context", title: "Clinical Significance", body: "Clinical significance body.", order: 3 },
      { key: "key_takeaway", title: "Key Takeaway", body: "Takeaway body.", order: 999 }
    ]);

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("dka")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
          storage={storage}
        />
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>(".results-card__detail-toggle");
    expect(toggle?.textContent).toBe("-");
    expect(container.textContent).toContain("Compensation explanation.");

    act(() => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Compensation explanation.");
    expect(container.textContent).toContain("Raised anion gap explanation.");
    expect(container.textContent).toContain("Clinical significance body.");
    expect(container.textContent).toContain("Takeaway body.");
    expect(toggle?.textContent).toBe("+");
    expect(storage.saveResultsExplanationPreferences).toHaveBeenCalledWith({
      compensation: false,
      anion_gap: true,
      clinical_context: true
    });

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("dka")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
          storage={storage}
        />
      );
    });

    expect(container.textContent).not.toContain("Compensation explanation.");
    expect(container.textContent).toContain("Takeaway body.");
  });

  it("keeps key takeaway always expanded with no toggle", () => {
    const summary = buildSummary([
      { key: "key_takeaway", title: "Key Takeaway", body: "Takeaway body.", order: 999 }
    ]);

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("dka")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Takeaway body.");
    expect(container.querySelector(".results-card__detail-toggle")).toBeNull();
  });

  it("omits the secondary diagnosis line when the mapping sub label is empty", () => {
    const summary = buildSummary([
      { key: "clinical_context", title: "Clinical Context", body: "Clinical context body.", order: 1 }
    ]);

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("simple_nagma")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("NAGMA");
    expect(container.textContent).not.toContain("Diarrhoea");
  });

  it("renders the combined summary header with the XP progress bar", () => {
    const summary = buildSummary([]);

    act(() => {
      root.render(
        <ResultsSummaryHeader
          summary={summary}
          level={21}
          xpProgressLabel="120 / 200 XP"
          progressValue={60}
        />
      );
    });

    expect(container.textContent).toContain("Case complete");
    expect(container.textContent).toContain("You scored 80% and earned 25 XP.");
    expect(container.textContent).not.toContain("62.0s");
    expect(container.textContent).toContain("Level 21");
    expect(container.textContent).toContain("120 / 200 XP");
    expect(container.querySelector(".progress-bar__fill")).not.toBeNull();
  });
});
