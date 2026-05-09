import { useEffect, useState } from "react";
import { MetricLabel, MetricReference, MetricValue } from "../practice/MetricText";

const COMPENSATION_CHECK_METRICS: Array<{ label: string; value: string; unit?: string; reference: string }> = [
  { label: "pH", value: "7.25", reference: "7.35 - 7.45" },
  { label: "PaCO2", value: "26", unit: "mmHg", reference: "35 - 45 mmHg" },
  { label: "HCO3", value: "12", unit: "mmol/L", reference: "22 - 26 mmol/L" }
] as const;

const COMPENSATION_CHECK_OPTIONS = [
  { label: "Appropriate compensation" },
  { label: "Additional respiratory acidosis" },
  { label: "Additional respiratory alkalosis" }
] as const;

interface CompensationCheckCalibrationStepProps {
  onCanContinueChange?: (canContinue: boolean) => void;
  onSelectionChange?: (answer: string | null) => void;
}

export function CompensationCheckCalibrationStep({
  onCanContinueChange,
  onSelectionChange
}: CompensationCheckCalibrationStepProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const canContinue = Boolean(selectedAnswer);

  useEffect(() => {
    onCanContinueChange?.(canContinue);
  }, [canContinue, onCanContinueChange]);

  useEffect(() => {
    onSelectionChange?.(selectedAnswer);
  }, [onSelectionChange, selectedAnswer]);

  return (
    <div className="calibration-compensation">
      <section className="calibration-compensation__card calibration-compensation__values">
        <span className="section-header__eyebrow">ABG Values</span>
        <div className="metric-grid metric-grid--primary calibration-compensation__metric-grid">
          {COMPENSATION_CHECK_METRICS.map(metric => (
            <article className="metric-card" key={metric.label}>
              <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
              <MetricValue renderedValue={metric.value} unit={metric.unit} />
              <MetricReference reference={metric.reference} />
            </article>
          ))}
        </div>
      </section>

      <section className="calibration-compensation__card calibration-compensation__answers">
        <span className="section-header__eyebrow">Answers</span>
        <div className="question-flow-card__options calibration-compensation__options">
          {COMPENSATION_CHECK_OPTIONS.map(option => {
            const selected = selectedAnswer === option.label;

            return (
              <button
                className={`answer-option calibration-compensation__option${selected ? " is-selected" : ""}`}
                type="button"
                key={option.label}
                aria-pressed={selected}
                onClick={() => setSelectedAnswer(option.label)}
              >
                <span className="calibration-compensation__option-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
