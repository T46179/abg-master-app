import type { ErrorLogConceptPresentation, ErrorLogSavePresentation } from "./errorLogTypes";

// Figma presentation examples only; not an authored catalogue or real attempt history.
export const demoErrorLogConcepts: ErrorLogConceptPresentation[] = [
  {
    id: "ag-albumin", label: "Albumin-corrected anion gap", topic: "Anion Gap", type: "Calculation", lastSaved: "4 Oct",
    examples: [
      { part: "Case 1 · Part 3", prompt: "Calculate the albumin-corrected anion gap.", attempt: "Mock exam", date: "4 Oct" },
      { part: "Case 3 · Part 2", prompt: "Is there a hidden high anion gap acidosis?", attempt: "Mock exam", date: "27 Sep" },
      { part: "Case 6 · Part 1", prompt: "Calculate the anion gap and interpret.", attempt: "Custom exam", date: "16 Sep" },
    ],
  },
  {
    id: "winters", label: "Expected pCO₂ — Winter's formula", topic: "Compensation", type: "Compensation", lastSaved: "1 Oct", reopened: true,
    examples: [
      { part: "Case 5 · Part 3", prompt: "Is the respiratory response appropriate?", attempt: "Custom exam", date: "1 Oct" },
      { part: "Case 2 · Part 2", prompt: "Calculate the expected pCO₂.", attempt: "Mock exam", date: "11 Sep" },
    ],
  },
  {
    id: "delta-ratio", label: "Delta ratio for a second metabolic process", topic: "Delta Ratio", type: "Mixed disorder", lastSaved: "27 Sep",
    examples: [{ part: "Case 3 · Part 2", prompt: "Identify any additional metabolic process.", attempt: "Mock exam", date: "27 Sep" }],
  },
  {
    id: "aa-age", label: "Age-adjusted A-a gradient", topic: "A-a Gradient", type: "Interpretation", lastSaved: "20 Sep",
    examples: [
      { part: "Case 6 · Part 1", prompt: "Comment on the A-a gradient.", attempt: "Mock exam", date: "20 Sep" },
      { part: "Case 4 · Part 2", prompt: "Is the hypoxaemia explained by hypoventilation alone?", attempt: "Mock exam", date: "11 Sep" },
    ],
  },
  {
    id: "na-corr", label: "Corrected sodium in hyperglycaemia", topic: "Glucose / Sodium", type: "Omission", lastSaved: "16 Sep",
    examples: [{ part: "Case 4 · Part 2", prompt: "Report the corrected sodium.", attempt: "Custom exam", date: "16 Sep" }],
  },
  {
    id: "resp-acute-chronic", label: "Acute vs chronic respiratory compensation", topic: "Compensation", type: "Compensation", lastSaved: "11 Sep", archived: true,
    examples: [
      { part: "Case 7 · Part 2", prompt: "Acute or chronic respiratory acidosis?", attempt: "Mock exam", date: "11 Sep" },
      { part: "Case 2 · Part 1", prompt: "Interpret the blood gas.", attempt: "Mock exam", date: "4 Sep" },
    ],
  },
]

// Deliberate UI fixtures, not classification of the learner's response.
// Labels follow the existing demo Part/criterion subject, including combined criteria.
export const demoErrorLogSave: ErrorLogSavePresentation = {
  "EXAM-0001-P2": [{ id: "demo-spo2", label: "Pulse oximetry in methaemoglobinaemia" }],
  "EXAM-0003-P2": [{ id: "demo-winters", label: "Expected PCO₂ — Winter's formula" }],
  "EXAM-0005-P1": [{ id: "demo-aa-calculation", label: "A–a gradient calculation", saved: true }],
  "EXAM-0005-P2": [{ id: "demo-aa-age", label: "Age-adjusted A–a gradient" }],
  "EXAM-0005-P4": [
    { id: "demo-expected-pco2", label: "Expected PCO₂ calculation and interpretation" },
    { id: "demo-anion-gap", label: "Anion gap calculation and interpretation" },
    { id: "demo-delta-ratio", label: "Delta ratio calculation and interpretation" },
    { id: "demo-mixed-disorder", label: "Mixed respiratory and metabolic acidosis", saved: true }
  ]
};
