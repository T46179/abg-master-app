import type { ReactNode } from "react";
import { Surface } from "../primitives/Surface";

interface CalibrationStepShellProps {
  eyebrow: string;
  stepLabel: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function CalibrationStepShell(props: CalibrationStepShellProps) {
  return (
    <Surface className="calibration-step-shell">
      <div className="calibration-step-shell__header">
        <span className="calibration-step-shell__eyebrow">{props.eyebrow}</span>
        <span className="calibration-step-shell__step">{props.stepLabel}</span>
      </div>
      <h1>{props.title}</h1>
      <p>{props.description}</p>
      {props.children}
    </Surface>
  );
}

