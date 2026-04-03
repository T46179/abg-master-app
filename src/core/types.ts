export interface RuntimeConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
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

export interface CaseData {
  case_id: string;
  title?: string;
  archetype?: string;
  category?: string;
  clinical_stem?: string;
  difficulty_level?: number;
  difficulty_label?: string;
  learning_objective?: string;
  inputs?: CaseInputs;
  answer_key?: Record<string, string>;
  questions_flow?: QuestionFlowStep[];
  explanation?: string;
}

export interface CasesPayload {
  cases: CaseData[];
  progressionConfig: ProgressionConfig | null;
  defaultUserState: DefaultUserStateSnapshot | null;
  dashboardState: DashboardState | null;
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
  longestStreak?: number;
}

export interface StepResult {
  key: string;
  label: string;
  prompt?: string;
  chosen: string;
  correctAnswer: string;
  correct: boolean;
}

export interface SessionState {
  currentView: string;
  currentDifficulty: string;
  currentStepIndex: number;
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
  caseId: string;
  title: string;
  difficulty: string;
  explanation: string;
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

export interface PracticeFlowState {
  currentCase: CaseData | null;
  lastCaseSummary: CaseSummary | null;
}

export interface StorageInitOptions {
  releaseSignature?: string | null;
  userId?: string | null;
  fallbackUserState?: UserState | null;
  onSyncUnavailable?: (error?: unknown) => void;
  onSaveFailure?: (kind: SaveFailureKind, error?: unknown) => void;
}

export type SaveFailureKind = "save" | "progress" | "attempt";

export interface AttemptRecord {
  user_id?: string | null;
  case_id?: string | null;
  difficulty?: string;
  difficulty_level?: number | null;
  xp_earned?: number;
  correct?: number;
  total_questions?: number;
  time_taken_ms?: number;
  completed_at?: string | null;
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
  difficulty_label: string;
  difficulty_level: number | null;
  xp_total_awarded: number;
  correct_steps: number;
  total_steps: number;
  elapsed_seconds: number;
  completed_at: string | null;
  final_diagnosis_correct: boolean;
  accuracy_percent: number;
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
}

export interface SupabaseSyncAdapter {
  supabaseEnabled: boolean;
  userId: string | null;
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
