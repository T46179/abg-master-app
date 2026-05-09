export type CalibrationPlacement = "beginner" | "intermediate" | "advanced";

export interface BuildAGasCalibrationSelection {
  pH?: string;
  PaCO2?: string;
  HCO3?: string;
}

export interface CalibrationScoringInput {
  bloodGasBlitz?: {
    correctCount: number;
    totalQuestions: number;
    elapsedMs: number;
  } | null;
  buildAGas?: {
    selectedValues: BuildAGasCalibrationSelection;
    elapsedMs: number;
  } | null;
  compensationFit?: {
    selectedAnswer: string;
    elapsedMs: number;
  } | null;
  finalDiagnosis?: {
    selectedAnswer: string;
    elapsedMs: number;
  } | null;
}

export interface CalibrationScore {
  accuracyPoints: number;
  speedPoints: number;
  totalScore: number;
  placement: CalibrationPlacement;
}

function elapsedSeconds(elapsedMs: number): number {
  return Math.max(0, elapsedMs) / 1000;
}

function scoreBloodGasBlitz(input: CalibrationScoringInput["bloodGasBlitz"]) {
  if (!input) return { accuracy: 0, speed: 0 };

  const correctCount = Math.max(0, Number(input.correctCount) || 0);
  const elapsed = elapsedSeconds(input.elapsedMs);
  const accuracy = correctCount >= 9 ? 1 : correctCount >= 7 ? 0.5 : 0;

  let speed = 0;
  if (correctCount >= 9 && elapsed <= 15) {
    speed = 1;
  } else if (correctCount >= 9 && elapsed <= 25) {
    speed = 0.5;
  } else if (correctCount >= 7 && elapsed <= 25) {
    speed = 0.5;
  }

  return { accuracy, speed };
}

function scoreBuildAGas(input: CalibrationScoringInput["buildAGas"]) {
  if (!input) return { accuracy: 0, speed: 0 };

  const selections = input.selectedValues;
  const paco2 = selections.PaCO2;
  let accuracy = 0;

  if (selections.pH === "7.28") accuracy += 0.75;
  if (selections.HCO3 === "14") accuracy += 0.75;
  if (paco2 === "28") accuracy += 0.5;
  if (paco2 === "40") accuracy += 0.25;

  const elapsed = elapsedSeconds(input.elapsedMs);
  const speed = elapsed <= 20 ? 1 : elapsed <= 45 ? 0.5 : 0;

  return { accuracy: Math.min(2, accuracy), speed };
}

function scoreCompensationFit(input: CalibrationScoringInput["compensationFit"]) {
  if (!input) return { accuracy: 0, speed: 0 };

  const accuracy = input.selectedAnswer === "Appropriate compensation" ? 2 : 0;
  const elapsed = elapsedSeconds(input.elapsedMs);
  const speed = elapsed <= 20 ? 1 : elapsed <= 45 ? 0.5 : 0;

  return { accuracy, speed };
}

function scoreFinalDiagnosis(input: CalibrationScoringInput["finalDiagnosis"]) {
  if (!input) return { accuracy: 0, speed: 0 };

  const accuracyByAnswer: Record<string, number> = {
    "Raised anion gap metabolic acidosis": 3,
    "Metabolic acidosis": 1.5,
    "Normal anion gap metabolic acidosis": 1,
    "Respiratory acidosis": 0
  };
  const accuracy = accuracyByAnswer[input.selectedAnswer] ?? 0;
  const elapsed = elapsedSeconds(input.elapsedMs);
  const speed = elapsed <= 30 ? 1 : elapsed <= 60 ? 0.5 : 0;

  return { accuracy, speed };
}

export function scoreCalibration(input: CalibrationScoringInput): CalibrationScore {
  const taskScores = [
    scoreBloodGasBlitz(input.bloodGasBlitz),
    scoreBuildAGas(input.buildAGas),
    scoreCompensationFit(input.compensationFit),
    scoreFinalDiagnosis(input.finalDiagnosis)
  ];

  const accuracyPoints = taskScores.reduce((sum, task) => sum + task.accuracy, 0);
  const speedPoints = taskScores.reduce((sum, task) => sum + task.speed, 0);
  const totalScore = accuracyPoints + speedPoints;
  const placement: CalibrationPlacement = accuracyPoints <= 3 || totalScore <= 4
    ? "beginner"
    : totalScore >= 10 && accuracyPoints >= 7
      ? "advanced"
      : "intermediate";

  return {
    accuracyPoints,
    speedPoints,
    totalScore,
    placement
  };
}
