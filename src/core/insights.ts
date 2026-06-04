import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DIFFICULTY_ORDER,
  getBetaReleaseNumber,
  getHighestAccessibleDifficultyKey,
  getLevelProgress,
  getPerformanceReadiness,
  getProgressionVersion,
  getSkillEligibleDifficultyKeys
} from "./progression";
import type { CaseData, PracticeAttemptSummary, ProgressionConfig, UserState } from "./types";

export const INSIGHTS_VIEW_MODEL_VERSION = 1;
export const MIN_INSIGHTS_COMPLETED_CASES = 5;
export const INSIGHTS_RECENT_WINDOW = 10;
export const INSIGHTS_TREND_WINDOW = 10;
export const INSIGHTS_STEP_ACCURACY_WINDOW = 50;
export const INSIGHTS_COMMON_MISS_WINDOW = 50;
export const INSIGHTS_RECENT_CASE_LIMIT = 10;
export const INSIGHTS_ATTEMPT_FETCH_LIMIT = 200;
export const MIN_STEP_ATTEMPTS_FOR_FOCUS = 3;
export const MIN_COMMON_MISS_COUNT = 2;
export const MIN_COMMON_MISS_SAMPLE_SIZE = 5;
export const MIN_COMMON_MISS_RATE_PERCENT = 30;

export const insightsRouteContract = {
  route: "/insights",
  navigationLabel: "Insights",
  navEligible: true,
  navVisible: true
} as const;

const CLINICAL_PATTERN_FALLBACK_LABEL = "Featured Case";
const TREND_STABLE_DELTA_PERCENT = 5;

export const clinicalPatternLabelRegistry: Record<string, string> = {
  acute_copd_exacerbation: "Acute COPD exacerbation",
  alcoholic_ketoacidosis: "Alcoholic ketoacidosis",
  copd_chronic_retainer: "Chronic CO2 retention",
  diarrhoea_nagma: "Diarrhoea with NAGMA",
  diuretic_metabolic_alkalosis: "Diuretic-associated metabolic alkalosis",
  dka: "Diabetic ketoacidosis",
  dka_vomiting: "Diabetic ketoacidosis with vomiting",
  lactic_acidosis: "Lactic acidosis",
  mixed_hagma_metabolic_alkalosis: "Mixed metabolic disorder",
  opioid_toxicity: "Opioid toxicity",
  panic_hyperventilation: "Hyperventilation",
  respiratory_acidosis_hagma: "Respiratory acidosis with HAGMA",
  respiratory_alkalosis_hagma: "Respiratory alkalosis with HAGMA",
  salicylate_toxicity: "Salicylate toxicity",
  sepsis_respiratory_alkalosis: "Sepsis with respiratory alkalosis",
  simple_metabolic_alkalosis: "Metabolic alkalosis",
  simple_nagma: "NAGMA",
  simple_respiratory_acidosis: "Respiratory acidosis",
  simple_respiratory_alkalosis: "Respiratory alkalosis",
  starvation_ketosis: "Starvation ketosis",
  toxic_alcohol: "Toxic alcohol ingestion",
  uraemia: "Uraemia",
  vomiting_metabolic_alkalosis: "Vomiting-associated metabolic alkalosis"
};

const reasoningStepLabelRegistry: Record<string, string> = {
  aa_gradient: "A-a Gradient",
  aa_gradient_mechanism: "A-a Gradient",
  additional_metabolic_process: "Additional Metabolic Process",
  albumin_corrected_anion_gap: "Albumin-Corrected Anion Gap",
  anion_gap: "Anion Gap",
  compensation: "Compensation",
  diagnosis: "Diagnosis",
  final_diagnosis: "Diagnosis",
  osmolar_gap: "Osmolar Gap",
  oxygenation: "Oxygenation",
  oxygenation_status: "Oxygenation",
  pH: "pH",
  pf_ratio_interpretation: "P/F Ratio",
  ph_status: "pH",
  primary_disorder: "Primary Disorder"
};

export const CURRENT_FOCUS_FALLBACK_EXPLANATION = "Focus on reviewing this step when you look back over recent cases.";

export const currentFocusCopyRegistry: Record<string, string> = {
  pH: "Start by classifying the pH: acidaemia, alkalaemia, or normal.",
  ph_status: "Start by classifying the pH: acidaemia, alkalaemia, or normal.",
  primary_disorder: "Use ROME to identify the primary driver of the acid-base disorder.",
  compensation: "Each primary disorder has its own compensation rule. Learn the expected pattern, or use the 1-2-4-5 rule as a shortcut.",
  anion_gap: "Calculate the anion gap in every metabolic acidosis.",
  additional_metabolic_process: "Use the delta ratio to check for another metabolic process hiding in the numbers.",
  oxygenation: "Use PaO₂, SpO₂, FiO₂, and the clinical context to judge oxygenation.",
  oxygenation_status: "Use PaO₂, SpO₂, FiO₂, and the clinical context to judge oxygenation.",
  pf_ratio_interpretation: "Use PaO₂, SpO₂, FiO₂, and the clinical context to judge oxygenation.",
  aa_gradient: "Use the A-a gradient to decide whether hypoxaemia is from hypoventilation or impaired gas exchange.",
  aa_gradient_mechanism: "Use the A-a gradient to decide whether hypoxaemia is from hypoventilation or impaired gas exchange.",
  diagnosis: "Bring each step together into one clear acid-base interpretation.",
  final_diagnosis: "Bring each step together into one clear acid-base interpretation.",
  osmolar_gap: "Check whether an osmolar gap suggests an unmeasured osmole.",
  albumin_corrected_anion_gap: "Adjust the anion gap for albumin before deciding whether it is truly raised."
};

export function getCurrentFocusExplanation(stepKey: string | null | undefined): string {
  return currentFocusCopyRegistry[String(stepKey ?? "")] ?? CURRENT_FOCUS_FALLBACK_EXPLANATION;
}

const reasoningStepOrder = [
  "pH",
  "ph_status",
  "primary_disorder",
  "compensation",
  "anion_gap",
  "additional_metabolic_process",
  "oxygenation",
  "oxygenation_status",
  "pf_ratio_interpretation",
  "aa_gradient",
  "aa_gradient_mechanism",
  "diagnosis",
  "final_diagnosis",
  "osmolar_gap",
  "albumin_corrected_anion_gap"
];

const currentFocusExcludedStepKeys = new Set(["diagnosis", "final_diagnosis"]);

const acidBaseContextRegistry = {
  respiratory_cases: "respiratory cases",
  respiratory_acidosis_cases: "respiratory acidosis cases",
  respiratory_alkalosis_cases: "respiratory alkalosis cases",
  metabolic_acidosis_cases: "metabolic acidosis cases",
  metabolic_alkalosis_cases: "metabolic alkalosis cases",
  raised_anion_gap_metabolic_acidosis_cases: "raised anion gap metabolic acidosis cases",
  mixed_disorder_cases: "mixed disorder cases",
  oxygenation_cases: "oxygenation cases"
} as const;

type AcidBaseContextKey = keyof typeof acidBaseContextRegistry;

const categoryAcidBaseContexts: Record<string, AcidBaseContextKey[]> = {
  metabolic_acidosis_hagma: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  metabolic_acidosis_nagma: ["metabolic_acidosis_cases"],
  metabolic_alkalosis: ["metabolic_alkalosis_cases"],
  mixed_disorder: ["mixed_disorder_cases"],
  triple_disorder: ["mixed_disorder_cases"],
  respiratory_acidosis: ["respiratory_cases", "respiratory_acidosis_cases"],
  respiratory_alkalosis: ["respiratory_cases", "respiratory_alkalosis_cases"]
};

const archetypeAcidBaseContexts: Record<string, AcidBaseContextKey[]> = {
  acute_copd_exacerbation: ["respiratory_cases", "respiratory_acidosis_cases"],
  alcoholic_ketoacidosis: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  copd_chronic_retainer: ["respiratory_cases", "respiratory_acidosis_cases"],
  diarrhoea_nagma: ["metabolic_acidosis_cases"],
  diuretic_metabolic_alkalosis: ["metabolic_alkalosis_cases"],
  dka: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  dka_vomiting: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  lactic_acidosis: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  mixed_hagma_metabolic_alkalosis: ["mixed_disorder_cases", "metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  opioid_toxicity: ["respiratory_cases", "respiratory_acidosis_cases"],
  panic_hyperventilation: ["respiratory_cases", "respiratory_alkalosis_cases"],
  respiratory_acidosis_hagma: ["mixed_disorder_cases", "respiratory_cases", "respiratory_acidosis_cases", "metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  respiratory_alkalosis_hagma: ["mixed_disorder_cases", "respiratory_cases", "respiratory_alkalosis_cases", "metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  salicylate_toxicity: ["mixed_disorder_cases", "respiratory_cases", "respiratory_alkalosis_cases", "metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  sepsis_respiratory_alkalosis: ["respiratory_cases", "respiratory_alkalosis_cases"],
  simple_metabolic_alkalosis: ["metabolic_alkalosis_cases"],
  simple_nagma: ["metabolic_acidosis_cases"],
  simple_respiratory_acidosis: ["respiratory_cases", "respiratory_acidosis_cases"],
  simple_respiratory_alkalosis: ["respiratory_cases", "respiratory_alkalosis_cases"],
  starvation_ketosis: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  toxic_alcohol: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  uraemia: ["metabolic_acidosis_cases", "raised_anion_gap_metabolic_acidosis_cases"],
  vomiting_metabolic_alkalosis: ["metabolic_alkalosis_cases"]
};

const oxygenationStepKeys = new Set(["oxygenation", "oxygenation_status", "aa_gradient", "aa_gradient_mechanism", "pf_ratio_interpretation"]);

const commonMissPatternPriority = [
  ["compensation", "respiratory_cases"],
  ["compensation", "metabolic_acidosis_cases"],
  ["additional_metabolic_process", "mixed_disorder_cases"],
  ["diagnosis", "mixed_disorder_cases"],
  ["final_diagnosis", "mixed_disorder_cases"],
  ["anion_gap", "metabolic_acidosis_cases"],
  ["anion_gap", "raised_anion_gap_metabolic_acidosis_cases"],
  ["oxygenation", "oxygenation_cases"],
  ["oxygenation_status", "oxygenation_cases"],
  ["aa_gradient", "oxygenation_cases"],
  ["aa_gradient_mechanism", "oxygenation_cases"]
] as const;

const commonMissPatternPriorityByPair = new Map(
  commonMissPatternPriority.map(([stepKey, contextKey], index) => [`${stepKey}::${contextKey}`, index])
);

const authoredCaseMetadataRegistry: Record<string, Pick<CaseData, "case_features" | "source_type">> = {
  AUTHORED_001: { source_type: "authored" },
  AUTHORED_002: { source_type: "authored" },
  AUTHORED_003: { source_type: "authored" },
  AUTHORED_004: { source_type: "authored", case_features: ["true_abg", "oxygenation_focus"] },
  AUTHORED_005: { source_type: "authored", case_features: ["true_abg", "oxygenation_focus"] }
};

export interface InsightsAttemptRow {
  id: string;
  caseId: string;
  clinicalPatternKey: string | null;
  difficulty: string;
  difficultyLevel: number;
  correctSteps: number;
  totalSteps: number;
  accuracyPercent: number | null;
  finalDiagnosisCorrect: boolean | null;
  stepResults: unknown;
  completedAt: string;
  contentVersion: string | null;
}

export interface RecentAccuracyModel {
  valuePercent: number | null;
  correctSteps: number;
  totalSteps: number;
  windowSize: number;
  enoughData: boolean;
}

export interface AccuracyTrendModel {
  recentPercent: number | null;
  previousPercent: number | null;
  deltaPercent: number | null;
  direction: "improving" | "stable" | "declining" | "insufficient_data";
  recentWindowSize: number;
  previousWindowSize: number;
}

export interface ReasoningStepAccuracyItem {
  stepKey: string;
  label: string;
  correct: number;
  attempts: number;
  accuracyPercent: number | null;
  enoughData: boolean;
}

export interface InsightsFocusModel {
  state: "available" | "insufficient_data" | "none";
  stepKey?: string;
  label?: string;
  accuracyPercent?: number;
  attempts?: number;
  explanation?: string;
}

export interface InsightsCommonMissPatternModel {
  state: "available" | "insufficient_data" | "none";
  stepKey?: string;
  stepLabel?: string;
  contextKey?: string;
  contextLabel?: string;
  missCount?: number;
  sampleSize?: number;
  missRatePercent?: number;
  headline?: string;
  detail?: string;
}

export interface InsightsCoverageModel {
  encounteredCount: number;
  totalCount: number | null;
  coveragePercent: number | null;
  encounteredPatterns: Array<{
    key: string;
    label: string;
    attempts: number;
  }>;
}

export interface DifficultyProgressItem {
  difficulty: string;
  completedCount: number;
  recentAccuracyPercent: number | null;
  allTimeAccuracyPercent: number | null;
  enoughData: boolean;
}

export interface InsightsUnlockReadinessModel {
  state: "available" | "not_applicable" | "insufficient_data";
  nextDifficulty?: string;
  currentPercent?: number;
  requiredPercent?: number;
  eligibleAttemptsUsed?: number;
  requiredAttempts?: number;
  status?: "ready" | "locked" | "unlocked" | "blocked";
}

export interface RecentCaseReviewItem {
  caseId: string;
  completedAt: string;
  difficulty: string;
  accuracyPercent: number | null;
  correctSteps: number;
  totalSteps: number;
  missedSteps: Array<{
    stepKey: string;
    label: string;
  }>;
  clinicalPatternLabel?: string;
  caseMetadata?: Pick<CaseData, "case_features" | "source_type">;
  canReview: boolean;
  reviewHref?: string;
}

export interface InsightsCtaItem {
  label: string;
  href: string;
  kind: "practice" | "learn" | "review" | "dashboard";
}

export interface InsightsMetricCardModel {
  key: string;
  label: string;
  value: string | number | null;
  enoughData: boolean;
}

export interface InsightsLockedViewModel {
  viewModelVersion: typeof INSIGHTS_VIEW_MODEL_VERSION;
  state: "locked";
  currentLevelLabel: string;
  casesCompleted: number;
  casesRequired: number;
  casesRemaining: number;
  practiceHref: string;
}

export interface InsightsReadyViewModel {
  viewModelVersion: typeof INSIGHTS_VIEW_MODEL_VERSION;
  state: "ready";
  currentLevelLabel: string;
  recentAccuracy: RecentAccuracyModel;
  accuracyTrend: AccuracyTrendModel;
  reasoningStepAccuracy: ReasoningStepAccuracyItem[];
  currentFocus: InsightsFocusModel;
  commonMissPattern: InsightsCommonMissPatternModel;
  clinicalPatternCoverage: InsightsCoverageModel;
  difficultyProgress: DifficultyProgressItem[];
  unlockReadiness: InsightsUnlockReadinessModel;
  recentCaseReview: RecentCaseReviewItem[];
  primaryCtas: InsightsCtaItem[];
}

export interface InsightsUnavailableViewModel {
  viewModelVersion: typeof INSIGHTS_VIEW_MODEL_VERSION;
  state: "unavailable" | "unauthenticated" | "loading";
  messageKey: string;
  practiceHref?: string;
  dashboardHref?: string;
}

export type InsightsViewModel =
  | InsightsLockedViewModel
  | InsightsReadyViewModel
  | InsightsUnavailableViewModel;

interface ClinicalPatternContext {
  safeKeyByPatternKey: Map<string, string>;
  labelByPatternKey: Map<string, string>;
}

interface ParsedStepResult {
  stepKey: string;
  correct: boolean;
}

interface InsightsAttemptDbRow {
  id?: unknown;
  case_id?: unknown;
  archetype?: unknown;
  difficulty_label?: unknown;
  difficulty_level?: unknown;
  correct_steps?: unknown;
  total_steps?: unknown;
  accuracy_percent?: unknown;
  final_diagnosis_correct?: unknown;
  step_results_json?: unknown;
  completed_at?: unknown;
  content_version?: unknown;
}

export function createInsightsLoadingViewModel(): InsightsUnavailableViewModel {
  return {
    viewModelVersion: INSIGHTS_VIEW_MODEL_VERSION,
    state: "loading",
    messageKey: "insights.loading"
  };
}

export function createInsightsUnavailableViewModel(messageKey = "insights.unavailable"): InsightsUnavailableViewModel {
  return {
    viewModelVersion: INSIGHTS_VIEW_MODEL_VERSION,
    state: "unavailable",
    messageKey,
    practiceHref: "/practice",
    dashboardHref: "/dashboard"
  };
}

export function createInsightsUnauthenticatedViewModel(): InsightsUnavailableViewModel {
  return {
    viewModelVersion: INSIGHTS_VIEW_MODEL_VERSION,
    state: "unauthenticated",
    messageKey: "insights.unauthenticated",
    practiceHref: "/practice",
    dashboardHref: "/dashboard"
  };
}

function normalizePercent(correct: number, total: number): number | null {
  return total > 0 ? Math.round((correct / total) * 100) : null;
}

function normalizeCount(value: unknown): number {
  return Math.max(0, Math.round(Number(value ?? 0) || 0));
}

function getStepLabel(stepKey: string): string {
  return reasoningStepLabelRegistry[stepKey] ?? stepKey.replaceAll("_", " ");
}

function getStepOrder(stepKey: string): number {
  const index = reasoningStepOrder.indexOf(stepKey);
  return index >= 0 ? index : reasoningStepOrder.length;
}

function getClinicalPatternLabel(clinicalPatternKey: string): string {
  return clinicalPatternLabelRegistry[clinicalPatternKey] ?? CLINICAL_PATTERN_FALLBACK_LABEL;
}

function getGasSummarySubLabel(caseItem: CaseData | undefined): string | null {
  const sub = String(caseItem?.display?.gas_summary?.sub ?? "").trim();
  return sub || null;
}

function getCoveragePatternLabel(input: {
  patternKey: string;
  matchingAttempts: InsightsAttemptRow[];
  availableCases: CaseData[] | undefined;
  difficultyKey: string;
}): string {
  const caseById = new Map((input.availableCases ?? []).map(caseItem => [normalizeCaseId(caseItem.case_id), caseItem]));

  for (const attempt of input.matchingAttempts) {
    if (attempt.clinicalPatternKey !== input.patternKey) continue;
    const exactLabel = getGasSummarySubLabel(caseById.get(normalizeCaseId(attempt.caseId)));
    if (exactLabel) return exactLabel;
  }

  const matchingCase = (input.availableCases ?? []).find(caseItem =>
    String(caseItem.difficulty_label ?? "").trim().toLowerCase() === input.difficultyKey &&
    String(caseItem.archetype ?? "").trim() === input.patternKey &&
    Boolean(getGasSummarySubLabel(caseItem))
  );

  return getGasSummarySubLabel(matchingCase) ?? getClinicalPatternLabel(input.patternKey);
}

function getPatternGasSummarySubLabel(input: {
  patternKey: string | null;
  difficultyKey: string;
  availableCases: CaseData[] | undefined;
}): string | null {
  if (!input.patternKey) return null;
  const matchingCase = (input.availableCases ?? []).find(caseItem =>
    String(caseItem.difficulty_label ?? "").trim().toLowerCase() === input.difficultyKey &&
    String(caseItem.archetype ?? "").trim() === input.patternKey &&
    Boolean(getGasSummarySubLabel(caseItem))
  );
  return getGasSummarySubLabel(matchingCase);
}

function normalizeCaseId(value: string) {
  return String(value ?? "").trim().toUpperCase();
}

function getProtectedRuntimeCaseMetadata(caseId: string): Pick<CaseData, "case_features" | "source_type"> | undefined {
  const normalizedCaseId = normalizeCaseId(caseId);
  return authoredCaseMetadataRegistry[normalizedCaseId] ?? (
    normalizedCaseId.startsWith("AUTHORED_") ? { source_type: "authored" } : undefined
  );
}

function parseStepResults(source: unknown): ParsedStepResult[] {
  if (!Array.isArray(source)) return [];

  return source.flatMap(item => {
    const result = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const stepKey = String(result.key ?? "").trim();
    if (!stepKey || typeof result.correct !== "boolean") return [];
    return [{
      stepKey,
      correct: result.correct
    }];
  });
}

function getUniqueAcidBaseContexts(contexts: AcidBaseContextKey[]): AcidBaseContextKey[] {
  return Array.from(new Set(contexts));
}

function getAcidBaseContextsForAttempt(
  attempt: InsightsAttemptRow,
  caseById: Map<string, CaseData>
): AcidBaseContextKey[] {
  const caseItem = caseById.get(normalizeCaseId(attempt.caseId));
  const contexts: AcidBaseContextKey[] = [];
  const category = String(caseItem?.category ?? "").trim().toLowerCase();
  const archetype = String(caseItem?.archetype ?? attempt.clinicalPatternKey ?? "").trim();

  if (category && categoryAcidBaseContexts[category]) {
    contexts.push(...categoryAcidBaseContexts[category]);
  } else if (archetype && archetypeAcidBaseContexts[archetype]) {
    contexts.push(...archetypeAcidBaseContexts[archetype]);
  }

  const caseFeatures = Array.isArray(caseItem?.case_features) ? caseItem.case_features : [];
  const hasOxygenationFeature = caseFeatures.some(feature => {
    const normalizedFeature = String(feature ?? "").trim().toLowerCase();
    return normalizedFeature === "oxygenation_focus" || normalizedFeature === "true_abg";
  });
  const hasOxygenationStep = parseStepResults(attempt.stepResults)
    .some(step => oxygenationStepKeys.has(step.stepKey));

  if (hasOxygenationFeature || hasOxygenationStep) {
    contexts.push("oxygenation_cases");
  }

  return getUniqueAcidBaseContexts(contexts);
}

export function compareInsightsAttemptsByRecency(left: Pick<InsightsAttemptRow, "completedAt" | "id">, right: Pick<InsightsAttemptRow, "completedAt" | "id">): number {
  const leftCompleted = Date.parse(left.completedAt);
  const rightCompleted = Date.parse(right.completedAt);
  if (leftCompleted !== rightCompleted) {
    return (Number.isFinite(rightCompleted) ? rightCompleted : 0) - (Number.isFinite(leftCompleted) ? leftCompleted : 0);
  }

  return String(right.id).localeCompare(String(left.id));
}

export function sortInsightsAttemptsByRecency(attempts: InsightsAttemptRow[]): InsightsAttemptRow[] {
  return [...attempts].sort(compareInsightsAttemptsByRecency);
}

export function normalizeInsightsAttemptRow(source: InsightsAttemptDbRow): InsightsAttemptRow | null {
  const id = String(source.id ?? "").trim();
  const caseId = String(source.case_id ?? "").trim();
  const completedAt = String(source.completed_at ?? "").trim();
  const difficulty = String(source.difficulty_label ?? "").trim().toLowerCase();
  const totalSteps = normalizeCount(source.total_steps);
  const correctSteps = Math.min(normalizeCount(source.correct_steps), totalSteps);

  if (!id || !caseId || !completedAt || !difficulty || totalSteps <= 0) return null;

  return {
    id,
    caseId,
    clinicalPatternKey: String(source.archetype ?? "").trim() || null,
    difficulty,
    difficultyLevel: Math.max(1, Math.round(Number(source.difficulty_level ?? 1) || 1)),
    correctSteps,
    totalSteps,
    accuracyPercent: source.accuracy_percent == null
      ? normalizePercent(correctSteps, totalSteps)
      : Math.max(0, Math.min(100, Math.round(Number(source.accuracy_percent) || 0))),
    finalDiagnosisCorrect: source.final_diagnosis_correct == null ? null : Boolean(source.final_diagnosis_correct),
    stepResults: source.step_results_json,
    completedAt,
    contentVersion: source.content_version == null ? null : String(source.content_version)
  };
}

function buildClinicalPatternContext(attempts: InsightsAttemptRow[]): ClinicalPatternContext {
  const encounteredKeys = Array.from(new Set(
    attempts.map(attempt => attempt.clinicalPatternKey).filter((key): key is string => Boolean(key))
  )).sort();

  return {
    safeKeyByPatternKey: new Map(encounteredKeys.map((key, index) => [key, `clinical-pattern-${index + 1}`])),
    labelByPatternKey: new Map(encounteredKeys.map(key => [key, getClinicalPatternLabel(key)]))
  };
}

function buildRecentAccuracy(attempts: InsightsAttemptRow[]): RecentAccuracyModel {
  const recentAttempts = attempts.slice(0, INSIGHTS_RECENT_WINDOW);
  const correctSteps = recentAttempts.reduce((sum, attempt) => sum + attempt.correctSteps, 0);
  const totalSteps = recentAttempts.reduce((sum, attempt) => sum + attempt.totalSteps, 0);

  return {
    valuePercent: normalizePercent(correctSteps, totalSteps),
    correctSteps,
    totalSteps,
    windowSize: recentAttempts.length,
    enoughData: recentAttempts.length > 0 && totalSteps > 0
  };
}

function buildAccuracyTrend(attempts: InsightsAttemptRow[]): AccuracyTrendModel {
  const recentAttempts = attempts.slice(0, INSIGHTS_TREND_WINDOW);
  const previousAttempts = attempts.slice(INSIGHTS_TREND_WINDOW, INSIGHTS_TREND_WINDOW * 2);
  const recentCorrect = recentAttempts.reduce((sum, attempt) => sum + attempt.correctSteps, 0);
  const recentTotal = recentAttempts.reduce((sum, attempt) => sum + attempt.totalSteps, 0);
  const previousCorrect = previousAttempts.reduce((sum, attempt) => sum + attempt.correctSteps, 0);
  const previousTotal = previousAttempts.reduce((sum, attempt) => sum + attempt.totalSteps, 0);
  const recentPercent = normalizePercent(recentCorrect, recentTotal);
  const previousPercent = normalizePercent(previousCorrect, previousTotal);
  const deltaPercent = recentPercent == null || previousPercent == null ? null : recentPercent - previousPercent;

  let direction: AccuracyTrendModel["direction"] = "insufficient_data";
  if (deltaPercent != null) {
    if (Math.abs(deltaPercent) < TREND_STABLE_DELTA_PERCENT) {
      direction = "stable";
    } else {
      direction = deltaPercent > 0 ? "improving" : "declining";
    }
  }

  return {
    recentPercent,
    previousPercent,
    deltaPercent,
    direction,
    recentWindowSize: recentAttempts.length,
    previousWindowSize: previousAttempts.length
  };
}

function buildReasoningStepAccuracy(attempts: InsightsAttemptRow[]): ReasoningStepAccuracyItem[] {
  const stepStats = new Map<string, { correct: number; attempts: number }>();
  const stepAccuracyAttempts = attempts.slice(0, INSIGHTS_STEP_ACCURACY_WINDOW);

  stepAccuracyAttempts.forEach(attempt => {
    parseStepResults(attempt.stepResults).forEach(stepResult => {
      const current = stepStats.get(stepResult.stepKey) ?? { correct: 0, attempts: 0 };
      current.attempts += 1;
      if (stepResult.correct) current.correct += 1;
      stepStats.set(stepResult.stepKey, current);
    });
  });

  return Array.from(stepStats.entries())
    .map(([stepKey, stats]) => ({
      stepKey,
      label: getStepLabel(stepKey),
      correct: stats.correct,
      attempts: stats.attempts,
      accuracyPercent: normalizePercent(stats.correct, stats.attempts),
      enoughData: stats.attempts >= MIN_STEP_ATTEMPTS_FOR_FOCUS
    }))
    .sort((left, right) => {
      const orderDelta = getStepOrder(left.stepKey) - getStepOrder(right.stepKey);
      if (orderDelta !== 0) return orderDelta;
      return left.label.localeCompare(right.label);
    });
}

function buildCurrentFocus(steps: ReasoningStepAccuracyItem[]): InsightsFocusModel {
  if (!steps.length) return { state: "none" };

  const eligibleSteps = steps.filter(step =>
    step.enoughData &&
    step.accuracyPercent != null &&
    !currentFocusExcludedStepKeys.has(step.stepKey)
  );
  if (!eligibleSteps.length) return { state: "insufficient_data" };

  const weakest = [...eligibleSteps].sort((left, right) => {
    if ((left.accuracyPercent ?? 0) !== (right.accuracyPercent ?? 0)) {
      return (left.accuracyPercent ?? 0) - (right.accuracyPercent ?? 0);
    }
    return right.attempts - left.attempts;
  })[0];

  return {
    state: "available",
    stepKey: weakest.stepKey,
    label: weakest.label,
    accuracyPercent: weakest.accuracyPercent ?? undefined,
    attempts: weakest.attempts,
    explanation: getCurrentFocusExplanation(weakest.stepKey)
  };
}

function buildCommonMissPattern(attempts: InsightsAttemptRow[], availableCases: CaseData[] = []): InsightsCommonMissPatternModel {
  const caseById = new Map(availableCases.map(caseItem => [normalizeCaseId(caseItem.case_id), caseItem]));
  const commonMissAttempts = attempts.slice(0, INSIGHTS_COMMON_MISS_WINDOW);
  const pairs = new Map<string, {
    stepKey: string;
    contextKey: AcidBaseContextKey;
    missCount: number;
    sampleSize: number;
  }>();

  commonMissAttempts.forEach(attempt => {
    const contexts = getAcidBaseContextsForAttempt(attempt, caseById);
    const stepResults = parseStepResults(attempt.stepResults);
    if (!contexts.length || !stepResults.length) return;

    contexts.forEach(contextKey => {
      stepResults.forEach(step => {
        const pairKey = `${step.stepKey}::${contextKey}`;
        const current = pairs.get(pairKey) ?? {
          stepKey: step.stepKey,
          contextKey,
          missCount: 0,
          sampleSize: 0
        };
        current.sampleSize += 1;
        if (!step.correct) current.missCount += 1;
        pairs.set(pairKey, current);
      });
    });
  });

  const candidates = Array.from(pairs.values()).map(pair => ({
    ...pair,
    missRatePercent: normalizePercent(pair.missCount, pair.sampleSize) ?? 0,
    priority: commonMissPatternPriorityByPair.get(`${pair.stepKey}::${pair.contextKey}`) ?? commonMissPatternPriority.length
  }));

  if (!candidates.length) return { state: "none" };

  const qualifyingCandidates = candidates.filter(candidate =>
    candidate.missCount >= MIN_COMMON_MISS_COUNT &&
    candidate.sampleSize >= MIN_COMMON_MISS_SAMPLE_SIZE &&
    candidate.missRatePercent >= MIN_COMMON_MISS_RATE_PERCENT
  );

  if (!qualifyingCandidates.length) {
    return candidates.some(candidate => candidate.missCount > 0) ? { state: "insufficient_data" } : { state: "none" };
  }

  const strongest = qualifyingCandidates.sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.missCount !== right.missCount) return right.missCount - left.missCount;
    if (left.missRatePercent !== right.missRatePercent) return right.missRatePercent - left.missRatePercent;
    if (left.sampleSize !== right.sampleSize) return right.sampleSize - left.sampleSize;
    return getStepLabel(left.stepKey).localeCompare(getStepLabel(right.stepKey));
  })[0];
  const stepLabel = getStepLabel(strongest.stepKey);
  const contextLabel = acidBaseContextRegistry[strongest.contextKey];

  return {
    state: "available",
    stepKey: strongest.stepKey,
    stepLabel,
    contextKey: strongest.contextKey,
    contextLabel,
    missCount: strongest.missCount,
    sampleSize: strongest.sampleSize,
    missRatePercent: strongest.missRatePercent,
    headline: `You seem more likely to miss ${stepLabel.toLowerCase()} when completing ${contextLabel}.`,
    detail: `You answered this incorrectly ${strongest.missCount} out of ${strongest.sampleSize} times (${strongest.missRatePercent}%) in this context.`
  };
}

function buildClinicalPatternCoverage(
  attempts: InsightsAttemptRow[],
  clinicalPatterns: ClinicalPatternContext,
  availableCases: CaseData[] | undefined,
  difficultyKey: string
): InsightsCoverageModel {
  const attemptCounts = new Map<string, number>();
  const matchingAttempts = attempts.filter(attempt => attempt.difficulty === difficultyKey);

  matchingAttempts.forEach(attempt => {
    if (!attempt.clinicalPatternKey) return;
    attemptCounts.set(attempt.clinicalPatternKey, (attemptCounts.get(attempt.clinicalPatternKey) ?? 0) + 1);
  });

  const totalPatternKeys = Array.isArray(availableCases)
    ? new Set(availableCases
      .filter(caseItem => String(caseItem.difficulty_label ?? "").trim().toLowerCase() === difficultyKey)
      .map(caseItem => String(caseItem.archetype ?? "").trim())
      .filter(Boolean)).size
    : null;
  const encounteredPatterns = Array.from(attemptCounts.entries())
    .map(([patternKey, attemptsCount]) => ({
      key: clinicalPatterns.safeKeyByPatternKey.get(patternKey) ?? "clinical-pattern",
      label: getCoveragePatternLabel({
        patternKey,
        matchingAttempts,
        availableCases,
        difficultyKey
      }),
      attempts: attemptsCount
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    encounteredCount: encounteredPatterns.length,
    totalCount: totalPatternKeys && totalPatternKeys > 0 ? totalPatternKeys : null,
    coveragePercent: totalPatternKeys && totalPatternKeys > 0
      ? Math.round((encounteredPatterns.length / totalPatternKeys) * 100)
      : null,
    encounteredPatterns
  };
}

function buildDifficultyProgress(attempts: InsightsAttemptRow[]): DifficultyProgressItem[] {
  const difficultyGroups = new Map<string, InsightsAttemptRow[]>();
  attempts.forEach(attempt => {
    const group = difficultyGroups.get(attempt.difficulty) ?? [];
    group.push(attempt);
    difficultyGroups.set(attempt.difficulty, group);
  });

  return Array.from(difficultyGroups.entries())
    .map(([difficulty, group]) => {
      const recent = group.slice(0, INSIGHTS_RECENT_WINDOW);
      const recentCorrect = recent.reduce((sum, attempt) => sum + attempt.correctSteps, 0);
      const recentTotal = recent.reduce((sum, attempt) => sum + attempt.totalSteps, 0);
      const allCorrect = group.reduce((sum, attempt) => sum + attempt.correctSteps, 0);
      const allTotal = group.reduce((sum, attempt) => sum + attempt.totalSteps, 0);

      return {
        difficulty,
        completedCount: group.length,
        recentAccuracyPercent: normalizePercent(recentCorrect, recentTotal),
        allTimeAccuracyPercent: normalizePercent(allCorrect, allTotal),
        enoughData: group.length >= MIN_STEP_ATTEMPTS_FOR_FOCUS
      };
    })
    .sort((left, right) => {
      const leftIndex = DIFFICULTY_ORDER.indexOf(left.difficulty as (typeof DIFFICULTY_ORDER)[number]);
      const rightIndex = DIFFICULTY_ORDER.indexOf(right.difficulty as (typeof DIFFICULTY_ORDER)[number]);
      const leftOrder = leftIndex >= 0 ? leftIndex : DIFFICULTY_ORDER.length;
      const rightOrder = rightIndex >= 0 ? rightIndex : DIFFICULTY_ORDER.length;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.difficulty.localeCompare(right.difficulty);
    });
}

function getNextReadinessDifficulty(userState: UserState): "advanced" | "master" | null {
  const eligible = getSkillEligibleDifficultyKeys(userState);
  if (!eligible.includes("advanced")) return "advanced";
  if (!eligible.includes("master")) return "master";
  return null;
}

function buildUnlockReadiness(
  attempts: InsightsAttemptRow[],
  userState: UserState,
  progressionConfig: ProgressionConfig | null
): InsightsUnlockReadinessModel {
  const nextDifficulty = getNextReadinessDifficulty(userState);
  if (!nextDifficulty) {
    return {
      state: "not_applicable",
      status: "unlocked"
    };
  }

  const summaries: PracticeAttemptSummary[] = attempts.map(attempt => ({
    difficulty: attempt.difficulty,
    correctSteps: attempt.correctSteps,
    totalSteps: attempt.totalSteps,
    completedAt: attempt.completedAt
  }));
  const readiness = getPerformanceReadiness(progressionConfig, nextDifficulty, summaries, { order: "newest_first" });
  const levelProgress = getLevelProgress(progressionConfig, userState);
  const status: InsightsUnlockReadinessModel["status"] = readiness.ready
    ? "ready"
    : levelProgress.isBlockedByReadinessGate && levelProgress.blockedDifficulty === nextDifficulty
      ? "blocked"
      : "locked";

  return {
    state: readiness.enoughData ? "available" : "insufficient_data",
    nextDifficulty,
    currentPercent: readiness.currentPercent ?? undefined,
    requiredPercent: readiness.requiredPercent,
    eligibleAttemptsUsed: readiness.eligibleAttemptsUsed,
    requiredAttempts: readiness.requiredAttempts,
    status
  };
}

function buildRecentCaseReview(
  attempts: InsightsAttemptRow[],
  clinicalPatterns: ClinicalPatternContext,
  availableCases: CaseData[] = []
): RecentCaseReviewItem[] {
  const caseById = new Map(availableCases.map(caseItem => [normalizeCaseId(caseItem.case_id), caseItem]));

  return attempts.slice(0, INSIGHTS_RECENT_CASE_LIMIT).map(attempt => {
    const caseItem = caseById.get(normalizeCaseId(attempt.caseId));
    const protectedRuntimeMetadata = getProtectedRuntimeCaseMetadata(attempt.caseId);
    const missedSteps = parseStepResults(attempt.stepResults)
      .filter(step => !step.correct)
      .map(step => ({
        stepKey: step.stepKey,
        label: getStepLabel(step.stepKey)
      }));

    return {
      caseId: attempt.caseId,
      completedAt: attempt.completedAt,
      difficulty: attempt.difficulty,
      accuracyPercent: attempt.accuracyPercent,
      correctSteps: attempt.correctSteps,
      totalSteps: attempt.totalSteps,
      missedSteps,
      clinicalPatternLabel: attempt.clinicalPatternKey
        ? getGasSummarySubLabel(caseItem)
          ?? getPatternGasSummarySubLabel({
            patternKey: attempt.clinicalPatternKey,
            difficultyKey: attempt.difficulty,
            availableCases
          })
          ?? clinicalPatterns.labelByPatternKey.get(attempt.clinicalPatternKey)
          ?? CLINICAL_PATTERN_FALLBACK_LABEL
        : undefined,
      caseMetadata: caseItem
        ? {
          case_features: caseItem.case_features,
          source_type: caseItem.source_type
        }
        : protectedRuntimeMetadata,
      canReview: false
    };
  });
}

function buildPrimaryCtas(): InsightsCtaItem[] {
  return [
    { label: "Continue practice", href: "/practice", kind: "practice" },
    { label: "Open learning module", href: "/learn", kind: "learn" },
    { label: "Back to dashboard", href: "/dashboard", kind: "dashboard" }
  ];
}

function toDisplayLabel(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "Beginner";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function buildCurrentLevelLabel(input: {
  userState: UserState;
  progressionConfig: ProgressionConfig | null;
  availableCases?: CaseData[];
}) {
  return toDisplayLabel(buildCurrentLevelKey(input));
}

function buildCurrentLevelKey(input: {
  userState: UserState;
  progressionConfig: ProgressionConfig | null;
  availableCases?: CaseData[];
}) {
  return getHighestAccessibleDifficultyKey({
    userState: input.userState,
    progressionConfig: input.progressionConfig,
    cases: input.availableCases ?? []
  });
}

export function buildInsightsViewModel(input: {
  attempts: InsightsAttemptRow[];
  totalAttemptCount?: number | null;
  userState: UserState;
  progressionConfig: ProgressionConfig | null;
  availableCases?: CaseData[];
}): InsightsViewModel {
  const resetAtMs = input.userState.resetAt ? Date.parse(input.userState.resetAt) : NaN;
  const attempts = sortInsightsAttemptsByRecency(input.attempts).filter(attempt => {
    if (!Number.isFinite(resetAtMs)) return true;
    const completedAtMs = Date.parse(attempt.completedAt);
    return Number.isFinite(completedAtMs) && completedAtMs > resetAtMs;
  });
  const casesCompleted = attempts.length;
  const currentLevelLabel = buildCurrentLevelLabel({
    userState: input.userState,
    progressionConfig: input.progressionConfig,
    availableCases: input.availableCases
  });
  const currentLevelKey = buildCurrentLevelKey({
    userState: input.userState,
    progressionConfig: input.progressionConfig,
    availableCases: input.availableCases
  });

  if (casesCompleted < MIN_INSIGHTS_COMPLETED_CASES) {
    return {
      viewModelVersion: INSIGHTS_VIEW_MODEL_VERSION,
      state: "locked",
      currentLevelLabel,
      casesCompleted,
      casesRequired: MIN_INSIGHTS_COMPLETED_CASES,
      casesRemaining: Math.max(0, MIN_INSIGHTS_COMPLETED_CASES - casesCompleted),
      practiceHref: "/practice"
    };
  }

  const clinicalPatterns = buildClinicalPatternContext(attempts);
  const reasoningStepAccuracy = buildReasoningStepAccuracy(attempts);

  return {
    viewModelVersion: INSIGHTS_VIEW_MODEL_VERSION,
    state: "ready",
    currentLevelLabel,
    recentAccuracy: buildRecentAccuracy(attempts),
    accuracyTrend: buildAccuracyTrend(attempts),
    reasoningStepAccuracy,
    currentFocus: buildCurrentFocus(reasoningStepAccuracy),
    commonMissPattern: buildCommonMissPattern(attempts, input.availableCases),
    clinicalPatternCoverage: buildClinicalPatternCoverage(attempts, clinicalPatterns, input.availableCases, currentLevelKey),
    difficultyProgress: buildDifficultyProgress(attempts),
    unlockReadiness: buildUnlockReadiness(attempts, input.userState, input.progressionConfig),
    recentCaseReview: buildRecentCaseReview(attempts, clinicalPatterns, input.availableCases),
    primaryCtas: buildPrimaryCtas()
  };
}

export async function fetchInsightsAttempts(input: {
  supabase: SupabaseClient;
  userId: string;
  progressionConfig: ProgressionConfig | null;
  limit?: number;
}): Promise<{ attempts: InsightsAttemptRow[]; totalAttemptCount: number }> {
  const progressionVersion = getProgressionVersion(input.progressionConfig);
  const betaReleaseNumber = getBetaReleaseNumber(input.progressionConfig);
  const { data, error, count } = await input.supabase
    .from("attempts")
    .select(
      "id, case_id, archetype, difficulty_label, difficulty_level, correct_steps, total_steps, accuracy_percent, final_diagnosis_correct, step_results_json, completed_at, content_version",
      { count: "exact" }
    )
    .eq("user_id", input.userId)
    .eq("mode", "practice")
    .eq("progression_version", progressionVersion)
    .eq("beta_release_number", betaReleaseNumber)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit ?? INSIGHTS_ATTEMPT_FETCH_LIMIT);

  if (error) throw error;

  return {
    attempts: sortInsightsAttemptsByRecency(
      (Array.isArray(data) ? data : [])
        .map(row => normalizeInsightsAttemptRow(row as InsightsAttemptDbRow))
        .filter((row): row is InsightsAttemptRow => Boolean(row))
    ),
    totalAttemptCount: count ?? 0
  };
}
