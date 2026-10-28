import type { PressureUnit } from "../../core/types";

interface CalibrationOnboardingStepProps {
  onBegin: () => void;
  onSkip: () => void;
  skipPending: boolean;
  pressureUnit: PressureUnit;
  onPressureUnitChange: (unit: PressureUnit) => void;
}

const CALIBRATION_INTRO_COPY = {
  eyebrow: "Welcome to ABG Master!",
  title: "Let's find your starting level",
  bodyLead: "Four short challenges. Two minutes.",
  bodyDetail: "We'll estimate where you should begin so practice feels right.",
  cta: "Begin Calibration",
  skip: "Skip and start at Beginner"
} as const;

export function CalibrationOnboardingStep(props: CalibrationOnboardingStepProps) {
  return (
    <main className="app-shell__page calibration-onboarding">
      <section className="calibration-onboarding__panel" aria-labelledby="calibration-onboarding-title">
        <div className="calibration-onboarding__header">
          <p className="calibration-onboarding__eyebrow">{CALIBRATION_INTRO_COPY.eyebrow}</p>
          <div className="main-nav__unit-control" role="group" aria-label="Partial pressure display units">
            {(["mmHg", "kPa"] as const).map(unit => (
              <button className="main-nav__unit-option" type="button" key={unit}
                aria-pressed={props.pressureUnit === unit} disabled={props.skipPending}
                onClick={() => props.onPressureUnitChange(unit)}>{unit}</button>
            ))}
          </div>
        </div>
        <h1 id="calibration-onboarding-title">{CALIBRATION_INTRO_COPY.title}</h1>
        <p className="calibration-onboarding__body">
          <span>{CALIBRATION_INTRO_COPY.bodyLead}</span>
          <span>{CALIBRATION_INTRO_COPY.bodyDetail}</span>
        </p>
        <button
          className="figma-button calibration-onboarding__button"
          type="button"
          onClick={props.onBegin}
          disabled={props.skipPending}
        >
          {CALIBRATION_INTRO_COPY.cta}
        </button>
        <button
          className="calibration-onboarding__skip"
          type="button"
          onClick={props.onSkip}
          disabled={props.skipPending}
        >
          {CALIBRATION_INTRO_COPY.skip}
        </button>
      </section>
    </main>
  );
}
