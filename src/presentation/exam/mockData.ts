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
  { id: 1, kind: "mock", title: "Full mock exam", detail: "8 cases · timed", date: "27 Aug 2026", cases: 8, score: 78 },
  { id: 2, kind: "drill", title: "Delta ratio drill", detail: "10 questions", date: "26 Aug 2026", cases: 10, score: 40 },
  { id: 3, kind: "mock", title: "Full mock exam", detail: "10 cases · timed", date: "24 Aug 2026", cases: 10, score: 72 },
  { id: 4, kind: "drill", title: "Compensation drill", detail: "15 questions", date: "22 Aug 2026", cases: 15, score: 67 },
  { id: 5, kind: "mock", title: "Full mock exam", detail: "5 cases · untimed", date: "20 Aug 2026", cases: 5, score: 84 },
  { id: 6, kind: "drill", title: "Anion gap drill", detail: "10 questions", date: "19 Aug 2026", cases: 10, score: 90 },
]


export const prototypeConfig: ExamPrototypeConfig = {
  questionCounts: [5, 10, 15, 20],
  caseMinimum: 5,
  caseMaximum: 10,
  minutesPerDrillQuestion: 0.75,
  minutesPerCase: 4,
  passingTarget: 80
};

export const initialPrototypeState: ExamPrototypeState = {
  view: "exam",
  mode: "drills",
  selectedDrill: "compensation",
  selectedRule: "met-acidosis",
  questionCount: 10,
  caseCount: 8,
  timed: true,
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

