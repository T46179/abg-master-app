export interface RuntimeConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ENABLE_PROTECTED_CASE_DELIVERY?: boolean;
}

export interface ReleaseFlags {
  enable_all_difficulties: boolean;
  enable_unlimited_cases: boolean;
  enable_learn_preview: boolean;
  xp_multiplier: number;
  enable_beta_badge: boolean;
}

export interface SpeedBonusTier {
  max_seconds?: number;
  bonus?: number;
}

export interface ProgressionConfig {
  release_flags?: Partial<ReleaseFlags>;
  base_xp_by_difficulty?: Record<string, number>;
  perfect_case_bonus_percent?: number;
  speed_bonus_tiers?: SpeedBonusTier[];
  xp_required_per_level?: Record<string, number>;
  difficulty_unlock_levels?: Record<string, number>;
  free_daily_case_limit?: number;
  difficulty_labels?: Record<string, string>;
}

export interface DashboardUserSnapshot {
  subscription_tier?: string;
  total_xp?: number;
  level?: number;
  streak_days?: number;
  cases_completed_today?: number;
  cases_completed?: number;
  unlocked_difficulty?: number;
  unlocked_difficulty_label?: string;
}

export interface DashboardStatsSnapshot {
  cases_completed?: number;
  recent_badges?: string[];
}

export interface DashboardState {
  user?: DashboardUserSnapshot;
  stats?: DashboardStatsSnapshot;
}

export interface DefaultUserStateSnapshot {
  total_xp?: number;
  xp?: number;
  level?: number;
  cases_completed?: number;
  abandoned_cases?: number;
  correct_answers?: number;
  total_answers?: number;
  streak_days?: number;
  streak?: number;
  cases_completed_today?: number;
  dailyCasesUsed?: number;
  lastCaseDate?: string | null;
  unlocked_difficulty?: number;
  unlocked_difficulty_label?: string;
  subscription_tier?: string;
  isPremium?: boolean;
  badges?: string[];
}

export interface CaseGasInputs {
  ph?: number;
  paco2_mmHg?: number;
  hco3_mmolL?: number;
  pao2_mmHg?: number;
  base_excess_mEqL?: number;
}

export interface CaseElectrolyteInputs {
  na_mmolL?: number;
  k_mmolL?: number;
  cl_mmolL?: number;
  glucose_mmolL?: number;
}

export interface CaseInputs {
  gas?: CaseGasInputs;
  electrolytes?: CaseElectrolyteInputs;
  other?: Record<string, unknown>;
  lactate_mmolL?: number;
  [key: string]: unknown;
}

export interface QuestionFlowStep {
  key: string;
  label?: string;
  prompt?: string;
  options?: string[];
}

export const EXPLANATION_DOMAINS = [
  "ph_status",
  "primary_disorder",
  "compensation",
  "anion_gap",
  "additional_metabolic_process",
  "diagnosis",
  "clinical_context",
  "key_takeaway"
] as const;

export type ExplanationDomain = typeof EXPLANATION_DOMAINS[number];
export type ExplanationVariant = "beginner" | "intermediate" | "advanced" | "master";
export type ExplanationKind = "core_reasoning" | "diagnosis" | "clinical_context";

export interface ExplanationBlueprintEntry {
  domain: ExplanationDomain;
  variant: ExplanationVariant;
  title: string;
  body: string;
  order: number;
  kind?: ExplanationKind;
  stepKey?: string | null;
}

export interface ExplanationSection {
  key: ExplanationDomain;
  title: string;
  body: string;
  order: number;
}

export interface StructuredExplanation {
  overview: string;
  sections: ExplanationSection[];
}

export type ResultsExplanationPreferenceKey = "compensation" | "anion_gap" | "clinical_context";
export type ResultsExplanationPreferences = Record<ResultsExplanationPreferenceKey, boolean>;

export interface StepFeedbackEntry {
  key: ExplanationDomain;
  title: string;
  body: string;
  order: number;
}

export interface CaseData {
  case_id: string;
  title?: string;
  archetype?: string;
  category?: string;
  clinical_stem?: string;
  difficulty_level?: number;
  difficulty_label?: string;
  learning_objective?: string;
  protected_payload_mode?: string;
  inputs?: CaseInputs;
  answer_key?: Record<string, string>;
  questions_flow?: QuestionFlowStep[];
  explanation_blueprint?: ExplanationBlueprintEntry[];
  step_feedback?: Record<string, StepFeedbackEntry>;
  explanation?: string | StructuredExplanation;
}

export interface CasesPayload {
  cases: CaseData[];
  progressionConfig: ProgressionConfig | null;
  defaultUserState: DefaultUserStateSnapshot | null;
  dashboardState: DashboardState | null;
  contentVersion: string | null;
  deliveryMode: "public_catalog" | "protected_runtime";
}

export interface UserState {
  xp: number;
  level: number;
  casesCompleted: number;
  abandonedCases: number;
  correctAnswers: number;
  totalAnswers: number;
  streak: number;
  dailyCasesUsed: number;
  lastCaseDate: string | null;
  unlockedDifficulties: string[];
  isPremium: boolean;
  badges: string[];
  recentResults: boolean[];
  appliedProtectedCaseTokens: string[];
  longestStreak?: number;
}

export interface StepResult {
  key: string;
  label: string;
  prompt?: string;
  chosen: string;
  correctAnswer: string;
  correct: boolean;
  feedback?: StepFeedbackEntry | null;
}

export interface AnswerSelection {
  key: string;
  label: string;
  prompt?: string;
  chosen: string;
}

export interface SessionState {
  currentView: string;
  currentDifficulty: string;
  currentStepIndex: number;
  selectedAnswers: AnswerSelection[];
  stepResults: StepResult[];
  stepOptionOverrides: Record<number, string[]>;
  caseStartMs: number | null;
  timedMode: boolean;
  showAdvancedRanges: boolean;
}

export interface AppStatus {
  blocking: { title?: string; message?: string } | null;
  warnings: Record<string, { message?: string }>;
}

export interface CaseSummary {
  caseToken?: string | null;
  caseId: string;
  title: string;
  difficulty: string;
  explanation: StructuredExplanation;
  learningObjective: string;
  elapsedSeconds: number;
  accuracy: number;
  correctSteps: number;
  totalSteps: number;
  totalXpAward: number;
  baseXp: number;
  perfectBonus: number;
  speedBonus: number;
  level: number;
  stepResults: StepResult[];
  caseData: CaseData;
}

export interface IssuedPracticeSlot {
  caseToken: string;
  issuedAt: string;
  expiresAt: string;
  contentVersion: string;
  difficultyKey: string;
  caseData: CaseData;
}

export interface PendingPracticeSubmission {
  caseToken: string;
  caseId: string;
  contentVersion: string;
  difficultyKey: string;
  answers: Array<{ key: string; chosen: string }>;
  elapsedSeconds: number;
  timedMode: boolean;
  clientCompletedAt: string;
}

export type PracticeSyncState = "idle" | "loading_slots" | "submitting" | "pending_retry" | "unavailable";

export interface PracticeFlowState {
  currentCase: CaseData | null;
  currentCaseToken: string | null;
  currentCaseExpiresAt: string | null;
  lastCaseSummary: CaseSummary | null;
  practiceSlotsByDifficulty: Record<string, IssuedPracticeSlot | null>;
  pendingSubmission: PendingPracticeSubmission | null;
  syncState: PracticeSyncState;
  syncMessage: string | null;
}

export interface StorageInitOptions {
  releaseSignature?: string | null;
  userId?: string | null;
  fallbackUserState?: UserState | null;
  onSyncUnavailable?: (error?: unknown) => void;
  onSaveFailure?: (kind: SaveFailureKind, error?: unknown) => void;
}

export type SaveFailureKind = "save" | "progress" | "attempt";

export interface AttemptStepResult {
  key: string;
  correct: boolean;
  chosen?: string;
  correct_answer?: string;
}

export interface AttemptRecord {
  user_id?: string | null;
  case_id?: string | null;
  archetype?: string | null;
  difficulty?: string;
  difficulty_label?: string;
  difficulty_level?: number | null;
  xp_earned?: number;
  xp_total_awarded?: number;
  correct?: number;
  correct_steps?: number;
  total_questions?: number;
  total_steps?: number;
  time_taken_ms?: number;
  elapsed_seconds?: number | null;
  completed_at?: string | null;
  final_diagnosis_correct?: boolean;
  accuracy_percent?: number;
  step_results_json?: AttemptStepResult[];
  app_version?: string | null;
  content_version?: string | null;
  mode?: string | null;
}

export interface ProgressRow {
  user_id: string;
  xp: number;
  level: number;
  streak: number;
  cases_completed: number;
  correct_answers: number;
  total_answers: number;
  last_case_date: string | null;
}

export interface AttemptRow {
  user_id: string | null;
  case_id: string | null;
  archetype: string | null;
  difficulty_label: string;
  difficulty_level: number | null;
  xp_total_awarded: number;
  correct_steps: number;
  total_steps: number;
  elapsed_seconds: number;
  completed_at: string | null;
  final_diagnosis_correct: boolean;
  accuracy_percent: number;
  step_results_json: AttemptStepResult[];
  app_version: string | null;
  content_version: string | null;
  mode: string;
}

export interface StorageAdapter {
  init(options?: StorageInitOptions): Promise<void>;
  loadUserState(): Promise<UserState | null>;
  saveUserState(userState: UserState): Promise<void>;
  resetUserState(): Promise<void>;
  saveAttempt(attempt: AttemptRecord): Promise<void>;
  loadSeenCaseState(): Record<string, string[]>;
  saveSeenCaseState(seenState: Record<string, string[]>): void;
  loadPracticeIntroSeen(): boolean;
  savePracticeIntroSeen(value: boolean): void;
  loadAdvancedRangesPreference(): boolean;
  saveAdvancedRangesPreference(value: boolean): void;
  loadResultsExplanationPreferences(): ResultsExplanationPreferences;
  saveResultsExplanationPreferences(value: ResultsExplanationPreferences): void;
}

export interface SupabaseSyncAdapter {
  supabaseEnabled: boolean;
  userId: string | null;
}

export interface ProtectedPracticePrepareRequest {
  contentVersion?: string | null;
  difficulties: string[];
  selectionHints?: {
    seenCaseIdsByDifficulty?: Record<string, string[]>;
    recentArchetypes?: string[];
  };
}

export interface ProtectedPracticePrepareResponse {
  contentVersion: string;
  slots: Record<string, Omit<IssuedPracticeSlot, "difficultyKey" | "contentVersion"> & { difficultyKey?: string; contentVersion?: string }>;
}

export interface ProtectedPracticeSubmitRequest {
  caseToken: string;
  answers: Array<{ key: string; chosen: string }>;
  elapsedSeconds: number;
  timedMode: boolean;
  clientCompletedAt: string;
}

export interface ProtectedPracticeSubmitResponse {
  summary: {
    caseToken?: string | null;
    caseId: string;
    title: string;
    difficulty: string;
    learningObjective: string;
    elapsedSeconds: number;
    accuracy: number;
    correctSteps: number;
    totalSteps: number;
    totalXpAward: number;
    baseXp: number;
    perfectBonus: number;
    speedBonus: number;
    level: number;
    caseData: CaseData;
  };
  stepResults: StepResult[];
  explanation: StructuredExplanation;
  replacementSlot: Omit<IssuedPracticeSlot, "difficultyKey" | "contentVersion"> & { difficultyKey?: string; contentVersion?: string };
}

export interface ProtectedPracticeErrorResponse {
  code?: string;
  message?: string;
  recoverable?: boolean;
}

export interface CaseMetricDefinition {
  label: string;
  displayLabel: string;
  reference: string;
  value: number | null | undefined;
  decimals: number;
  unit: string;
  abnormal: boolean;
  minDifficultyLevel?: number;
  maxDifficultyLevel?: number;
}
