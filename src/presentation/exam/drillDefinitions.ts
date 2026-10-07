import type { DrillPresentation } from "./presentationTypes";

// Display metadata only; Focused Drills has no learner content or activity yet.
export const unavailableDrills: DrillPresentation[] = [
  {
    key: "anion-gap",
    title: "Anion Gap",
    blurb: "Calculate and correct the gap, then decide if it's raised.",
    tone: "blue",
    accuracy: null,
    attempted: null,
    icon: "gap",
  },
  {
    key: "compensation",
    title: "Compensation",
    blurb: "Apply Winter's and the 1-2-4-5 rule to judge the response.",
    tone: "coral",
    accuracy: null,
    attempted: null,
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
    accuracy: null,
    attempted: null,
    icon: "split",
  },
  {
    key: "aa-gradient",
    title: "A-a Gradient",
    blurb: "Compute the gradient and judge the cause of hypoxaemia.",
    tone: "green",
    accuracy: null,
    attempted: null,
    icon: "lung",
  },
  {
    key: "corrections",
    title: "Glucose / Sodium Correction",
    blurb: "Correct sodium for hyperglycaemia before you interpret it.",
    tone: "coral",
    accuracy: null,
    attempted: null,
    icon: "droplet",
  },
];
