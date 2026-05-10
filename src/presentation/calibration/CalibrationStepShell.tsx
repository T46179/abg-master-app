import type { ReactNode } from "react";
import { Surface } from "../primitives/Surface";

interface CalibrationStepShellProps {
  children: ReactNode;
  className?: string;
}

export function CalibrationStepShell(props: CalibrationStepShellProps) {
  return (
    <Surface className={["calibration-step-shell", props.className].filter(Boolean).join(" ")}>
      {props.children}
    </Surface>
  );
}
