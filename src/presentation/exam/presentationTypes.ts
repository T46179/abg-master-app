// Presentation-only types. These are not production Exam content or result contracts.
export type ExamView = "exam" | "results" | "history" | "error-log";
export type ExamMode = "drills" | "mock";
export type SittingKind = "mock" | "custom";
export type SpecialistCategory = "mechanical_ventilation" | "toxicology_management";
export type HistoryFilter = "all" | SittingKind;
export type ExamTone = "blue" | "coral" | "purple" | "green" | "navy";
export type DrillIcon = "gap" | "scale" | "split" | "lung" | "droplet";

export interface DrillPresentation {
  key: string;
  title: string;
  blurb: string;
  tone: ExamTone;
  icon: DrillIcon;
  accuracy: number | null;
  attempted: number | null;
  rules?: { key: string; label: string; hint: string }[];
}
export interface ExamPrototypeState {
  view: ExamView;
  mode: ExamMode;
  selectedDrill: string;
  selectedRule: string;
  questionCount: number;
  caseCount: number;
  timed: boolean;
  examKind: SittingKind;
  excludedCategories: SpecialistCategory[];
  showRanges: boolean;
  adaptive: boolean;
  revealWorking: boolean;
  historyFilter: HistoryFilter;
}
export interface ExamPrototypeConfig {
  questionCounts: number[];
  caseMinimum: number;
  caseMaximum: number;
  minutesPerDrillQuestion: number;
  minutesPerCase: number;
  passingTarget: number;
}
export interface StepScorePresentation {
  label: string;
  correct: number;
  total: number;
}
export interface CaseResultPresentation {
  n: number;
  primary: string;
  diagnosis: string;
  correct: number;
  total: number;
  time: string;
}
export interface SummaryTilePresentation {
  value: string;
  label: string;
  tone?: ExamTone;
}
export interface LatestResultPresentation {
  sittingLabel: string;
  target: number;
  percentileLabel: string;
  totalCorrect: number;
  totalSteps: number;
  percent: number;
  cases: (CaseResultPresentation & { percent: number; passed: boolean })[];
  steps: (StepScorePresentation & { percent: number })[];
  summary: SummaryTilePresentation[];
}
export interface AttemptPresentation {
  id: string;
  kind: SittingKind;
  date: string;
  time: string;
  finishedAt: string;
  exclusions: string[];
  cases: number;
  elapsed: string;
  awarded: number | null;
  available: number;
  status: "completed" | "pending" | "failed";
  canRetryGrading?: boolean;
}
export interface HistoryPresentation {
  attempts: AttemptPresentation[];
  submitted?: number;
  counts?: Record<HistoryFilter, number>;
  average: number | null;
  best: number | null;
  trend: number[];
  totalCases: number;
  awaiting: number;
}

