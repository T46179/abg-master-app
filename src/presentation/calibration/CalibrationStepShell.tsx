import type { ReactNode } from "react";
import { Surface } from "../primitives/Surface";

interface CalibrationStepShellProps {
  children: ReactNode;
}

export function CalibrationStepShell(props: CalibrationStepShellProps) {
  return (
    <Surface className="calibration-step-shell">
      {props.children}
    </Surface>
  );
}
