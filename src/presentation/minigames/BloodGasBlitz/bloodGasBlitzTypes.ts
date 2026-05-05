export const BLOOD_GAS_BLITZ_GAME_ID = "blood-gas-blitz" as const;

export type BloodGasBlitzGameId = typeof BLOOD_GAS_BLITZ_GAME_ID;
export type BloodGasBlitzPhase = "ready" | "countdown" | "playing" | "results";
export type BloodGasBlitzAnswerLabel = "Normal" | "Acidaemia" | "Alkalaemia";
export type BloodGasBlitzVersionId = "ph-classification-v1" | "co2-classification-v1";
export type BloodGasBlitzPlayableVersionId = "ph-classification-v1";
export type BloodGasBlitzPlacement = "learn-foundations" | "onboarding-calibration" | "learn-intermediate-card";

export interface BloodGasBlitzQuestion {
  id: string;
  value: number;
  expectedAnswer: BloodGasBlitzAnswerLabel;
}

export interface BloodGasBlitzAnswerAttempt {
  questionId: string;
  questionIndex: number;
  value: number;
  expectedAnswer: BloodGasBlitzAnswerLabel;
  selectedAnswer: BloodGasBlitzAnswerLabel;
  isCorrect: boolean;
  answeredAtMs: number;
}

export interface BloodGasBlitzAttemptResult {
  gameId: BloodGasBlitzGameId;
  versionId: BloodGasBlitzPlayableVersionId;
  placement?: BloodGasBlitzPlacement;
  startedAt: string;
  completedAt: string;
  correctCount: number;
  totalQuestions: number;
  elapsedMs: number;
  accuracy: number;
  averageMsPerQuestion: number;
  maxStreak: number;
  answers: BloodGasBlitzAnswerAttempt[];
}
