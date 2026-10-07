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
  const ordered = [...attempts].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  const scores = ordered.map(attemptPercent).filter((score): score is number => score !== null);
  return {
    attempts: ordered,
    average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    best: scores.length ? Math.max(...scores) : null,
    trend: [...scores].reverse(),
    totalCases: ordered.reduce((sum, row) => sum + row.cases, 0),
    awaiting: ordered.filter(row => row.status !== "completed").length
  };
}
export function attemptPercent(attempt: AttemptPresentation): number | null {
  return attempt.status === "completed" && attempt.awarded !== null && attempt.available > 0
    ? displayPercent(attempt.awarded, attempt.available) : null;
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

