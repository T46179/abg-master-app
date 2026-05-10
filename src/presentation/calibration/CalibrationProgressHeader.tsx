import type { CalibrationPhase } from "./calibrationTypes";

const CALIBRATION_PROGRESS_PHASES: CalibrationPhase[] = [
  "blood-gas-blitz",
  "build-a-gas",
  "compensation-check",
  "mixed-process-challenge"
];

function getProgressMeta(phase: CalibrationPhase) {
  const phaseIndex = CALIBRATION_PROGRESS_PHASES.indexOf(phase);
  const total = CALIBRATION_PROGRESS_PHASES.length;

  if (phaseIndex >= 0) {
    return {
      label: `${phaseIndex + 1} of ${total}`,
      percent: ((phaseIndex + 1) / total) * 100
    };
  }

  return { label: `${total} of ${total}`, percent: 100 };
}

interface CalibrationProgressHeaderProps {
  phase: CalibrationPhase;
}

export function CalibrationProgressHeader(props: CalibrationProgressHeaderProps) {
  const progress = getProgressMeta(props.phase);

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
