import {
  getAwardableXp,
  getBaseXp,
  getDifficultyLabel,
  getEffectiveXpMultiplier,
  getPerfectBonus,
  getTimeBonus,
  syncUserStateDerivedFields
} from "./progression";
import { markCaseSeen } from "./selection";
import { composeCaseStructuredExplanation } from "./explanations";
import type { AnswerSelection, CaseData, CaseSummary, ProgressionConfig, StepResult, StructuredExplanation, UserState } from "./types";

export function prettyStepLabel(stepKey: string): string {
  const labels: Record<string, string> = {
    ph_status: "pH status",
    primary_disorder: "Primary disorder",
    compensation: "Compensation",
    anion_gap: "Anion gap",
    additional_metabolic_process: "Additional process",
    final_diagnosis: "Diagnosis"
  };
  return labels[stepKey] ?? stepKey.replaceAll("_", " ");
}

export function calcAnionGap(na: number, cl: number, hco3: number): number {
  return na - (cl + hco3);
}

export function getCorrectAnswer(caseItem: CaseData, stepKey: string): string {
  const answerKey = caseItem.answer_key ?? {};

  if (stepKey === "anion_gap") {
    const gas = caseItem.inputs?.gas ?? {};
    const electrolytes = caseItem.inputs?.electrolytes ?? {};
    const gap = calcAnionGap(
      Number(electrolytes.na_mmolL),
      Number(electrolytes.cl_mmolL),
      Number(gas.hco3_mmolL)
    );
    return gap > 16 ? "Raised" : "Normal";
  }

  if (answerKey[stepKey] != null) return answerKey[stepKey];
  if (stepKey === "anion_gap" && answerKey.anion_gap_category) return answerKey.anion_gap_category;
  return "Unknown";
}

export function isCorrectAnswer(caseItem: CaseData, stepKey: string, chosen: string): boolean {
  return chosen === getCorrectAnswer(caseItem, stepKey);
}

export function getQuestionFlowStepStatus(input: {
  caseItem?: CaseData | null;
  stepKey: string;
  stepResult?: StepResult | null;
  stepSelection?: AnswerSelection | null;
  isPastStep?: boolean;
}): "correct" | "incorrect" | "complete" | undefined {
  if (input.stepResult) {
    return input.stepResult.correct ? "correct" : "incorrect";
  }

  if (input.stepSelection?.chosen) {
    if (input.caseItem && Number(input.caseItem.difficulty_level ?? 1) >= 3) {
      return isCorrectAnswer(input.caseItem, input.stepKey, input.stepSelection.chosen)
        ? "correct"
        : "incorrect";
    }

    return "complete";
  }

  return input.isPastStep ? "complete" : undefined;
}

export function buildFinalStepResults(input: {
  caseItem: CaseData;
  selectedAnswers: AnswerSelection[];
  existingStepResults?: StepResult[];
}): StepResult[] {
  return (input.caseItem.questions_flow ?? []).map((step, index) => {
    const existingResult = input.existingStepResults?.[index];
    if (existingResult) return existingResult;

    const selection = input.selectedAnswers[index];
    const chosen = selection?.chosen ?? "";

    return {
      key: step.key,
      label: step.label ?? prettyStepLabel(step.key),
      prompt: step.prompt,
      chosen,
      correctAnswer: getCorrectAnswer(input.caseItem, step.key),
      correct: isCorrectAnswer(input.caseItem, step.key, chosen),
      feedback: null
    };
  });
}

export function reconcileProtectedSummaryWithLockedStepResults(input: {
  summary: CaseSummary;
  lockedStepResults: StepResult[];
  progressionConfig: ProgressionConfig | null;
}): CaseSummary {
  const hasLockedIncorrectStep = input.lockedStepResults.some(result => Boolean(result) && !result.correct);
  if (!hasLockedIncorrectStep) {
    return input.summary;
  }

  const mergedStepResults = buildFinalStepResults({
    caseItem: input.summary.caseData,
    selectedAnswers: input.summary.stepResults.map(result => ({
      key: result.key,
      label: result.label,
      prompt: result.prompt,
      chosen: result.chosen
    })),
    existingStepResults: input.summary.stepResults.map((result, index) => {
      const lockedResult = input.lockedStepResults[index];
      return lockedResult && !lockedResult.correct ? lockedResult : result;
    })
  });

  const totalSteps = mergedStepResults.length;
  const correctSteps = mergedStepResults.filter(result => result.correct).length;
  const accuracy = totalSteps ? Math.round((correctSteps / totalSteps) * 100) : 0;
  const difficultyLevel = Number(input.summary.caseData.difficulty_level ?? 1);
  const perfectBonus = totalSteps > 0 && correctSteps === totalSteps
    ? getPerfectBonus(input.progressionConfig, difficultyLevel)
    : 0;
  const totalXpAward = Math.round(
    (input.summary.baseXp + perfectBonus + input.summary.speedBonus) * getEffectiveXpMultiplier(input.progressionConfig)
  );

  return {
    ...input.summary,
    accuracy,
    correctSteps,
    totalSteps,
    totalXpAward,
    perfectBonus,
    stepResults: mergedStepResults
  };
}

export function normalizeStructuredExplanation(explanation: unknown): StructuredExplanation {
  if (explanation && typeof explanation === "object" && !Array.isArray(explanation)) {
    const typedExplanation = explanation as {
      overview?: unknown;
      sections?: Array<{ key?: unknown; title?: unknown; body?: unknown; order?: unknown }>;
    };

    return {
      overview: String(typedExplanation.overview ?? "").trim(),
      sections: Array.isArray(typedExplanation.sections)
        ? typedExplanation.sections
            .map(section => ({
              key: String(section?.key ?? "").trim() as StructuredExplanation["sections"][number]["key"],
              title: String(section?.title ?? "").trim(),
              body: String(section?.body ?? "").trim(),
              order: Number(section?.order ?? 0)
            }))
            .filter(section => section.key && section.title && section.body)
        : []
    };
  }

  return {
    overview: String(explanation ?? "").trim(),
    sections: []
  };
}

export function canUseClientSidePracticeFeedback(caseItem: CaseData | null | undefined): boolean {
  return Boolean(
    caseItem &&
    Number(caseItem.difficulty_level ?? 1) <= 2 &&
    (!caseItem.protected_payload_mode || caseItem.protected_payload_mode === "practice_learning") &&
    caseItem.answer_key &&
    Object.keys(caseItem.answer_key).length &&
    caseItem.step_feedback &&
    Object.keys(caseItem.step_feedback).length
  );
}

export function todayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function yesterdayKey(now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

export function addBadgeIfMissing(userState: UserState, badge: string): UserState {
  if (userState.badges.includes(badge)) return userState;
  return {
    ...userState,
    badges: [...userState.badges, badge]
  };
}

export function evaluateBadges(userState: UserState): UserState {
  let nextUserState = { ...userState };
  if (nextUserState.casesCompleted >= 1) nextUserState = addBadgeIfMissing(nextUserState, "First case complete");
  if (nextUserState.casesCompleted >= 10) nextUserState = addBadgeIfMissing(nextUserState, "Ten-case round");
  if (nextUserState.streak >= 3) nextUserState = addBadgeIfMissing(nextUserState, "Three-day streak");
  if (nextUserState.level >= 5) nextUserState = addBadgeIfMissing(nextUserState, "Intermediate unlocked");
  return nextUserState;
}

export function updateDailyStreak(userState: UserState, now = new Date()): UserState {
  const today = todayKey(now);
  if (userState.lastCaseDate === today) {
    return {
      ...userState,
      dailyCasesUsed: userState.dailyCasesUsed + 1
    };
  }

  let nextStreak = 1;
  if (userState.lastCaseDate === yesterdayKey(now)) {
    nextStreak = userState.streak + 1;
  }

  return {
    ...userState,
    streak: nextStreak,
    longestStreak: Math.max(userState.longestStreak ?? 0, nextStreak),
    lastCaseDate: today,
    dailyCasesUsed: 1
  };
}

export function createCaseSummary(input: {
  caseItem: CaseData;
  stepResults: StepResult[];
  elapsedSeconds: number;
  totalXpAward: number;
  baseXp: number;
  perfectBonus: number;
  speedBonus: number;
  level: number;
  difficultyLabel: string;
}): CaseSummary {
  const totalSteps = input.caseItem.questions_flow?.length ?? 0;
  const correctSteps = input.stepResults.filter(result => result.correct).length;
  const accuracy = totalSteps ? Math.round((correctSteps / totalSteps) * 100) : 0;

  return {
    caseId: input.caseItem.case_id,
    title: input.caseItem.title ?? "ABG Case",
    difficulty: input.difficultyLabel,
    explanation: input.caseItem.explanation_blueprint?.length
      ? composeCaseStructuredExplanation(input.caseItem, input.stepResults)
      : normalizeStructuredExplanation(input.caseItem.explanation),
    learningObjective: input.caseItem.learning_objective ?? "Review the reasoning steps and pattern recognition for this case.",
    elapsedSeconds: input.elapsedSeconds,
    accuracy,
    correctSteps,
    totalSteps,
    totalXpAward: input.totalXpAward,
    baseXp: input.baseXp,
    perfectBonus: input.perfectBonus,
    speedBonus: input.speedBonus,
    level: input.level,
    stepResults: [...input.stepResults],
    caseData: input.caseItem
  };
}

export function applyPracticeOutcome(input: {
  caseItem: CaseData;
  userState: UserState;
  progressionConfig: ProgressionConfig | null;
  seenCasesByDifficulty: Record<string, string[]>;
  stepResults: StepResult[];
  elapsedSeconds: number;
  timedMode: boolean;
  now?: Date;
}): { userState: UserState; seenCasesByDifficulty: Record<string, string[]>; summary: CaseSummary } {
  const difficultyLevel = Number(input.caseItem.difficulty_level ?? 1);
  const totalSteps = input.caseItem.questions_flow?.length ?? 0;
  const correctSteps = input.stepResults.filter(result => result.correct).length;
  const perfectCase = totalSteps > 0 && correctSteps === totalSteps;
  const baseXp = getBaseXp(input.progressionConfig, difficultyLevel);
  const perfectBonus = perfectCase ? getPerfectBonus(input.progressionConfig, difficultyLevel) : 0;
  const speedBonus = input.timedMode ? getTimeBonus(input.progressionConfig, input.elapsedSeconds) : 0;
  const requestedXpAward = Math.round((baseXp + perfectBonus + speedBonus) * getEffectiveXpMultiplier(input.progressionConfig));
  const totalXpAward = getAwardableXp(input.progressionConfig, input.userState.xp, requestedXpAward);

  let nextUserState: UserState = {
    ...input.userState,
    xp: input.userState.xp + totalXpAward,
    casesCompleted: input.userState.casesCompleted + 1,
    correctAnswers: input.userState.correctAnswers + correctSteps,
    totalAnswers: input.userState.totalAnswers + totalSteps,
    recentResults: [...input.userState.recentResults, correctSteps === totalSteps].slice(-20)
  };

  nextUserState = updateDailyStreak(nextUserState, input.now);
  nextUserState = syncUserStateDerivedFields(nextUserState, input.progressionConfig);
  nextUserState = evaluateBadges(nextUserState);

  const nextSeenCases = markCaseSeen(input.seenCasesByDifficulty, input.caseItem, input.progressionConfig);
  const difficultyLabel = getDifficultyLabel(input.progressionConfig, difficultyLevel);
  const summary = createCaseSummary({
    caseItem: input.caseItem,
    stepResults: input.stepResults,
    elapsedSeconds: input.elapsedSeconds,
    totalXpAward,
    baseXp,
    perfectBonus,
    speedBonus,
    level: nextUserState.level,
    difficultyLabel: difficultyLabel.charAt(0).toUpperCase() + difficultyLabel.slice(1)
  });

  return {
    userState: nextUserState,
    seenCasesByDifficulty: nextSeenCases,
    summary
  };
}

