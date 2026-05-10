import { useEffect, useState } from "react";
import { MetricLabel, MetricReference, MetricValue } from "../practice/MetricText";
import { mixedProcessAbgMetrics, mixedProcessOptions, mixedProcessSecondaryMetrics } from "./calibrationConfig";

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
          {mixedProcessAbgMetrics.map(metric => (
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
          {mixedProcessSecondaryMetrics.map(metric => (
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
          {mixedProcessOptions.map(option => {
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
