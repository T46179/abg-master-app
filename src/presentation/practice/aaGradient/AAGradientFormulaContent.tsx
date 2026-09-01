import type { PressureUnit } from "../../../core/types";

export function AAGradientFormulaContent({ pressureUnit }: { pressureUnit: PressureUnit }) {
  const shortcut = pressureUnit === "kPa" ? "20.0 kPa" : "150 mmHg";

  return (
    <>
      <p className="question-flow-card__rule-popover-label">formula</p>
      <h3>A-a Gradient</h3>
      <p>
        PAO<sub>2</sub> = FiO<sub>2</sub> &times; (Patmos &minus; PH<sub>2</sub>O) &minus; PaCO<sub>2</sub> / 0.8
      </p>
      <p>
        A&ndash;a gradient = PAO<sub>2</sub> &minus; PaO<sub>2</sub>
      </p>
      <h3>Room-air sea-level shortcut:</h3>
      <p>
        PAO<sub>2</sub> &asymp; {shortcut} &minus; PaCO<sub>2</sub> / 0.8
      </p>
      <p className="question-flow-card__rule-popover-label">Note:</p>
      <p>
        The shortcut and normal range are mainly for room air at sea level. Normal A&ndash;a gradient varies with age, FiO<sub>2</sub>, and atmospheric pressure.
      </p>
    </>
  );
}
