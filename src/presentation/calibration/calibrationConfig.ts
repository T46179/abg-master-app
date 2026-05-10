import type { CalibrationPhase } from "./calibrationTypes";

export interface CalibrationStepMetadata {
  phase: CalibrationPhase;
  title: string;
  subtitle?: string;
  countsTowardProgress: boolean;
  requiresAnswerToContinue: boolean;
}

export const calibrationSteps = [
  {
    phase: "blood-gas-blitz",
    title: "Blood Gas Blitz",
    countsTowardProgress: true,
    requiresAnswerToContinue: false
  },
  {
    phase: "build-a-gas",
    title: "Build a Gas",
    subtitle: "Select the cards below to build a Metabolic Acidosis",
    countsTowardProgress: true,
    requiresAnswerToContinue: true
  },
  {
    phase: "compensation-check",
    title: "Does Compensation Fit?",
    countsTowardProgress: true,
    requiresAnswerToContinue: true
  },
  {
    phase: "mixed-process-challenge",
    title: "Almost There",
    subtitle: "Use the values below to choose the best answer",
    countsTowardProgress: true,
    requiresAnswerToContinue: true
  },
  {
    phase: "analysing-sample",
    title: "Analysing sample",
    countsTowardProgress: false,
    requiresAnswerToContinue: false
  },
  {
    phase: "result",
    title: "Calibration result",
    countsTowardProgress: false,
    requiresAnswerToContinue: false
  }
] as const satisfies readonly CalibrationStepMetadata[];

export interface CalibrationMetricDefinition {
  label: string;
  value: string;
  unit?: string;
  reference: string;
  abnormal?: boolean;
}

export interface BuildAGasChoiceDefinition {
  value: string;
  status: "low" | "normal" | "high";
}

export interface BuildAGasRowDefinition {
  label: string;
  unit?: string;
  choices: readonly BuildAGasChoiceDefinition[];
}

export const buildAGasRows: readonly BuildAGasRowDefinition[] = [
  {
    label: "pH",
    choices: [
      { value: "7.28", status: "low" },
      { value: "7.40", status: "normal" },
      { value: "7.52", status: "high" }
    ]
  },
  {
    label: "PaCO2",
    unit: "mmHg",
    choices: [
      { value: "28", status: "low" },
      { value: "40", status: "normal" },
      { value: "52", status: "high" }
    ]
  },
  {
    label: "HCO3",
    unit: "mmol/L",
    choices: [
      { value: "14", status: "low" },
      { value: "24", status: "normal" },
      { value: "32", status: "high" }
    ]
  }
] as const;

export const compensationCheckMetrics: readonly CalibrationMetricDefinition[] = [
  { label: "pH", value: "7.25", reference: "7.35 - 7.45" },
  { label: "PaCO2", value: "26", unit: "mmHg", reference: "35 - 45 mmHg" },
  { label: "HCO3", value: "12", unit: "mmol/L", reference: "22 - 26 mmol/L" }
] as const;

export const compensationCheckOptions = [
  { label: "Appropriate compensation" },
  { label: "Additional respiratory acidosis" },
  { label: "Additional respiratory alkalosis" }
] as const;

export const mixedProcessAbgMetrics: readonly CalibrationMetricDefinition[] = [
  { label: "pH", value: "7.24", unit: undefined, reference: "7.35 - 7.45", abnormal: true },
  { label: "PaCO2", value: "27", unit: "mmHg", reference: "35 - 45 mmHg", abnormal: true },
  { label: "HCO3", value: "12", unit: "mmol/L", reference: "22 - 26 mmol/L", abnormal: true }
] as const;

export const mixedProcessSecondaryMetrics: readonly CalibrationMetricDefinition[] = [
  { label: "Na", value: "140", unit: "mmol/L", reference: "135 - 145 mmol/L" },
  { label: "Cl", value: "100", unit: "mmol/L", reference: "98 - 107 mmol/L" }
] as const;

export const mixedProcessOptions = [
  "Metabolic acidosis",
  "Respiratory acidosis",
  "Raised anion gap metabolic acidosis",
  "Normal anion gap metabolic acidosis"
] as const;

export const calibrationScoringRules = {
  bloodGasBlitz: {
    excellentCorrectCount: 9,
    partialCorrectCount: 7,
    fastMs: 15000,
    partialMs: 25000
  },
  buildAGas: {
    maxAccuracy: 2,
    answerAccuracy: {
      pH: { "7.28": 0.75 },
      HCO3: { "14": 0.75 },
      PaCO2: { "28": 0.5, "40": 0.25 }
    },
    fastMs: 20000,
    partialMs: 45000
  },
  compensationFit: {
    correctAnswer: "Appropriate compensation",
    accuracy: 2,
    fastMs: 20000,
    partialMs: 45000
  },
  finalDiagnosis: {
    answerAccuracy: {
      "Raised anion gap metabolic acidosis": 3,
      "Metabolic acidosis": 1.5,
      "Normal anion gap metabolic acidosis": 1,
      "Respiratory acidosis": 0
    },
    fastMs: 30000,
    partialMs: 60000
  },
  placement: {
    beginnerAccuracyMax: 3,
    beginnerTotalMax: 4,
    advancedTotalMin: 10,
    advancedAccuracyMin: 7
  }
} as const;

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

export function getCalibrationSubtitle(phase: CalibrationPhase): string | null {
  return getCalibrationStep(phase).subtitle ?? null;
}

export function requiresCalibrationAnswerToContinue(phase: CalibrationPhase): boolean {
  return getCalibrationStep(phase).requiresAnswerToContinue;
}

export function getCalibrationProgressMeta(phase: CalibrationPhase) {
  const progressSteps = calibrationSteps.filter(step => step.countsTowardProgress);
  const phaseIndex = progressSteps.findIndex(step => step.phase === phase);
  const total = progressSteps.length;

  if (phaseIndex >= 0) {
    return {
      label: `${phaseIndex + 1} of ${total}`,
      percent: ((phaseIndex + 1) / total) * 100
    };
  }

  return { label: `${total} of ${total}`, percent: 100 };
}
