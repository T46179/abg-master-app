import type { StepResult } from "../../core/types";
import { formatAnswerValue } from "../../core/practice";
import { MetricInlineText } from "./MetricText";

interface InlineFeedbackCardProps {
  result: StepResult;
  isLastStep: boolean;
  onContinue: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  lastStepButtonLabel?: string;
}

export function InlineFeedbackCard(props: InlineFeedbackCardProps) {
  return (
    <div className={`inline-feedback inline-feedback--answer-flow${props.result.correct ? " is-correct" : " is-incorrect"}`}>
      <div className="inline-feedback__grid">
        <div className="inline-feedback__item">
          <span className="inline-feedback__label">Your answer</span>
          <strong><MetricInlineText text={formatAnswerValue(props.result.chosen)} /></strong>
        </div>
        <div className="inline-feedback__item">
          <span className="inline-feedback__label">Correct answer</span>
          <strong><MetricInlineText text={formatAnswerValue(props.result.correctAnswer)} /></strong>
        </div>
      </div>

      {props.result.feedback?.body ? (
        <p className="inline-feedback__note"><MetricInlineText text={props.result.feedback.body} /></p>
      ) : null}

      <button
        className="figma-button inline-feedback__button"
        type="button"
        onClick={props.onContinue}
        disabled={props.disabled}
      >
        {props.isLastStep && props.isSubmitting ? (
          <>
            <span className="figma-button__spinner" aria-hidden="true" />
            <span>Submitting case</span>
          </>
        ) : props.isLastStep ? (
          props.lastStepButtonLabel ?? "Submit Case"
        ) : (
          "Continue"
        )}
      </button>
    </div>
  );
}
