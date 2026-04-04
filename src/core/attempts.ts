import type { AttemptRecord, AttemptStepResult, CaseData, StepResult } from "./types";

export function mapStepResultsToAttemptStepResults(stepResults: StepResult[]): AttemptStepResult[] {
  return stepResults.map(step => {
    if (step.correct) {
      return {
        key: step.key,
        correct: true
      };
    }

    return {
      key: step.key,
      correct: false,
      chosen: step.chosen,
      correct_answer: step.correctAnswer
    };
  });
}

export function getFinalDiagnosisCorrect(stepResults: StepResult[]): boolean {
  const finalDiagnosisResult = stepResults.find(step => step.key === "final_diagnosis");
  if (finalDiagnosisResult) {
    return finalDiagnosisResult.correct;
  }

  return stepResults.length > 0 && stepResults.every(step => step.correct);
}

export function createAttemptRecord(input: {
  userId: string | null;
  caseItem: CaseData;
  difficultyLabel: string;
  elapsedSeconds: number;
  correctSteps: number;
  totalSteps: number;
  totalXpAward: number;
  completedAt: string;
  stepResults: StepResult[];
  contentVersion: string | null;
}): AttemptRecord {
  const contentVersion = input.contentVersion ?? null;
  if (!contentVersion) {
    console.warn("Missing content_version");
  }

  const accuracyPercent = input.totalSteps > 0
    ? Math.round((input.correctSteps / input.totalSteps) * 100)
    : 0;

  return {
    user_id: input.userId,
    case_id: input.caseItem.case_id ?? null,
    archetype: input.caseItem.archetype ?? null,
    difficulty_label: input.difficultyLabel,
    difficulty_level: Number(input.caseItem.difficulty_level ?? 1),
    mode: "practice",
    xp_total_awarded: input.totalXpAward,
    correct_steps: input.correctSteps,
    total_steps: input.totalSteps,
    elapsed_seconds: Math.max(0, Math.round(input.elapsedSeconds)),
    completed_at: input.completedAt,
    final_diagnosis_correct: getFinalDiagnosisCorrect(input.stepResults),
    accuracy_percent: accuracyPercent,
    step_results_json: mapStepResultsToAttemptStepResults(input.stepResults),
    app_version: __APP_VERSION__,
    content_version: contentVersion
  };
}
