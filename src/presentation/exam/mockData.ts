// Figma prototype fixtures only; never learner records or grading rules.
import type {
  AttemptPresentation, CaseResultPresentation, DrillPresentation, ExamPrototypeConfig,
  ExamPrototypeState, StepScorePresentation
} from "./presentationTypes";
import { buildHistoryPresentation, buildLatestResultPresentation } from "./presentationModel";

export const mockDrills: DrillPresentation[] = [
  {
    key: "anion-gap",
    title: "Anion Gap",
    blurb: "Calculate and correct the gap, then decide if it's raised.",
    tone: "blue",
    accuracy: 67,
    attempted: 45,
    icon: "gap",
  },
  {
    key: "compensation",
    title: "Compensation",
    blurb: "Apply Winter's and the 1-2-4-5 rule to judge the response.",
    tone: "coral",
    accuracy: 49,
    attempted: 47,
    icon: "scale",
    rules: [
      { key: "met-acidosis", label: "Metabolic acidosis", hint: "Winter's formula" },
      { key: "met-alkalosis", label: "Metabolic alkalosis", hint: "Expected PaCO₂ rise" },
      { key: "respiratory", label: "Respiratory rules", hint: "Acute & chronic, 1-2-4-5" },
    ],
  },
  {
    key: "delta-ratio",
    title: "Delta Ratio",
    blurb: "Unmask a second metabolic process hiding in the numbers.",
    tone: "purple",
    accuracy: 3,
    attempted: 31,
    icon: "split",
  },
  {
    key: "aa-gradient",
    title: "A-a Gradient",
    blurb: "Compute the gradient and judge the cause of hypoxaemia.",
    tone: "green",
    accuracy: 55,
    attempted: 18,
    icon: "lung",
  },
  {
    key: "corrections",
    title: "Glucose / Sodium Correction",
    blurb: "Correct sodium for hyperglycaemia before you interpret it.",
    tone: "coral",
    accuracy: 41,
    attempted: 12,
    icon: "droplet",
  },
]

const resultSteps: StepScorePresentation[] = [
  { label: "pH", correct: 8, total: 8 },
  { label: "Primary disorder", correct: 6, total: 8 },
  { label: "Compensation", correct: 4, total: 8 },
  { label: "Anion gap", correct: 6, total: 8 },
  { label: "Additional metabolic process", correct: 2, total: 8 },
  { label: "Diagnosis", correct: 5, total: 8 },
]

const resultCases: CaseResultPresentation[] = [
  { n: 1, primary: "HAGMA", diagnosis: "Diabetic ketoacidosis", correct: 5, total: 5, time: "3:10" },
  { n: 2, primary: "Mixed", diagnosis: "HAGMA + Respiratory alkalosis", correct: 3, total: 5, time: "4:22" },
  { n: 3, primary: "Respiratory acidosis", diagnosis: "COPD exacerbation", correct: 5, total: 5, time: "2:48" },
  { n: 4, primary: "Metabolic alkalosis", diagnosis: "Vomiting", correct: 4, total: 5, time: "3:31" },
  { n: 5, primary: "Triple", diagnosis: "Postictal lactic acidosis", correct: 2, total: 5, time: "5:04" },
  { n: 6, primary: "NAGMA", diagnosis: "Diarrhoea", correct: 5, total: 5, time: "2:15" },
  { n: 7, primary: "HAGMA", diagnosis: "Salicylate toxicity", correct: 4, total: 5, time: "3:40" },
  { n: 8, primary: "Mixed", diagnosis: "HAGMA + Respiratory acidosis", correct: 3, total: 5, time: "4:12" },
]

const attempts: AttemptPresentation[] = [
  { id: "A-1042", kind: "mock", date: "4 Oct 2026", time: "19:42", finishedAt: "2026-10-04T19:42:00+11:00", exclusions: [], cases: 8, elapsed: "1h 12m", awarded: null, available: 96, status: "pending" },
  { id: "A-1039", kind: "custom", date: "1 Oct 2026", time: "08:15", finishedAt: "2026-10-01T08:15:00+10:00", exclusions: ["Paediatrics", "Toxicology"], cases: 5, elapsed: "41m", awarded: 44, available: 60, status: "completed" },
  { id: "A-1031", kind: "mock", date: "27 Sep 2026", time: "21:03", finishedAt: "2026-09-27T21:03:00+10:00", exclusions: [], cases: 8, elapsed: "1h 18m", awarded: 75, available: 96, status: "completed" },
  { id: "A-1027", kind: "custom", date: "24 Sep 2026", time: "13:30", finishedAt: "2026-09-24T13:30:00+10:00", exclusions: ["Obstetrics"], cases: 6, elapsed: "52m", awarded: null, available: 72, status: "failed" },
  { id: "A-1020", kind: "mock", date: "20 Sep 2026", time: "18:47", finishedAt: "2026-09-20T18:47:00+10:00", exclusions: [], cases: 10, elapsed: "1h 34m", awarded: 82, available: 120, status: "completed" },
  { id: "A-1014", kind: "custom", date: "16 Sep 2026", time: "07:58", finishedAt: "2026-09-16T07:58:00+10:00", exclusions: ["Paediatrics"], cases: 4, elapsed: "29m", awarded: 41, available: 48, status: "completed" },
  { id: "A-1009", kind: "mock", date: "11 Sep 2026", time: "20:20", finishedAt: "2026-09-11T20:20:00+10:00", exclusions: [], cases: 8, elapsed: "1h 21m", awarded: 63, available: 96, status: "completed" },
]


export const prototypeConfig: ExamPrototypeConfig = {
  questionCounts: [5, 10, 15, 20],
  caseMinimum: 3,
  caseMaximum: 5,
  minutesPerDrillQuestion: 0.75,
  minutesPerCase: 12,
  passingTarget: 80
};

export const initialPrototypeState: ExamPrototypeState = {
  view: "exam",
  mode: "drills",
  selectedDrill: "compensation",
  selectedRule: "met-acidosis",
  questionCount: 10,
  caseCount: 3,
  timed: true,
  examKind: "mock",
  excludedCategories: [],
  showRanges: true,
  adaptive: true,
  revealWorking: true,
  historyFilter: "all"
};

export const mockLatestResult = buildLatestResultPresentation({
  cases: resultCases,
  steps: resultSteps,
  sittingLabel: "Mock exam · 27 Aug 2026",
  target: 80,
  casePassThreshold: 4,
  percentileLabel: "Top 38% of recent sittings",
  totalTime: "29:14",
  averageTime: "3:39",
  comparison: "+6%"
});
export const mockHistory = buildHistoryPresentation(attempts);

