import { useEffect, useState } from "react";
import { MetricLabel, MetricValue } from "../practice/MetricText";
import type { BuildAGasCalibrationSelection } from "./calibrationScoring";

interface BuildAGasChoice {
  value: string;
  status: "low" | "normal" | "high";
}

interface BuildAGasRow {
  label: string;
  unit?: string;
  choices: BuildAGasChoice[];
}

const BUILD_A_GAS_ROWS: BuildAGasRow[] = [
  {
    label: "pH",
    choices: [
      { value: "7.28", status: "low" },
      { value: "7.40", status: "normal" },
      { value: "7.52", status: "high" }
    ]
  },
  {
    label: "PaCO2",
    unit: "mmHg",
    choices: [
      { value: "28", status: "low" },
      { value: "40", status: "normal" },
      { value: "52", status: "high" }
    ]
  },
  {
    label: "HCO3",
    unit: "mmol/L",
    choices: [
      { value: "14", status: "low" },
      { value: "24", status: "normal" },
      { value: "32", status: "high" }
    ]
  }
];

interface BuildAGasCalibrationStepProps {
  onCanContinueChange?: (canContinue: boolean) => void;
  onSelectionChange?: (selection: BuildAGasCalibrationSelection) => void;
}

export function BuildAGasCalibrationStep({ onCanContinueChange, onSelectionChange }: BuildAGasCalibrationStepProps) {
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const phValue = selectedValues.pH;
  const paco2Value = selectedValues.PaCO2;
  const hco3Value = selectedValues.HCO3;
  const canContinue = BUILD_A_GAS_ROWS.every(row => Boolean(selectedValues[row.label]));

  useEffect(() => {
    onCanContinueChange?.(canContinue);
  }, [canContinue, onCanContinueChange]);

  useEffect(() => {
    onSelectionChange?.({
      pH: selectedValues.pH,
      PaCO2: selectedValues.PaCO2,
      HCO3: selectedValues.HCO3
    });
  }, [onSelectionChange, selectedValues.HCO3, selectedValues.PaCO2, selectedValues.pH]);

  return (
    <section className="calibration-build-gas" aria-label="Build a Gas calibration preview">
      <div className="calibration-build-gas__rows">
        {BUILD_A_GAS_ROWS.map(row => (
          <div className="calibration-build-gas__row" key={row.label}>
            <div className="calibration-build-gas__row-header">
              <span className="calibration-build-gas__row-label">
                <MetricLabel label={row.label} />
              </span>
              {row.unit ? <span className="calibration-build-gas__row-unit">{row.unit}</span> : null}
            </div>
            <div className="calibration-build-gas__choice-grid">
              {row.choices.map(choice => {
                const selected = selectedValues[row.label] === choice.value;

                return (
                  <article
                    role="button"
                    tabIndex={0}
                    className={`metric-card calibration-build-gas__choice${selected ? " is-selected" : ""}`}
                    key={`${row.label}-${choice.value}`}
                    aria-label={`${row.label} ${choice.value} ${choice.status}${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setSelectedValues(values => ({ ...values, [row.label]: choice.value }))}
                    onKeyDown={event => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedValues(values => ({ ...values, [row.label]: choice.value }));
                    }}
                  >
                    {selected ? <span className="calibration-build-gas__check" aria-hidden="true">✓</span> : null}
                    <MetricValue renderedValue={choice.value} />
                    <span className="calibration-build-gas__status">{choice.status}</span>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="calibration-build-gas__footer">
        <span className="calibration-build-gas__summary">
          {phValue ? <>pH {phValue}</> : null}
          {phValue && paco2Value ? <span aria-hidden="true"> · </span> : null}
          {paco2Value ? <>CO<sub>2</sub> {paco2Value}</> : null}
          {(phValue || paco2Value) && hco3Value ? <span aria-hidden="true"> · </span> : null}
          {hco3Value ? <>HCO<sub>3</sub> {hco3Value}</> : null}
        </span>
      </div>
    </section>
  );
}
