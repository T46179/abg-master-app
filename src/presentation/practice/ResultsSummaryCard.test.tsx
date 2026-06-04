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
    clinical_stem: "A 54-year-old patient presents with progressive dyspnoea and vomiting.",
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
    loadSeenCaseState: vi.fn(() => ({})),
    saveSeenCaseState: vi.fn(),
    loadPracticeIntroSeen: vi.fn(() => false),
    savePracticeIntroSeen: vi.fn(),
    loadAppAreaVisited: vi.fn(() => false),
    saveAppAreaVisited: vi.fn(),
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
    loadCalibrationCompletion: vi.fn(() => null),
    saveCalibrationCompletion: vi.fn(),
    clearCalibrationCompletion: vi.fn(),
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
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders explanation cards from sorted sections and suppresses diagnosis when clinical context exists", () => {
    const storage = createStorageAdapter({
      loadResultsReviewExpandedPreference: vi.fn(() => true)
    });

    const summary = buildSummary([
      { key: "key_takeaway", title: "Key Takeaway", body: "Takeaway body.", order: 999 },
      { key: "diagnosis", title: "Diagnosis", body: "Diagnosis significance.", order: 3 },
      { key: "anion_gap", title: "Duplicate gap", body: "Should not render.", order: 4 },
      { key: "additional_metabolic_process", title: "Additional Metabolic Process", body: "Additional process body.", order: 0 },
      { key: "clinical_context", title: "Clinical Significance", body: "Clinical significance body.", order: 3 },
      { key: "primary_disorder", title: "Primary Disorder", body: "Primary disorder explanation.", order: 2 },
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
          storage={storage}
        />
      );
    });

    expect(container.textContent).toContain("Mixed Disorder");
    expect(container.textContent).toContain("HAGMA + Metabolic Alkalosis (DKA + Vomiting)");
    expect(container.textContent).toContain("Detailed Explanation");
    expect(container.textContent).toContain("Primary Disorder");
    expect(container.textContent).toContain("Primary disorder explanation.");
    expect(container.textContent).toContain("Additional Metabolic Process");
    expect(container.textContent).toContain("Additional process body.");
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
    expect(container.textContent).toContain("Answer Review");
    expect(container.textContent).toContain("pH status");
    expect(container.textContent).toContain("You chose: Acidaemia");
    expect(container.textContent).not.toContain("Correct answer: Acidaemia");
    expect(container.textContent).toContain("Final diagnosis");
    expect(container.textContent).toContain("You chose: Wrong answerCorrect answer: Correct answer");

    const headings = Array.from(container.querySelectorAll("h3, h4")).map(node => node.textContent);
    expect(headings).toEqual([
      "Detailed Explanation",
      "Primary Disorder",
      "Compensation",
      "Anion Gap Analysis",
      "Additional Metabolic Process",
      "Clinical Significance",
      "Key Takeaway",
      "ABG values",
      "Electrolytes & other values",
      "Clinical Scenario",
      "Answer Review"
    ]);

    const toggles = Array.from(container.querySelectorAll(".results-card__detail-toggle")).map(node => node.getAttribute("aria-label"));
    expect(toggles).toEqual([
      "Collapse Primary Disorder",
      "Collapse Compensation",
      "Collapse Anion Gap Analysis",
      "Collapse Additional Metabolic Process",
      "Collapse Clinical Significance"
    ]);
  });

  it("renders oxygenation explanation sections and oxygenation answer review labels", () => {
    const storage = createStorageAdapter({
      loadResultsReviewExpandedPreference: vi.fn(() => true)
    });
    const summary = {
      ...buildSummary([
        { key: "clinical_context", title: "Clinical Significance", body: "Clinical significance body.", order: 5 },
        { key: "aa_gradient_mechanism", title: "A-a gradient", body: "A-a body.", order: 3 },
        { key: "oxygenation_status", title: "Oxygenation", body: "Oxygenation body.", order: 1 },
        { key: "pf_ratio_interpretation", title: "P/F ratio", body: "P/F body.", order: 2 }
      ]),
      stepResults: [
        {
          key: "oxygenation_status",
          label: "Oxygenation",
          chosen: "Severe oxygenation failure",
          correctAnswer: "Severe oxygenation failure",
          correct: true
        },
        {
          key: "pf_ratio_interpretation",
          label: "P/F ratio",
          chosen: "Mild-moderate oxygenation impairment",
          correctAnswer: "Severe oxygenation failure",
          correct: false
        },
        {
          key: "aa_gradient_mechanism",
          label: "A-a gradient",
          chosen: "There is impaired oxygen transfer from alveoli to arterial blood",
          correctAnswer: "There is impaired oxygen transfer from alveoli to arterial blood",
          correct: true
        }
      ]
    };

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={{
            ...buildCaseItem("dka"),
            case_features: ["true_abg", "oxygenation_focus"],
            difficulty_level: 4,
            inputs: {
              ...buildCaseItem("dka").inputs,
              gas: {
                ...buildCaseItem("dka").inputs?.gas,
                pao2_mmHg: 78
              },
              oxygenation: {
                fio2_fraction: 1,
                spo2_percent: 92
              }
            }
          }}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
          storage={storage}
        />
      );
    });

    expect(container.textContent).toContain("Oxygenation body.");
    expect(container.textContent).toContain("P/F body.");
    expect(container.textContent).toContain("A-a body.");
    expect(container.textContent).toContain("Answer Review");
    expect(container.textContent).toContain("Oxygenation");
    expect(container.textContent).toContain("You chose: Severe oxygenation failure");
    expect(container.textContent).toContain("P/F ratio");
    expect(container.textContent).toContain("You chose: Mild-moderate oxygenation impairmentCorrect answer: Severe oxygenation failure");
    expect(container.textContent).toContain("A-a gradient");

    const headings = Array.from(container.querySelectorAll(".results-card__detail-card h4")).map(node => node.textContent);
    expect(headings).toEqual([
      "Oxygenation",
      "P/F ratio",
      "A-a gradient",
      "Clinical Significance"
    ]);
  });

  it("preserves oxygenation metric card styling in result review", () => {
    const storage = createStorageAdapter({
      loadResultsReviewExpandedPreference: vi.fn(() => true)
    });
    const summary = {
      ...buildSummary([
        { key: "clinical_context", title: "Clinical Significance", body: "Clinical significance body.", order: 1 }
      ]),
      caseData: {
        ...buildCaseItem("dka"),
        inputs: {
          ...buildCaseItem("dka").inputs,
          gas: {
            ...buildCaseItem("dka").inputs?.gas,
            pao2_mmHg: 78
          },
          oxygenation: {
            fio2_fraction: 1,
            spo2_percent: 92
          }
        }
      }
    };

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={summary.caseData}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
          storage={storage}
        />
      );
    });

    for (const label of ["FiO2", "PaO2", "SpO2"]) {
      const labelNode = Array.from(container.querySelectorAll(".metric-card__label"))
        .find(node => node.textContent === label);
      expect(labelNode?.closest(".metric-card")?.classList.contains("metric-card--oxygenation")).toBe(true);
    }

    const metricCards = Array.from(container.querySelectorAll(".metric-card"));
    expect(metricCards.filter(card => card.classList.contains("metric-card--oxygenation"))).toHaveLength(3);
    expect(metricCards.some(card => !card.classList.contains("metric-card--oxygenation"))).toBe(true);
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

  it("uses gas summary display before legacy display and archetype mappings", () => {
    const summary = buildSummary([
      { key: "clinical_context", title: "Clinical Context", body: "Clinical context body.", order: 1 }
    ]);
    const caseItem = {
      ...buildCaseItem("dka"),
      display: {
        gas_summary: {
          main: "Mixed Disorder",
          sub: "Respiratory Alkalosis + HAGMA"
        },
        diagnosis_summary: {
          main: "Triple Disorder",
          sub: "Legacy diagnosis label"
        }
      }
    };

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={caseItem}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Mixed Disorder");
    expect(container.textContent).toContain("Respiratory Alkalosis + HAGMA");
    expect(container.textContent).not.toContain("Legacy diagnosis label");
    expect(container.textContent).not.toContain("Diabetic Ketoacidosis");
  });

  it("falls through to legacy diagnosis summary when gas summary is malformed", () => {
    const summary = buildSummary([
      { key: "clinical_context", title: "Clinical Context", body: "Clinical context body.", order: 1 }
    ]);
    const caseItem = {
      ...buildCaseItem("dka"),
      display: {
        gas_summary: {
          main: "",
          sub: "Incomplete gas summary"
        },
        diagnosis_summary: {
          main: "Triple Disorder",
          sub: "Legacy diagnosis label"
        }
      }
    };

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={caseItem}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Triple Disorder");
    expect(container.textContent).toContain("Legacy diagnosis label");
    expect(container.textContent).not.toContain("Incomplete gas summary");
  });

  it("uses legacy diagnosis summary display before falling back to archetype mappings", () => {
    const summary = buildSummary([
      { key: "clinical_context", title: "Clinical Context", body: "Clinical context body.", order: 1 }
    ]);
    const caseItem = {
      ...buildCaseItem("unmapped_triple_disorder"),
      source_type: "authored" as const,
      display: {
        diagnosis_summary: {
          main: "Triple Disorder",
          sub: "HAGMA + NAGMA + Respiratory Acidosis"
        }
      }
    };

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={caseItem}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Triple Disorder");
    expect(container.textContent).toContain("HAGMA + NAGMA + Respiratory Acidosis");
    expect(container.textContent).not.toContain("Unknown");
  });

  it("collapses only the targeted explanation card body and persists the setting", () => {
    const preferences: ResultsExplanationPreferences = {
      primary_disorder: true,
      compensation: true,
      anion_gap: true,
      additional_metabolic_process: true,
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
      { key: "additional_metabolic_process", title: "Additional Metabolic Process", body: "Additional process body.", order: 3 },
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
    expect(toggle?.getAttribute("aria-label")).toBe("Collapse Compensation");
    expect(container.textContent).toContain("Compensation explanation.");

    act(() => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Compensation explanation.");
    expect(container.textContent).toContain("Raised anion gap explanation.");
    expect(container.textContent).toContain("Additional process body.");
    expect(container.textContent).toContain("Clinical significance body.");
    expect(container.textContent).toContain("Takeaway body.");
    expect(toggle?.getAttribute("aria-label")).toBe("Expand Compensation");
    expect(storage.saveResultsExplanationPreferences).toHaveBeenCalledWith({
      primary_disorder: true,
      compensation: false,
      anion_gap: true,
      additional_metabolic_process: true,
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
    expect(container.textContent).toContain("Additional process body.");
    expect(container.textContent).toContain("Takeaway body.");
  });

  it("collapses the additional metabolic process card body and persists the setting", () => {
    const preferences: ResultsExplanationPreferences = {
      primary_disorder: true,
      compensation: true,
      anion_gap: true,
      additional_metabolic_process: true,
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
      { key: "additional_metabolic_process", title: "Additional Metabolic Process", body: "Additional process body.", order: 3 },
      { key: "key_takeaway", title: "Key Takeaway", body: "Takeaway body.", order: 999 }
    ]);

    act(() => {
      root.render(
        <ResultsSummaryCard
          summary={summary}
          caseItem={buildCaseItem("salicylate_toxicity")}
          showSummaryReferences={false}
          showAbnormalHighlighting={false}
          onNextCase={() => {}}
          onOpenFeedback={() => {}}
          storage={storage}
        />
      );
    });

    const toggles = Array.from(container.querySelectorAll<HTMLButtonElement>(".results-card__detail-toggle"));
    const additionalToggle = toggles.find(button => button.getAttribute("aria-label") === "Collapse Additional Metabolic Process");
    expect(additionalToggle?.getAttribute("aria-label")).toBe("Collapse Additional Metabolic Process");
    expect(container.textContent).toContain("Additional process body.");

    act(() => {
      additionalToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Additional process body.");
    expect(container.textContent).toContain("Compensation explanation.");
    expect(container.textContent).toContain("Raised anion gap explanation.");
    expect(container.textContent).toContain("Takeaway body.");
    expect(additionalToggle?.getAttribute("aria-label")).toBe("Expand Additional Metabolic Process");
    expect(storage.saveResultsExplanationPreferences).toHaveBeenCalledWith({
      primary_disorder: true,
      compensation: true,
      anion_gap: true,
      additional_metabolic_process: false,
      clinical_context: true
    });
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

  it("collapses the review card body and relabels the header", () => {
    const reviewExpanded = { value: false };
    const storage = createStorageAdapter({
      loadResultsReviewExpandedPreference: vi.fn(() => reviewExpanded.value),
      saveResultsReviewExpandedPreference: vi.fn((nextValue: boolean) => {
        reviewExpanded.value = nextValue;
      })
    });
    const summary = buildSummary([
      { key: "clinical_context", title: "Clinical Significance", body: "Clinical significance body.", order: 1 }
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

    const reviewToggle = container.querySelector<HTMLButtonElement>(".results-review-card__toggle");
    expect(container.textContent).toContain("Review case details");
    expect(container.textContent).not.toContain("Electrolytes & other values");
    expect(container.textContent).not.toContain("Clinical Scenario");
    expect(container.textContent).not.toContain("Answer Review");

    act(() => {
      reviewToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("ABG values");
    expect(container.textContent).toContain("Electrolytes & other values");
    expect(container.textContent).toContain("Clinical Scenario");
    expect(container.textContent).toContain("A 54-year-old patient presents with progressive dyspnoea and vomiting.");
    expect(container.textContent).toContain("Answer Review");
    expect(storage.saveResultsReviewExpandedPreference).toHaveBeenCalledWith(true);
  });

  it("restores the saved review card expansion state on mount", () => {
    const storage = createStorageAdapter({
      loadResultsReviewExpandedPreference: vi.fn(() => true)
    });

    const summary = buildSummary([
      { key: "clinical_context", title: "Clinical Significance", body: "Clinical significance body.", order: 1 }
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

    expect(container.textContent).toContain("ABG values");
    expect(container.textContent).toContain("Electrolytes & other values");
    expect(container.textContent).toContain("Clinical Scenario");
    expect(container.textContent).toContain("Answer Review");
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

    expect(container.textContent).toContain("Metabolic Acidosis");
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

  it("can label the summary header as max level", () => {
    const summary = buildSummary([]);

    act(() => {
      root.render(
        <ResultsSummaryHeader
          summary={summary}
          level={20}
          levelLabel="Max Level"
          xpProgressLabel="600 / 600 XP"
          progressValue={100}
        />
      );
    });

    expect(container.textContent).toContain("Max Level");
    expect(container.textContent).not.toContain("Level 20");
    expect(container.textContent).toContain("600 / 600 XP");
  });

  it("marks the summary XP bar as blocked when readiness gates cap progress", () => {
    const summary = buildSummary([]);

    act(() => {
      root.render(
        <ResultsSummaryHeader
          summary={summary}
          level={9}
          xpProgressLabel="129 / 130 XP"
          progressValue={99}
          xpProgressBlocked
        />
      );
    });

    expect(container.querySelector(".progress-bar__fill--blocked")).not.toBeNull();
  });

  it("shows readiness gate guidance in place of the XP label", () => {
    const summary = buildSummary([]);

    act(() => {
      root.render(
        <ResultsSummaryHeader
          summary={summary}
          level={14}
          xpProgressLabel="297 / 300 XP"
          xpProgressNotice="You must reach 75% accuracy over 5 cases to progress"
          progressValue={99}
          xpProgressBlocked
        />
      );
    });

    expect(container.textContent).toContain("You must reach 75% accuracy over 5 cases to progress");
    expect(container.textContent).not.toContain("297 / 300 XP");
  });

  it("renders authored case metadata on the combined summary header", () => {
    const summary = {
      ...buildSummary([]),
      caseData: {
        ...buildCaseItem("respiratory_alkalosis_hagma"),
        source_type: "authored" as const
      }
    };

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

    expect(container.querySelector(".case-metadata-icon--authored")).not.toBeNull();
    expect(container.textContent).toContain("This case has been adapted from a real-life clinical scenario");
  });

  it("renders oxygenation metadata on the combined summary header", () => {
    const summary = {
      ...buildSummary([]),
      caseData: {
        ...buildCaseItem("respiratory_alkalosis_hagma"),
        source_type: "authored" as const,
        case_features: ["true_abg", "oxygenation_focus"]
      }
    };

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

    expect(container.querySelector(".case-metadata-icon--authored")).not.toBeNull();
    expect(container.querySelector(".case-metadata-icon--oxygenation")).not.toBeNull();
    expect(container.textContent).toContain("This is an arterial blood gas and requires oxygenation interpretation");
  });

  it("renders boosted XP metadata on the combined summary header", () => {
    const summary = buildSummary([]);

    act(() => {
      root.render(
        <ResultsSummaryHeader
          summary={summary}
          level={5}
          xpProgressLabel="20 / 60 XP"
          progressValue={33}
          boostedXp
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--boosted-xp")).not.toBeNull();
    expect(container.textContent).toContain("This case earns bonus XP");
  });
});
