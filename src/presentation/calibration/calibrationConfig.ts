import type { CalibrationPhase } from "./calibrationTypes";

export interface CalibrationStepMetadata {
  phase: CalibrationPhase;
  eyebrow: string;
  stepLabel: string;
  title: string;
  description: string;
}

export const calibrationSteps = [
  {
    phase: "intro",
    eyebrow: "Calibration",
    stepLabel: "Intro",
    title: "Let's find your starting level",
    description: "Four short challenges. Two minutes. We'll estimate where you should begin so practice feels right - not too easy, not too hard."
  },
  {
    phase: "blood-gas-blitz",
    eyebrow: "Calibration",
    stepLabel: "Step 1 of 5",
    title: "Blood Gas Blitz",
    description: "Placeholder for pH speed check."
  },
  {
    phase: "build-a-gas",
    eyebrow: "Calibration",
    stepLabel: "Step 2 of 5",
    title: "Build a Gas",
    description: "Placeholder for metabolic acidosis build-a-gas step."
  },
  {
    phase: "compensation-check",
    eyebrow: "Calibration",
    stepLabel: "Step 3 of 5",
    title: "Is the compensation appropriate?",
    description: "Use the blood gas values below and pick the best fit."
  },
  {
    phase: "mixed-process-challenge",
    eyebrow: "Calibration",
    stepLabel: "Step 4 of 5",
    title: "Mixed Process Challenge",
    description: "Placeholder for mixed acid-base interpretation step."
  },
  {
    phase: "analysing-sample",
    eyebrow: "Calibration",
    stepLabel: "Step 5 of 5",
    title: "Analysing sample",
    description: "Placeholder for analyser-style loading screen."
  },
  {
    phase: "result",
    eyebrow: "Calibration",
    stepLabel: "Result",
    title: "Calibration result",
    description: "Placeholder for recommended starting level."
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

export function isIntroPhase(phase: CalibrationPhase): boolean {
  return phase === "intro";
}

export function isResultPhase(phase: CalibrationPhase): boolean {
  return phase === "result";
}
