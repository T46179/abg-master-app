import type {
  AttemptPresentation, CaseResultPresentation, ExamPrototypeConfig, ExamTone,
  HistoryFilter, HistoryPresentation, LatestResultPresentation, StepScorePresentation
} from "./presentationTypes";

// Display arithmetic for the supplied prototype fixtures, not candidate grading.
export function displayPercent(value: number, total: number): number {
  return total > 0 ? Math.round(value / total * 100) : 0;
}
export function scoreTone(percent: number): ExamTone {
  return percent >= 70 ? "green" : percent >= 50 ? "blue" : "coral";
}
export function buildLatestResultPresentation(input: {
  cases: CaseResultPresentation[];
  steps: StepScorePresentation[];
  sittingLabel: string;
  target: number;
  casePassThreshold: number;
  percentileLabel: string;
  totalTime: string;
  averageTime: string;
  comparison: string;
}): LatestResultPresentation {
  const totalCorrect = input.cases.reduce((sum, row) => sum + row.correct, 0);
  const totalSteps = input.cases.reduce((sum, row) => sum + row.total, 0);
  const cases = input.cases.map(row => ({
    ...row,
    percent: displayPercent(row.correct, row.total),
    passed: row.correct >= input.casePassThreshold
  }));
  return {
    sittingLabel: input.sittingLabel,
    target: input.target,
    percentileLabel: input.percentileLabel,
    totalCorrect,
    totalSteps,
    percent: displayPercent(totalCorrect, totalSteps),
    cases,
    steps: input.steps.map(row => ({ ...row, percent: displayPercent(row.correct, row.total) })),
    summary: [
      { value: `${cases.filter(row => row.passed).length}/${cases.length}`, label: "Cases passed", tone: "green" },
      { value: input.totalTime, label: "Total time" },
      { value: input.averageTime, label: "Avg / case" },
      { value: input.comparison, label: "vs last mock", tone: "green" }
    ]
  };
}
export function buildHistoryPresentation(attempts: AttemptPresentation[]): HistoryPresentation {
  const mocks = attempts.filter(row => row.kind === "mock");
  const average = mocks.length ? Math.round(mocks.reduce((sum, row) => sum + row.score, 0) / mocks.length) : 0;
  const best = mocks.length ? Math.max(...mocks.map(row => row.score)) : 0;
  return {
    attempts,
    summary: [
      { value: String(attempts.length), label: "Total sittings" },
      { value: String(mocks.length), label: "Mock exams" },
      { value: `${average}%`, label: "Avg mock score" },
      { value: `${best}%`, label: "Best mock", tone: "green" }
    ]
  };
}
export function filterAttempts(attempts: AttemptPresentation[], filter: HistoryFilter) {
  return attempts.filter(row => filter === "all" || row.kind === filter);
}
export function buildSetupPresentation(questionCount: number, caseCount: number, timed: boolean, config: ExamPrototypeConfig) {
  const minutes = caseCount * config.minutesPerCase;
  return {
    drillMinutes: Math.round(questionCount * config.minutesPerDrillQuestion),
    timeLimit: timed ? `${minutes}m` : "—",
    estimatedLength: timed ? `${minutes} min` : "Untimed",
    timingHint: timed ? `${config.minutesPerCase} min per case` : "Work at your own pace"
  };
}

