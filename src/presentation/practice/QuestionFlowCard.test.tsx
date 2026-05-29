// @vitest-environment jsdom

import { createRef } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionFlowCard } from "./QuestionFlowCard";
import type { AnswerSelection, CaseData, QuestionFlowStep } from "../../core/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const caseItem: CaseData = {
  case_id: "master-case",
  difficulty_level: 4,
  answer_key: {
    acid_base_processes: ["Metabolic acidosis", "Respiratory alkalosis"]
  }
};

const multiSelectStep: QuestionFlowStep = {
  key: "acid_base_processes",
  label: "Acid-base processes",
  prompt: "Which acid-base process(es) are present?",
  selection_mode: "multi",
  options: [
    "Metabolic acidosis",
    "Metabolic alkalosis",
    "Respiratory acidosis",
    "Respiratory alkalosis"
  ]
};

function renderQuestionFlowCard(
  currentSelection: AnswerSelection | null,
  onAnswer = vi.fn(),
  step: QuestionFlowStep = multiSelectStep,
  caseOverride: CaseData = caseItem
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onContinueStep = vi.fn();

  act(() => {
    root.render(
      <QuestionFlowCard
        caseItem={caseOverride}
        questions={[step]}
        currentStepIndex={0}
        currentStep={step}
        currentSelection={currentSelection}
        currentResult={null}
        currentOptions={step.options ?? []}
        selectedAnswers={currentSelection ? [currentSelection] : []}
        stepResults={[]}
        onAnswer={onAnswer}
        onContinueStep={onContinueStep}
        activeStepRef={createRef<HTMLButtonElement>()}
      />
    );
  });

  return { container, root, onAnswer, onContinueStep };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("QuestionFlowCard", () => {
  it("blocks multi-select continuation until at least one option is selected", () => {
    const { container, root } = renderQuestionFlowCard(null);

    const continueButton = container.querySelector<HTMLButtonElement>(".inline-feedback__button");
    expect(continueButton?.disabled).toBe(true);

    act(() => root.unmount());
  });

  it("shows selected multi-select options and allows toggling more than one", () => {
    const onAnswer = vi.fn();
    const { container, root } = renderQuestionFlowCard({
      key: "acid_base_processes",
      label: "Acid-base processes",
      prompt: "Which acid-base process(es) are present?",
      chosen: ["Metabolic acidosis"]
    }, onAnswer);

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>(".answer-option"));
    expect(options[0]?.className).toContain("is-selected");
    expect(container.querySelector<HTMLButtonElement>(".inline-feedback__button")?.disabled).toBe(false);

    act(() => {
      options[3]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onAnswer).toHaveBeenCalledWith("Respiratory alkalosis");
    act(() => root.unmount());
  });

  it("formats metric notation in prompts and answer options without changing answer values", () => {
    const onAnswer = vi.fn();
    const oxygenationStep: QuestionFlowStep = {
      key: "oxygenation_status",
      label: "Oxygenation",
      prompt: "How should the PaO2 and FiO2 be interpreted?",
      options: [
        "Cannot assess from PaO2 alone",
        "Use SpO2 as supporting data"
      ]
    };

    const { container, root } = renderQuestionFlowCard(null, onAnswer, oxygenationStep);

    const prompt = container.querySelector(".question-flow-card__prompt");
    const firstOption = container.querySelector<HTMLButtonElement>(".answer-option");

    expect(prompt?.querySelectorAll("sub")).toHaveLength(2);
    expect(firstOption?.querySelector("sub")?.textContent).toBe("2");

    act(() => {
      firstOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onAnswer).toHaveBeenCalledWith("Cannot assess from PaO2 alone");
    act(() => root.unmount());
  });

  it("shows the A-a gradient formula popover without substituted case values", () => {
    const aaGradientStep: QuestionFlowStep = {
      key: "aa_gradient_mechanism",
      label: "A-a gradient",
      prompt: "Can the observed PaO2 be explained by hypoventilation alone?",
      options: [
        "Yes - hypoxaemia is mostly explained by reduced alveolar oxygen from hypoventilation",
        "No - there is impaired oxygen transfer from alveoli to arterial blood"
      ]
    };
    const oxygenationCase: CaseData = {
      ...caseItem,
      inputs: {
        gas: {
          paco2_mmHg: 81,
          pao2_mmHg: 78
        },
        oxygenation: {
          fio2_fraction: 1
        }
      }
    };

    const { container, root } = renderQuestionFlowCard(null, vi.fn(), aaGradientStep, oxygenationCase);
    const formulaButton = container.querySelector<HTMLButtonElement>(".question-flow-card__rule-button");

    expect(formulaButton?.getAttribute("aria-label")).toBe("Show A-a gradient formula");

    act(() => {
      formulaButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const popover = container.querySelector<HTMLElement>(".question-flow-card__rule-popover");
    expect(popover?.getAttribute("aria-label")).toBe("A-a gradient formula");
    expect(popover?.querySelector(".question-flow-card__rule-popover-label")?.textContent).toBe("formula");
    expect(Array.from(popover?.querySelectorAll("h3") ?? []).map(heading => heading.textContent)).toEqual([
      "A-a Gradient",
      "Room-air sea-level shortcut:"
    ]);
    expect(popover?.textContent).toContain("PAO2 = FiO2 × (Patmos − PH2O) − PaCO2 / 0.8");
    expect(popover?.textContent).toContain("A–a gradient = PAO2 − PaO2");
    expect(popover?.textContent).toContain("Room-air sea-level shortcut:");
    expect(popover?.textContent).toContain("PAO2 ≈ 150 − PaCO2 / 0.8");
    expect(popover?.textContent).toContain("Note:");
    expect(popover?.textContent).toContain("The shortcut and normal range are mainly for room air at sea level. Normal A–a gradient varies with age, FiO2, and atmospheric pressure.");
    expect(popover?.textContent).not.toContain("612");
    expect(popover?.textContent).not.toContain("534");

    act(() => root.unmount());
  });

  it("keeps the compensation formula popover working", () => {
    const compensationStep: QuestionFlowStep = {
      key: "compensation",
      label: "Compensation",
      prompt: "Is compensation appropriate?",
      options: ["Appropriate", "Inappropriate"]
    };
    const compensationCase: CaseData = {
      ...caseItem,
      difficulty_level: 2,
      answer_key: {
        expected_compensation: {
          rule: "Metabolic acidosis compensation"
        } as unknown as string
      }
    };

    const { container, root } = renderQuestionFlowCard(null, vi.fn(), compensationStep, compensationCase);
    const formulaButton = container.querySelector<HTMLButtonElement>(".question-flow-card__rule-button");

    expect(formulaButton?.getAttribute("aria-label")).toBe("Show compensation rule");

    act(() => {
      formulaButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const popover = container.querySelector<HTMLElement>(".question-flow-card__rule-popover");
    expect(popover?.getAttribute("aria-label")).toBe("Compensation rule");
    expect(popover?.textContent).toContain("Compensation rule");
    expect(popover?.textContent).toContain("Expected");

    act(() => root.unmount());
  });

  it("does not show a formula button for unrelated questions", () => {
    const { container, root } = renderQuestionFlowCard(null);

    expect(container.querySelector(".question-flow-card__rule-button")).toBeNull();

    act(() => root.unmount());
  });
});
