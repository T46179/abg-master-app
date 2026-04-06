// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsSummaryCard } from "./ResultsSummaryCard";
import type { CaseData, CaseSummary } from "../../core/types";

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

  it("renders the diagnosis and detailed explanation in the requested order", () => {
    const summary = buildSummary([
      { key: "anion_gap", title: "Anion Gap", body: "Raised anion gap explanation.", order: 1 },
      { key: "compensation", title: "Compensation", body: "Compensation explanation.", order: 2 },
      { key: "diagnosis", title: "Diagnosis", body: "Diagnosis significance.", order: 3 }
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

    expect(container.textContent).toContain("You scored 80% and earned 25 XP.");
    expect(container.textContent).toContain("62.0s");
    expect(container.textContent).toContain("Diagnosis");
    expect(container.textContent).toContain("Mixed disorder");
    expect(container.textContent).toContain("HAGMA + metabolic alkalosis (DKA + vomiting)");
    expect(container.textContent).toContain("Detailed Explanation");
    expect(container.textContent).toContain("Anion Gap Analysis");
    expect(container.textContent).toContain("Raised anion gap explanation.");
    expect(container.textContent).toContain("Compensation");
    expect(container.textContent).toContain("Compensation explanation.");
    expect(container.textContent).toContain("Clinical Significance");
    expect(container.textContent).toContain("Diagnosis significance.");
    expect(container.textContent).toContain("Key Takeaway");
    expect(container.textContent).toContain("Answer review");
    expect(container.textContent).toContain("pH status");
    expect(container.textContent).toContain("You chose Acidaemia. Correct answer: Acidaemia.");
    expect(container.textContent).toContain("Final diagnosis");
    expect(container.textContent).toContain("You chose Wrong answer. Correct answer: Correct answer.");

    const headings = Array.from(container.querySelectorAll("h3, h4")).map(node => node.textContent);
    expect(headings).toEqual([
      "Diagnosis",
      "Detailed Explanation",
      "Anion Gap Analysis",
      "Compensation",
      "Clinical Significance",
      "Key Takeaway"
    ]);
  });

  it("renders unknown fallback and empty placeholders when mapping or sections are missing", () => {
    const summary = {
      ...buildSummary([]),
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

    const detailCards = Array.from(container.querySelectorAll(".results-card__detail-card"));
    expect(detailCards).toHaveLength(3);
    for (const detailCard of detailCards) {
      const paragraphs = detailCard.querySelectorAll("p");
      expect(paragraphs).toHaveLength(0);
    }
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
});
