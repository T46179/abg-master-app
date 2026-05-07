import { MetricLabel, MetricValue } from "../practice/MetricText";

interface BuildAGasChoice {
  value: string;
  status: "low" | "normal" | "high";
}

interface BuildAGasRow {
  label: string;
  unit?: string;
  selectedValue: string;
  choices: BuildAGasChoice[];
}

const BUILD_A_GAS_ROWS: BuildAGasRow[] = [
  {
    label: "pH",
    selectedValue: "7.28",
    choices: [
      { value: "7.28", status: "low" },
      { value: "7.40", status: "normal" },
      { value: "7.52", status: "high" }
    ]
  },
  {
    label: "PaCO2",
    unit: "mmHg",
    selectedValue: "28",
    choices: [
      { value: "28", status: "low" },
      { value: "40", status: "normal" },
      { value: "52", status: "high" }
    ]
  },
  {
    label: "HCO3",
    unit: "mmol/L",
    selectedValue: "14",
    choices: [
      { value: "14", status: "low" },
      { value: "24", status: "normal" },
      { value: "32", status: "high" }
    ]
  }
];

export function BuildAGasCalibrationStep() {
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
                const selected = choice.value === row.selectedValue;

                return (
                  <article
                    className={`metric-card calibration-build-gas__choice${selected ? " is-selected" : ""}`}
                    key={`${row.label}-${choice.value}`}
                    aria-label={`${row.label} ${choice.value} ${choice.status}${selected ? " selected" : ""}`}
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
        <span>Your build</span>
        <span className="calibration-build-gas__summary">
          pH 7.28 <span aria-hidden="true">·</span> CO<sub>2</sub> 28 <span aria-hidden="true">·</span> HCO<sub>3</sub> 14
        </span>
      </div>
    </section>
  );
}

