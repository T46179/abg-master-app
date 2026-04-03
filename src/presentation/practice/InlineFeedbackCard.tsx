import type { StepResult } from "../../core/types";

interface InlineFeedbackCardProps {
  result: StepResult;
  isLastStep: boolean;
  onContinue: () => void;
}

export function InlineFeedbackCard(props: InlineFeedbackCardProps) {
  return (
    <div className={`inline-feedback${props.result.correct ? " is-correct" : " is-incorrect"}`}>
      <div className="inline-feedback__hero">
        <h3>{props.result.correct ? "Correct" : "Incorrect"}</h3>
      </div>

      <div className="inline-feedback__grid">
        <div className="inline-feedback__item">
          <span className="inline-feedback__label">Your answer</span>
          <strong>{props.result.chosen}</strong>
        </div>
        <div className="inline-feedback__item">
          <span className="inline-feedback__label">Correct answer</span>
          <strong>{props.result.correctAnswer}</strong>
        </div>
      </div>

      <button className="figma-button inline-feedback__button" type="button" onClick={props.onContinue}>
        {props.isLastStep ? "See results" : "Continue"}
      </button>
    </div>
  );
}
