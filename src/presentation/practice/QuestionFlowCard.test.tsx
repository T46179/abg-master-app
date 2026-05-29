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
  step: QuestionFlowStep = multiSelectStep
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onContinueStep = vi.fn();

  act(() => {
    root.render(
      <QuestionFlowCard
        caseItem={caseItem}
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
});
