import type { StepResult } from "../../core/types";
import { MetricInlineText } from "./MetricText";

interface InlineFeedbackCardProps {
  result: StepResult;
  isLastStep: boolean;
  onContinue: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

export function InlineFeedbackCard(props: InlineFeedbackCardProps) {
  return (
    <div className={`inline-feedback${props.result.correct ? " is-correct" : " is-incorrect"}`}>
      <div className="inline-feedback__grid">
        <div className="inline-feedback__item">
          <span className="inline-feedback__label">Your answer</span>
          <strong><MetricInlineText text={props.result.chosen} /></strong>
        </div>
        <div className="inline-feedback__item">
          <span className="inline-feedback__label">Correct answer</span>
          <strong><MetricInlineText text={props.result.correctAnswer} /></strong>
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
          "Submit Case"
        ) : (
          "Continue"
        )}
      </button>
    </div>
  );
}
