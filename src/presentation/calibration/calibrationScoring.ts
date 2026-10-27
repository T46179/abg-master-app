import type { CalibrationRecommendation } from "../../core/types";
import { calibrationScoringRules } from "./calibrationConfig";
import type { BuildAGasCalibrationSelection } from "./calibrationTypes";

export type { BuildAGasCalibrationSelection };

export interface CalibrationScoringInput {
  bloodGasBlitz?: { correctCount: number; totalQuestions: number; elapsedMs: number } | null;
  buildAGas?: { selectedValues: BuildAGasCalibrationSelection; elapsedMs: number } | null;
  compensationFit?: { selectedAnswer: string; elapsedMs: number } | null;
  finalDiagnosis?: { selectedAnswer: string; elapsedMs: number } | null;
}

export interface CalibrationScore {
  accuracyPoints: number;
  speedPoints: number;
  totalScore: number;
  placement: CalibrationRecommendation;
}

export function scoreCalibration(input: CalibrationScoringInput): CalibrationScore {
  const rules = calibrationScoringRules;
  const blitz = input.bloodGasBlitz;
  // Only complete six-question v3 runs are assessed by these recommendation rules.
  const phCorrect = blitz?.totalQuestions === rules.bloodGasBlitz.questionCount
    && Number.isInteger(blitz.correctCount) && blitz.correctCount >= 0 && blitz.correctCount <= blitz.totalQuestions
    ? blitz.correctCount : 0;
  const phAccuracy = phCorrect >= rules.bloodGasBlitz.excellentCorrectCount ? 1
    : phCorrect >= rules.bloodGasBlitz.partialCorrectCount ? 0.5 : 0;
  const selection = input.buildAGas?.selectedValues;
  const buildAccuracy = selection ? (
    (rules.buildAGas.answerAccuracy.pH[selection.pH as keyof typeof rules.buildAGas.answerAccuracy.pH] ?? 0)
    + (rules.buildAGas.answerAccuracy.HCO3[selection.HCO3 as keyof typeof rules.buildAGas.answerAccuracy.HCO3] ?? 0)
    + (rules.buildAGas.answerAccuracy.PaCO2[selection.PaCO2 as keyof typeof rules.buildAGas.answerAccuracy.PaCO2] ?? 0)
  ) : 0;
  const compensationAccuracy = input.compensationFit?.selectedAnswer === rules.compensationFit.correctAnswer
    ? rules.compensationFit.accuracy : 0;
  const diagnosis = input.finalDiagnosis?.selectedAnswer;
  const agAccuracy = diagnosis ? rules.finalDiagnosis.answerAccuracy[diagnosis as keyof typeof rules.finalDiagnosis.answerAccuracy] ?? 0 : 0;
  const accuracyPoints = phAccuracy + buildAccuracy + compensationAccuracy + agAccuracy;

  let placement: CalibrationRecommendation = "beginner";
  if (phCorrect >= rules.placement.minimumPhCorrect && buildAccuracy >= rules.placement.foundationBuildAccuracy) {
    placement = compensationAccuracy === 0 ? "intermediate"
      : agAccuracy === 3 && buildAccuracy >= rules.placement.masterBuildAccuracy ? "master"
        : "advanced";
  }
  // Keep the existing result shape; elapsed times remain in the attempt/analytics payload only.
  return { accuracyPoints, speedPoints: 0, totalScore: accuracyPoints, placement };
}
