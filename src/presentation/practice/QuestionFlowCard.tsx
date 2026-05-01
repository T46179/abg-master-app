import type { RefObject } from "react";
import type { AnswerSelection, CaseData, QuestionFlowStep, StepResult } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { PillNav } from "../primitives/PillNav";
import { formatAnswerValue, getQuestionFlowStepStatus, prettyStepLabel } from "../../core/practice";
import { InlineFeedbackCard } from "./InlineFeedbackCard";
import { MetricInlineText } from "./MetricText";

interface QuestionFlowCardProps {
  caseItem: CaseData | null;
  questions: QuestionFlowStep[];
  currentStepIndex: number;
  currentStep: QuestionFlowStep | null;
  currentSelection: AnswerSelection | null;
  currentResult: StepResult | null;
  currentOptions: string[];
  selectedAnswers: AnswerSelection[];
  stepResults: StepResult[];
  onAnswer: (option: string) => void;
  onContinueStep: () => void;
  activeStepRef: RefObject<HTMLButtonElement | null>;
  interactionDisabled?: boolean;
  interactionDisabledMessage?: string | null;
  isSubmittingCase?: boolean;
}

export function QuestionFlowCard(props: QuestionFlowCardProps) {
  const isMultiSelect = props.currentStep?.selection_mode === "multi";
  const selectedValues = Array.isArray(props.currentSelection?.chosen) ? props.currentSelection.chosen : [];
  const hasMultiSelectAnswer = selectedValues.length > 0;
  const isMasterCase = Number(props.caseItem?.difficulty_level ?? 1) >= 4;
  const currentStepKey = props.currentStep?.key;
  const hasWhiteAnswerCardBorder = isMasterCase && (
    currentStepKey === "acid_base_processes" ||
    currentStepKey === "diagnosis" ||
    currentStepKey === "final_diagnosis"
  );

  function getPillLabel(step: QuestionFlowStep) {
    if (step.key === "primary_disorder" || step.key === "acid_base_processes") {
      return "Acid-base disorder";
    }

    if (step.key === "additional_metabolic_process") {
      return "Additional process";
    }

    return step.label ?? prettyStepLabel(step.key);
  }

  const items = props.questions.map((step, index) => {
    const stepResult = props.stepResults[index];
    const stepSelection = props.selectedAnswers[index];
    const status = getQuestionFlowStepStatus({
      caseItem: props.caseItem,
      stepKey: step.key,
      stepResult,
      stepSelection,
      isPastStep: index < props.currentStepIndex,
      isCurrentStep: index === props.currentStepIndex
    });

    return {
      key: `${step.key}-${index}`,
      label: `${index + 1}. ${getPillLabel(step)}`,
      active: index === props.currentStepIndex,
      status,
      buttonRef: index === props.currentStepIndex ? props.activeStepRef : undefined
    };
  });

  return (
    <Surface className={`question-flow-card${hasWhiteAnswerCardBorder ? " question-flow-card--white-answer-card-border" : ""}`}>
      <div className="question-flow-card__header">
        <PillNav items={items} className="question-flow-card__pills" />
      </div>

      <div className="question-flow-card__body">
        <p className="question-flow-card__prompt">
          {props.currentStep?.prompt ?? "Question flow unavailable for this case."}
        </p>

        {props.interactionDisabledMessage ? (
          <p className="question-flow-card__prompt">{props.interactionDisabledMessage}</p>
        ) : null}

        {!props.currentResult ? (
          isMultiSelect ? (
            <div className="inline-feedback">
              <div className="question-flow-card__options">
                {props.currentOptions.map(option => {
                  const selected = selectedValues.includes(option);
                  return (
                    <button
                      key={option}
                      className={`answer-option${selected ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => props.onAnswer(option)}
                      disabled={props.interactionDisabled}
                      aria-pressed={selected}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <button
                className="figma-button inline-feedback__button"
                type="button"
                onClick={props.onContinueStep}
                disabled={props.interactionDisabled || !hasMultiSelectAnswer}
              >
                {props.currentStepIndex >= props.questions.length - 1 && props.isSubmittingCase ? (
                  <>
                    <span className="figma-button__spinner" aria-hidden="true" />
                    <span>Submitting case</span>
                  </>
                ) : props.currentStepIndex >= props.questions.length - 1 ? (
                  "Submit Case"
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          ) : props.currentSelection ? (
            <div className="inline-feedback">
              <div className="inline-feedback__hero">
                <h3>Answer selected</h3>
              </div>

              <div className="inline-feedback__grid">
                <div className="inline-feedback__item">
                  <span className="inline-feedback__label">Your answer</span>
                  <strong><MetricInlineText text={formatAnswerValue(props.currentSelection.chosen)} /></strong>
                </div>
              </div>

              <button
                className="figma-button inline-feedback__button"
                type="button"
                onClick={props.onContinueStep}
                disabled={props.interactionDisabled}
              >
                {props.currentStepIndex >= props.questions.length - 1 && props.isSubmittingCase ? (
                  <>
                    <span className="figma-button__spinner" aria-hidden="true" />
                    <span>Submitting case</span>
                  </>
                ) : props.currentStepIndex >= props.questions.length - 1 ? (
                  "Submit Case"
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          ) : (
            <div className="question-flow-card__options">
              {props.currentOptions.map(option => (
                <button
                  key={option}
                  className="answer-option"
                  type="button"
                  onClick={() => props.onAnswer(option)}
                  disabled={props.interactionDisabled}
                >
                  {option}
                </button>
              ))}
            </div>
          )
        ) : (
          <InlineFeedbackCard
            result={props.currentResult}
            isLastStep={props.currentStepIndex >= props.questions.length - 1}
            onContinue={props.onContinueStep}
            disabled={props.interactionDisabled}
            isSubmitting={props.isSubmittingCase}
          />
        )}
      </div>
    </Surface>
  );
}
