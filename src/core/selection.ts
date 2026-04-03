import type { CaseData, ProgressionConfig, QuestionFlowStep } from "./types";
import { DIFFICULTY_ORDER, getDifficultyLabel, getDifficultyLevel } from "./progression";

export const RECENT_ARCHETYPE_LIMIT = 2;

export function createEmptySeenCasesState(): Record<string, string[]> {
  return Object.fromEntries(DIFFICULTY_ORDER.map(key => [key, [] as string[]]));
}

export function sanitizeSeenCasesByDifficulty(source: unknown): Record<string, string[]> {
  const sanitized = createEmptySeenCasesState();
  if (!source || typeof source !== "object") return sanitized;

  DIFFICULTY_ORDER.forEach(difficultyKey => {
    const caseIds = Array.isArray((source as Record<string, unknown>)[difficultyKey])
      ? (source as Record<string, unknown[]>)[difficultyKey]
      : [];

    sanitized[difficultyKey] = caseIds
      .map(caseId => String(caseId ?? "").trim())
      .filter((caseId, index, values) => caseId && values.indexOf(caseId) === index);
  });

  return sanitized;
}

export function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function caseMatchesDifficulty(caseItem: CaseData, difficultyKey: string, progressionConfig: ProgressionConfig | null): boolean {
  const level = getDifficultyLevel(progressionConfig, difficultyKey);
  const caseDifficultyLevel = Number(caseItem.difficulty_level ?? 1);
  const caseDifficultyLabel = String(caseItem.difficulty_label ?? getDifficultyLabel(progressionConfig, caseDifficultyLevel)).toLowerCase();
  return caseDifficultyLevel === level || caseDifficultyLabel === difficultyKey;
}

export function getSeenCaseIdsForDifficulty(seenCasesByDifficulty: Record<string, string[]>, difficultyKey: string) {
  return new Set(seenCasesByDifficulty?.[difficultyKey] ?? []);
}

export function getEligibleCasesForDifficulty(options: {
  cases: CaseData[];
  difficultyKey: string;
  progressionConfig: ProgressionConfig | null;
  seenCasesByDifficulty: Record<string, string[]>;
  recentArchetypes: string[];
}): CaseData[] {
  const exactMatches = options.cases.filter(caseItem => caseMatchesDifficulty(caseItem, options.difficultyKey, options.progressionConfig));
  const pool = exactMatches.length ? exactMatches : [...options.cases];

  const seenCaseIds = getSeenCaseIdsForDifficulty(options.seenCasesByDifficulty, options.difficultyKey);
  const unseenCases = pool.filter(caseItem => !seenCaseIds.has(caseItem.case_id));
  const seenCases = pool.filter(caseItem => seenCaseIds.has(caseItem.case_id));

  if (unseenCases.length) {
    const unseenWithoutRecent = unseenCases.filter(caseItem => !options.recentArchetypes.includes(String(caseItem.archetype ?? "")));
    return unseenWithoutRecent.length ? unseenWithoutRecent : unseenCases;
  }

  const seenWithoutRecent = seenCases.filter(caseItem => !options.recentArchetypes.includes(String(caseItem.archetype ?? "")));
  return seenWithoutRecent.length ? seenWithoutRecent : seenCases;
}

export function rememberRecentArchetype(recentArchetypes: string[], caseItem: CaseData): string[] {
  if (!caseItem?.archetype) return recentArchetypes;
  const nextRecentArchetypes = [...recentArchetypes, caseItem.archetype];
  if (nextRecentArchetypes.length > RECENT_ARCHETYPE_LIMIT) {
    nextRecentArchetypes.shift();
  }
  return nextRecentArchetypes;
}

export function markCaseSeen(
  seenCasesByDifficulty: Record<string, string[]>,
  caseItem: CaseData,
  progressionConfig: ProgressionConfig | null
): Record<string, string[]> {
  const difficultyLevel = Number(caseItem?.difficulty_level ?? 1);
  const difficultyKey = getDifficultyLabel(progressionConfig, difficultyLevel);
  const caseId = String(caseItem?.case_id ?? "").trim();
  if (!difficultyKey || !caseId) return seenCasesByDifficulty;

  const nextSeenCases = sanitizeSeenCasesByDifficulty(seenCasesByDifficulty);
  const seenForDifficulty = nextSeenCases[difficultyKey] ?? [];
  if (!seenForDifficulty.includes(caseId)) {
    seenForDifficulty.push(caseId);
  }

  nextSeenCases[difficultyKey] = seenForDifficulty;
  return nextSeenCases;
}

export function normalizeDiagnosisOption(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\/\-(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function diagnosisOptionsOverlap(left: string, right: string): boolean {
  const leftNormalized = normalizeDiagnosisOption(left);
  const rightNormalized = normalizeDiagnosisOption(right);

  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;

  const leftTokens = leftNormalized.split(" ");
  const rightTokens = rightNormalized.split(" ");
  const shorterTokens = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longerTokens = leftTokens.length > rightTokens.length ? leftTokens : rightTokens;

  return shorterTokens.every(token => longerTokens.includes(token));
}

export function getDiagnosisOptionPool(cases: CaseData[]): string[] {
  return cases.flatMap(item => {
    const diagnosisStep = (item?.questions_flow ?? []).find(step => step?.key === "final_diagnosis");

    return [
      item?.answer_key?.final_diagnosis,
      ...(Array.isArray(diagnosisStep?.options) ? diagnosisStep.options : [])
    ].filter(Boolean) as string[];
  });
}

export function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildDiagnosisOptionOverride(caseItem: CaseData, step: QuestionFlowStep, cases: CaseData[]): string[] {
  const targetCount = step.options?.length ?? 0;
  const correctDiagnosis = caseItem?.answer_key?.final_diagnosis;
  const sanitizedOptions: string[] = [];

  function tryAddOption(option: unknown) {
    const trimmedOption = String(option ?? "").trim();
    if (!trimmedOption) return false;

    const duplicate = sanitizedOptions.some(existingOption =>
      existingOption.trim() === trimmedOption ||
      normalizeDiagnosisOption(existingOption) === normalizeDiagnosisOption(trimmedOption) ||
      diagnosisOptionsOverlap(existingOption, trimmedOption)
    );

    if (duplicate) return false;
    sanitizedOptions.push(trimmedOption);
    return true;
  }

  tryAddOption(correctDiagnosis);
  (step.options ?? []).forEach(tryAddOption);
  getDiagnosisOptionPool(cases).forEach(option => {
    if (sanitizedOptions.length < targetCount) {
      tryAddOption(option);
    }
  });

  return shuffleArray(sanitizedOptions);
}

export function buildStepOptionOverrides(caseItem: CaseData, cases: CaseData[]): Record<number, string[]> {
  const overrides: Record<number, string[]> = {};

  (caseItem?.questions_flow ?? []).forEach((step, index) => {
    if (step?.key === "final_diagnosis" && Array.isArray(step.options)) {
      overrides[index] = buildDiagnosisOptionOverride(caseItem, step, cases);
    }
  });

  return overrides;
}
