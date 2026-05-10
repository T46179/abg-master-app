import type { CalibrationPlacement } from "../../core/types";
import { calibrationScoringRules } from "./calibrationConfig";
import type { BuildAGasCalibrationSelection } from "./calibrationTypes";

export type { BuildAGasCalibrationSelection };

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

  const rules = calibrationScoringRules.bloodGasBlitz;
  const correctCount = Math.max(0, Number(input.correctCount) || 0);
  const elapsed = elapsedSeconds(input.elapsedMs);
  const accuracy = correctCount >= rules.excellentCorrectCount ? 1 : correctCount >= rules.partialCorrectCount ? 0.5 : 0;

  let speed = 0;
  if (correctCount >= rules.excellentCorrectCount && elapsed <= elapsedSeconds(rules.fastMs)) {
    speed = 1;
  } else if (correctCount >= rules.excellentCorrectCount && elapsed <= elapsedSeconds(rules.partialMs)) {
    speed = 0.5;
  } else if (correctCount >= rules.partialCorrectCount && elapsed <= elapsedSeconds(rules.partialMs)) {
    speed = 0.5;
  }

  return { accuracy, speed };
}

function scoreBuildAGas(input: CalibrationScoringInput["buildAGas"]) {
  if (!input) return { accuracy: 0, speed: 0 };

  const rules = calibrationScoringRules.buildAGas;
  const selections = input.selectedValues;
  const paco2 = selections.PaCO2;
  let accuracy = 0;

  accuracy += rules.answerAccuracy.pH[selections.pH as keyof typeof rules.answerAccuracy.pH] ?? 0;
  accuracy += rules.answerAccuracy.HCO3[selections.HCO3 as keyof typeof rules.answerAccuracy.HCO3] ?? 0;
  accuracy += rules.answerAccuracy.PaCO2[paco2 as keyof typeof rules.answerAccuracy.PaCO2] ?? 0;

  const elapsed = elapsedSeconds(input.elapsedMs);
  const speed = elapsed <= elapsedSeconds(rules.fastMs) ? 1 : elapsed <= elapsedSeconds(rules.partialMs) ? 0.5 : 0;

  return { accuracy: Math.min(rules.maxAccuracy, accuracy), speed };
}

function scoreCompensationFit(input: CalibrationScoringInput["compensationFit"]) {
  if (!input) return { accuracy: 0, speed: 0 };

  const rules = calibrationScoringRules.compensationFit;
  const accuracy = input.selectedAnswer === rules.correctAnswer ? rules.accuracy : 0;
  const elapsed = elapsedSeconds(input.elapsedMs);
  const speed = elapsed <= elapsedSeconds(rules.fastMs) ? 1 : elapsed <= elapsedSeconds(rules.partialMs) ? 0.5 : 0;

  return { accuracy, speed };
}

function scoreFinalDiagnosis(input: CalibrationScoringInput["finalDiagnosis"]) {
  if (!input) return { accuracy: 0, speed: 0 };

  const rules = calibrationScoringRules.finalDiagnosis;
  const accuracy = rules.answerAccuracy[input.selectedAnswer as keyof typeof rules.answerAccuracy] ?? 0;
  const elapsed = elapsedSeconds(input.elapsedMs);
  const speed = elapsed <= elapsedSeconds(rules.fastMs) ? 1 : elapsed <= elapsedSeconds(rules.partialMs) ? 0.5 : 0;

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
  const rules = calibrationScoringRules.placement;
  const placement: CalibrationPlacement = accuracyPoints <= rules.beginnerAccuracyMax || totalScore <= rules.beginnerTotalMax
    ? "beginner"
    : totalScore >= rules.advancedTotalMin && accuracyPoints >= rules.advancedAccuracyMin
      ? "advanced"
      : "intermediate";

  return {
    accuracyPoints,
    speedPoints,
    totalScore,
    placement
  };
}
