import type { RefObject } from "react";
import type { QuestionFlowStep, StepResult } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { PillNav } from "../primitives/PillNav";
import { prettyStepLabel } from "../../core/practice";
import { InlineFeedbackCard } from "./InlineFeedbackCard";

interface QuestionFlowCardProps {
  questions: QuestionFlowStep[];
  currentStepIndex: number;
  currentStep: QuestionFlowStep | null;
  currentResult: StepResult | null;
  currentOptions: string[];
  stepResults: StepResult[];
  onAnswer: (option: string) => void;
  onContinueStep: () => void;
  activeStepRef: RefObject<HTMLButtonElement | null>;
}

export function QuestionFlowCard(props: QuestionFlowCardProps) {
  const items = props.questions.map((step, index) => {
    const stepResult = props.stepResults[index];
    const status = stepResult
      ? stepResult.correct
        ? "correct"
        : "incorrect"
      : index < props.currentStepIndex
        ? "complete"
        : undefined;

    return {
      key: `${step.key}-${index}`,
      label: `${index + 1}. ${step.label ?? prettyStepLabel(step.key)}`,
      active: index === props.currentStepIndex,
      status,
      buttonRef: index === props.currentStepIndex ? props.activeStepRef : undefined
    };
  });

  return (
    <Surface className="question-flow-card">
      <div className="question-flow-card__header">
        <PillNav items={items} className="question-flow-card__pills" />
      </div>

      <div className="question-flow-card__body">
        <p className="question-flow-card__prompt">
          {props.currentStep?.prompt ?? "Question flow unavailable for this case."}
        </p>

        {!props.currentResult ? (
          <div className="question-flow-card__options">
            {props.currentOptions.map(option => (
              <button
                key={option}
                className="answer-option"
                type="button"
                onClick={() => props.onAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <InlineFeedbackCard
            result={props.currentResult}
            isLastStep={props.currentStepIndex >= props.questions.length - 1}
            onContinue={props.onContinueStep}
          />
        )}
      </div>
    </Surface>
  );
}
