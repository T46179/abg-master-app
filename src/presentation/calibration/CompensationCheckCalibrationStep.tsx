import { Surface } from "../primitives/Surface";
import { MetricLabel, MetricValue } from "../practice/MetricText";

const COMPENSATION_CHECK_METRICS: Array<{ label: string; value: string; unit?: string }> = [
  { label: "pH", value: "7.25" },
  { label: "PaCO2", value: "26", unit: "mmHg" },
  { label: "HCO3", value: "12", unit: "mmol/L" }
] as const;

const COMPENSATION_CHECK_OPTIONS = [
  {
    label: "Appropriate compensation",
    description: "Expected PaCO2 fits the measured value"
  },
  {
    label: "Additional respiratory acidosis",
    description: "PaCO2 is higher than expected"
  },
  {
    label: "Additional respiratory alkalosis",
    description: "PaCO2 is lower than expected"
  }
] as const;

export function CompensationCheckCalibrationStep() {
  return (
    <div className="calibration-compensation">
      <Surface className="value-panels__card calibration-compensation__card">
        <span className="section-header__eyebrow">ABG Values</span>
        <div className="metric-grid metric-grid--primary calibration-compensation__metric-grid">
          {COMPENSATION_CHECK_METRICS.map(metric => (
            <article className="metric-card" key={metric.label}>
              <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
              <MetricValue renderedValue={metric.value} unit={metric.unit} />
            </article>
          ))}
        </div>
      </Surface>

      <Surface className="calibration-compensation__card calibration-compensation__answers">
        <span className="section-header__eyebrow">Answers</span>
        <div className="question-flow-card__options calibration-compensation__options">
          {COMPENSATION_CHECK_OPTIONS.map(option => (
            <div className="answer-option calibration-compensation__option" key={option.label}>
              <span>{option.label}</span>
              <small>{option.description}</small>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
