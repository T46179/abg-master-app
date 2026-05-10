import type { CalibrationPhase } from "./calibrationTypes";
import { getCalibrationProgressMeta } from "./calibrationConfig";

interface CalibrationProgressHeaderProps {
  phase: CalibrationPhase;
}

export function CalibrationProgressHeader(props: CalibrationProgressHeaderProps) {
  const progress = getCalibrationProgressMeta(props.phase);

  return (
    <header className="calibration-progress-header">
      <div className="calibration-progress-header__meta">
        <div className="calibration-progress-header__brand">
          <span>Calibration</span>
        </div>

        <span className="calibration-progress-header__count">{progress.label}</span>
      </div>
      <div className="calibration-progress-header__track" aria-label="Calibration progress">
        <span className="calibration-progress-header__bar" style={{ width: `${progress.percent}%` }} />
      </div>
    </header>
  );
}
