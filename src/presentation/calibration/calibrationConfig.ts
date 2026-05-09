import type { CalibrationPhase } from "./calibrationTypes";

export interface CalibrationStepMetadata {
  phase: CalibrationPhase;
  title: string;
}

export const calibrationSteps = [
  {
    phase: "blood-gas-blitz",
    title: "Blood Gas Blitz"
  },
  {
    phase: "build-a-gas",
    title: "Build a Gas"
  },
  {
    phase: "compensation-check",
    title: "Does Compnsation Fit?"
  },
  {
    phase: "mixed-process-challenge",
    title: "Almost There"
  },
  {
    phase: "analysing-sample",
    title: "Analysing sample"
  },
  {
    phase: "result",
    title: "Calibration result"
  }
] as const satisfies readonly CalibrationStepMetadata[];

export function getCalibrationStep(phase: CalibrationPhase): CalibrationStepMetadata {
  const step = calibrationSteps.find(item => item.phase === phase);
  if (!step) throw new Error(`Unknown calibration phase: ${phase}`);
  return step;
}

export function getNextCalibrationPhase(phase: CalibrationPhase): CalibrationPhase | null {
  const currentIndex = calibrationSteps.findIndex(item => item.phase === phase);
  if (currentIndex < 0) return null;
  return calibrationSteps[currentIndex + 1]?.phase ?? null;
}

export function getPreviousCalibrationPhase(phase: CalibrationPhase): CalibrationPhase | null {
  const currentIndex = calibrationSteps.findIndex(item => item.phase === phase);
  if (currentIndex < 0) return null;
  return calibrationSteps[currentIndex - 1]?.phase ?? null;
}

export function isResultPhase(phase: CalibrationPhase): boolean {
  return phase === "result";
}
