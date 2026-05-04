import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { AnswerSelection, CaseData, QuestionFlowStep, StepResult } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { PillNav } from "../primitives/PillNav";
import { formatAnswerValue, getQuestionFlowStepStatus, prettyStepLabel } from "../../core/practice";
import { InlineFeedbackCard } from "./InlineFeedbackCard";
import { MetricInlineText } from "./MetricText";
import { compensationRules } from "../learn/CompensationRules";

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

function getStringAnswer(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const firstString = value.find(item => typeof item === "string");
    return typeof firstString === "string" ? firstString : null;
  }
  return null;
}

function getPrimaryDisorderAnswer(props: QuestionFlowCardProps): string | null {
  const primaryResult = props.stepResults.find(result => result?.key === "primary_disorder");
  const primarySelection = props.selectedAnswers.find(selection => selection?.key === "primary_disorder");
  return getStringAnswer(primaryResult?.chosen) ?? getStringAnswer(primarySelection?.chosen);
}

function getExpectedCompensationRule(caseItem: CaseData | null): string | null {
  const expected = caseItem?.answer_key?.expected_compensation;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) return null;
  const rule = (expected as { rule?: unknown }).rule;
  return typeof rule === "string" ? rule : null;
}

function getCompensationRuleSlug(caseItem: CaseData | null, primaryDisorder: string | null): string | null {
  const expectedRule = getExpectedCompensationRule(caseItem)?.toLowerCase() ?? "";
  const normalizedDisorder = primaryDisorder?.toLowerCase() ?? "";

  if (expectedRule.includes("metabolic alkalosis") || normalizedDisorder === "metabolic alkalosis") {
    return "metabolic-alkalosis";
  }

  if (expectedRule.includes("winter") || expectedRule.includes("metabolic acidosis") || normalizedDisorder === "metabolic acidosis") {
    return "metabolic-acidosis";
  }

  if (expectedRule.includes("chronic respiratory acidosis")) {
    return "chronic-respiratory-acidosis";
  }

  if (expectedRule.includes("acute respiratory acidosis")) {
    return "acute-respiratory-acidosis";
  }

  if (expectedRule.includes("chronic respiratory alkalosis")) {
    return "chronic-respiratory-alkalosis";
  }

  if (expectedRule.includes("acute respiratory alkalosis")) {
    return "acute-respiratory-alkalosis";
  }

  if (normalizedDisorder === "respiratory acidosis") {
    return "acute-respiratory-acidosis";
  }

  if (normalizedDisorder === "respiratory alkalosis") {
    return "acute-respiratory-alkalosis";
  }

  return null;
}

export function QuestionFlowCard(props: QuestionFlowCardProps) {
  const iconButtonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isRulePopoverOpen, setIsRulePopoverOpen] = useState(false);
  const isMultiSelect = props.currentStep?.selection_mode === "multi";
  const selectedValues = Array.isArray(props.currentSelection?.chosen) ? props.currentSelection.chosen : [];
  const hasMultiSelectAnswer = selectedValues.length > 0;
  const isMasterCase = Number(props.caseItem?.difficulty_level ?? 1) >= 4;
  const currentStepKey = props.currentStep?.key;
  const currentDifficultyLevel = Number(props.caseItem?.difficulty_level ?? 1);
  const shouldShowCompensationRuleButton = currentStepKey === "compensation" && (
    currentDifficultyLevel === 2 ||
    currentDifficultyLevel === 3
  );
  const primaryDisorderAnswer = getPrimaryDisorderAnswer(props);
  const activeCompensationRule = useMemo(() => {
    const slug = getCompensationRuleSlug(props.caseItem, primaryDisorderAnswer);
    return compensationRules.find(rule => rule.slug === slug) ?? null;
  }, [primaryDisorderAnswer, props.caseItem]);
  const showCompensationRulePopover = Boolean(isRulePopoverOpen && activeCompensationRule);
  const hasWhiteAnswerCardBorder = isMasterCase && (
    currentStepKey === "acid_base_processes" ||
    currentStepKey === "diagnosis" ||
    currentStepKey === "final_diagnosis"
  );

  useEffect(() => {
    setIsRulePopoverOpen(false);
  }, [currentStepKey, props.currentStepIndex]);

  useEffect(() => {
    if (!isRulePopoverOpen) return;

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (
        target &&
        (iconButtonRef.current?.contains(target) || popoverRef.current?.contains(target))
      ) {
        return;
      }
      setIsRulePopoverOpen(false);
    }

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isRulePopoverOpen]);

  function toggleCompensationRulePopover() {
    if (!activeCompensationRule) return;
    setIsRulePopoverOpen(isOpen => !isOpen);
  }

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
        <div className="question-flow-card__prompt-row">
          <p className="question-flow-card__prompt">
            {props.currentStep?.prompt ?? "Question flow unavailable for this case."}
          </p>

          {shouldShowCompensationRuleButton ? (
            <button
              ref={iconButtonRef}
              className="question-flow-card__rule-button"
              type="button"
              onClick={toggleCompensationRulePopover}
              aria-label="Show compensation rule"
              aria-expanded={showCompensationRulePopover}
              disabled={!activeCompensationRule}
            >
              <span
                className="question-flow-card__rule-icon"
                aria-hidden="true"
              />
            </button>
          ) : null}

          {showCompensationRulePopover && activeCompensationRule ? (
            <div
              ref={popoverRef}
              className="question-flow-card__rule-popover"
              role="dialog"
              aria-label="Compensation rule"
            >
              <p className="question-flow-card__rule-popover-label">Compensation rule</p>
              <h3>{activeCompensationRule.title}</h3>
              <p><span>Expected </span>{activeCompensationRule.formula}</p>
              <p>{activeCompensationRule.range}</p>
            </div>
          ) : null}
        </div>

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
