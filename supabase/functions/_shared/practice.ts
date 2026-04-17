import { PREPARE_RATE_LIMIT_MAX_REQUESTS, PREPARE_RATE_LIMIT_WINDOW_SECONDS, ISSUED_CASE_TTL_HOURS } from "./constants.ts";
import { corsHeaders } from "./cors.ts";
import type { IssuedCaseSessionRow, PublicCasePayload, PublishedCaseRow, StructuredExplanation } from "./types.ts";

export function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
}


export function errorResponse(code: string, message: string, options?: { recoverable?: boolean; status?: number }) {
  return jsonResponse(
    {
      code,
      message,
      recoverable: Boolean(options?.recoverable)
    },
    {
      status: options?.status ?? 400
    }
  );
}

export function expiresAtIso(now = new Date()) {
  return new Date(now.getTime() + ISSUED_CASE_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export function windowStartIso(now = new Date()) {
  return new Date(now.getTime() - PREPARE_RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
}

export function normalizeDifficultyKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeRecentArchetypes(values: unknown): string[] {
  return Array.isArray(values)
    ? values.map(value => String(value ?? "").trim()).filter(Boolean)
    : [];
}

export function normalizeSeenCaseHints(values: unknown): Record<string, string[]> {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  return Object.fromEntries(
    Object.entries(values as Record<string, unknown>).map(([difficultyKey, caseIds]) => [
      difficultyKey,
      Array.isArray(caseIds)
        ? caseIds.map(caseId => String(caseId ?? "").trim()).filter(Boolean)
        : []
    ])
  );
}

export function chooseCaseForDifficulty(input: {
  cases: PublishedCaseRow[];
  difficultyKey: string;
  seenCaseIdsByDifficulty: Record<string, string[]>;
  recentArchetypes: string[];
}): PublishedCaseRow | null {
  if (!input.cases.length) return null;

  const normalizedDifficulty = normalizeDifficultyKey(input.difficultyKey);
  const exactMatches = input.cases.filter(caseRow => normalizeDifficultyKey(caseRow.difficulty_label) === normalizedDifficulty);
  const pool = exactMatches.length ? exactMatches : [...input.cases];

  const seenCaseIds = new Set(input.seenCaseIdsByDifficulty[normalizedDifficulty] ?? []);
  const unseenCases = pool.filter(caseRow => !seenCaseIds.has(caseRow.case_id));
  const seenCases = pool.filter(caseRow => seenCaseIds.has(caseRow.case_id));

  if (unseenCases.length) {
    const unseenWithoutRecent = unseenCases.filter(caseRow => !input.recentArchetypes.includes(String(caseRow.archetype ?? "")));
    const candidatePool = unseenWithoutRecent.length ? unseenWithoutRecent : unseenCases;
    return candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? null;
  }

  const seenWithoutRecent = seenCases.filter(caseRow => !input.recentArchetypes.includes(String(caseRow.archetype ?? "")));
  const candidatePool = seenWithoutRecent.length ? seenWithoutRecent : seenCases;
  return candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? null;
}

export function calcAnionGap(publicPayload: PublicCasePayload): number {
  const inputs = publicPayload.inputs ?? {};
  const gas = (inputs.gas ?? {}) as Record<string, unknown>;
  const electrolytes = (inputs.electrolytes ?? {}) as Record<string, unknown>;
  return Number(electrolytes.na_mmolL ?? 0) - (Number(electrolytes.cl_mmolL ?? 0) + Number(gas.hco3_mmolL ?? 0));
}

export function getCorrectAnswer(publicPayload: PublicCasePayload, answerKey: Record<string, string>, stepKey: string): string {
  if (stepKey === "anion_gap") {
    return calcAnionGap(publicPayload) > 16 ? "Raised" : "Normal";
  }
  return String(answerKey[stepKey] ?? answerKey.anion_gap_category ?? "Unknown");
}

export function gradeAnswers(input: {
  publicPayload: PublicCasePayload;
  answerKey: Record<string, string>;
  answers: Array<{ key: string; chosen: string }>;
}) {
  const answerMap = new Map(input.answers.map(answer => [answer.key, answer.chosen]));
  const stepResults = (input.publicPayload.questions_flow ?? []).map(step => {
    const chosen = String(answerMap.get(step.key) ?? "");
    const correctAnswer = getCorrectAnswer(input.publicPayload, input.answerKey, step.key);
    return {
      key: step.key,
      label: step.label ?? step.key.replaceAll("_", " "),
      prompt: step.prompt,
      chosen,
      correctAnswer,
      correct: chosen === correctAnswer
    };
  });

  const totalSteps = stepResults.length;
  const correctSteps = stepResults.filter(step => step.correct).length;
  return {
    stepResults,
    totalSteps,
    correctSteps,
    accuracy: totalSteps ? Math.round((correctSteps / totalSteps) * 100) : 0
  };
}

export function getBaseXp(progressionConfig: Record<string, unknown>, difficultyLevel: number): number {
  const baseXpByDifficulty = (progressionConfig.base_xp_by_difficulty ?? {}) as Record<string, number>;
  return Number(baseXpByDifficulty[String(difficultyLevel)] ?? 10);
}

export function getPerfectBonus(progressionConfig: Record<string, unknown>, difficultyLevel: number): number {
  const percentage = Number(progressionConfig.perfect_case_bonus_percent ?? 0);
  return Math.round(getBaseXp(progressionConfig, difficultyLevel) * percentage);
}

export function getEffectiveXpMultiplier(progressionConfig: Record<string, unknown>): number {
  const releaseFlags = (progressionConfig.release_flags ?? {}) as Record<string, number>;
  return Math.max(1, Number(releaseFlags.xp_multiplier ?? 1));
}

export function getTimeBonus(progressionConfig: Record<string, unknown>, elapsedSeconds: number): number {
  const speedBonusTiers = Array.isArray(progressionConfig.speed_bonus_tiers)
    ? (progressionConfig.speed_bonus_tiers as Array<{ max_seconds?: number; bonus?: number }>)
    : [];

  for (const tier of speedBonusTiers) {
    if (elapsedSeconds <= Number(tier.max_seconds ?? Number.POSITIVE_INFINITY)) {
      return Number(tier.bonus ?? 0);
    }
  }
  return 0;
}

export function buildSummary(input: {
  session: IssuedCaseSessionRow;
  publicPayload: PublicCasePayload;
  structuredExplanation: StructuredExplanation;
  progressionConfig: Record<string, unknown>;
  stepResults: Array<{
    key: string;
    label: string;
    prompt?: string;
    chosen: string;
    correctAnswer: string;
    correct: boolean;
  }>;
  totalSteps: number;
  correctSteps: number;
  accuracy: number;
  elapsedSeconds: number;
  timedMode: boolean;
}) {
  const difficultyLevel = Number(input.publicPayload.difficulty_level ?? input.session.difficulty_level ?? 1);
  const baseXp = getBaseXp(input.progressionConfig, difficultyLevel);
  const perfectBonus = input.totalSteps > 0 && input.correctSteps === input.totalSteps
    ? getPerfectBonus(input.progressionConfig, difficultyLevel)
    : 0;
  const speedBonus = input.timedMode ? getTimeBonus(input.progressionConfig, input.elapsedSeconds) : 0;
  const totalXpAward = Math.round((baseXp + perfectBonus + speedBonus) * getEffectiveXpMultiplier(input.progressionConfig));

  return {
    caseToken: input.session.case_token,
    caseId: input.publicPayload.case_id,
    title: input.publicPayload.title ?? "ABG Case",
    difficulty: String(input.publicPayload.difficulty_label ?? input.session.difficulty_label ?? "").replace(/^./, char => char.toUpperCase()),
    learningObjective: input.publicPayload.learning_objective ?? "Review the reasoning for this ABG pattern.",
    elapsedSeconds: input.elapsedSeconds,
    accuracy: input.accuracy,
    correctSteps: input.correctSteps,
    totalSteps: input.totalSteps,
    totalXpAward,
    baseXp,
    perfectBonus,
    speedBonus,
    level: 0,
    caseData: input.publicPayload
  };
}

export function buildIssuedSlot(row: IssuedCaseSessionRow, publicPayload: PublicCasePayload) {
  return {
    caseToken: row.case_token,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    contentVersion: row.content_version,
    difficultyKey: row.difficulty_label,
    caseData: publicPayload
  };
}

export function prepareThrottleMessage() {
  return `Too many prepare requests in ${PREPARE_RATE_LIMIT_WINDOW_SECONDS} seconds. Limit is ${PREPARE_RATE_LIMIT_MAX_REQUESTS}.`;
}
