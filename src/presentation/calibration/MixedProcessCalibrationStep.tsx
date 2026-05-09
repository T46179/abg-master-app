import { useEffect, useState } from "react";
import { MetricLabel, MetricReference, MetricValue } from "../practice/MetricText";

const MIXED_PROCESS_ABG_METRICS = [
  { label: "pH", value: "7.24", unit: undefined, reference: "7.35 - 7.45", abnormal: true },
  { label: "PaCO2", value: "27", unit: "mmHg", reference: "35 - 45 mmHg", abnormal: true },
  { label: "HCO3", value: "12", unit: "mmol/L", reference: "22 - 26 mmol/L", abnormal: true }
] as const;

const MIXED_PROCESS_SECONDARY_METRICS = [
  { label: "Na", value: "140", unit: "mmol/L", reference: "135 - 145 mmol/L" },
  { label: "Cl", value: "100", unit: "mmol/L", reference: "98 - 107 mmol/L" }
] as const;

const MIXED_PROCESS_OPTIONS = [
  "Metabolic acidosis",
  "Respiratory acidosis",
  "Raised anion gap metabolic acidosis",
  "Normal anion gap metabolic acidosis"
] as const;

interface MixedProcessCalibrationStepProps {
  onCanContinueChange?: (canContinue: boolean) => void;
  onSelectionChange?: (answer: string | null) => void;
}

export function MixedProcessCalibrationStep({
  onCanContinueChange,
  onSelectionChange
}: MixedProcessCalibrationStepProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const canContinue = Boolean(selectedAnswer);

  useEffect(() => {
    onCanContinueChange?.(canContinue);
  }, [canContinue, onCanContinueChange]);

  useEffect(() => {
    onSelectionChange?.(selectedAnswer);
  }, [onSelectionChange, selectedAnswer]);

  return (
    <div className="calibration-compensation calibration-mixed-process">
      <section className="calibration-compensation__card calibration-compensation__values">
        <span className="section-header__eyebrow">ABG Values</span>
        <div className="metric-grid metric-grid--primary calibration-compensation__metric-grid">
          {MIXED_PROCESS_ABG_METRICS.map(metric => (
            <article className="metric-card" key={metric.label}>
              <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
              <MetricValue renderedValue={metric.value} unit={metric.unit} abnormal={metric.abnormal} />
              <MetricReference reference={metric.reference} />
            </article>
          ))}
        </div>
      </section>

      <section className="calibration-compensation__card calibration-compensation__values">
        <span className="section-header__eyebrow">Electrolytes &amp; other values</span>
        <div className="metric-grid metric-grid--secondary calibration-compensation__metric-grid calibration-compensation__metric-grid--secondary">
          {MIXED_PROCESS_SECONDARY_METRICS.map(metric => (
            <article className="metric-card metric-card--secondary" key={metric.label}>
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
          {MIXED_PROCESS_OPTIONS.map(option => {
            const selected = selectedAnswer === option;

            return (
              <button
                className={`answer-option calibration-compensation__option${selected ? " is-selected" : ""}`}
                type="button"
                key={option}
                aria-pressed={selected}
                onClick={() => setSelectedAnswer(option)}
              >
                <span className="calibration-compensation__option-label">{option}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
