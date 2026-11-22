import type { CompensationRule, DrillKey } from "../../core/examDrills";
import type { ExamTone } from "./presentationTypes";
import { DropletIcon, GapIcon, LungIcon, ScaleIcon, SplitIcon } from "./ExamIcons";

type DrillCardContent = { title: string; blurb: string; tone: ExamTone; Icon: typeof GapIcon };

export const drillDefinitions = {
  "anion-gap": {
    title: "Anion Gap",
    blurb: "Calculate the anion gap and correct for albumin when needed.",
    tone: "blue",
    Icon: GapIcon,
  },
  compensation: {
    title: "Compensation",
    blurb: "Predict the expected response and identify mixed acid–base disorders.",
    tone: "coral",
    Icon: ScaleIcon,
  },
  "delta-ratio": {
    title: "Delta Ratio",
    blurb: "Uncover additional metabolic disorders using the delta ratio.",
    tone: "purple",
    Icon: SplitIcon,
  },
  "aa-gradient": {
    title: "A–a Gradient",
    blurb: "Calculate the gradient and assess oxygen transfer.",
    tone: "green",
    Icon: LungIcon,
  },
  "pf-ratio": {
    title: "P/F Ratio",
    blurb: "Calculate the ratio and assess oxygenation impairment.",
    tone: "navy",
    Icon: LungIcon,
  },
  corrections: {
    title: "Glucose / Sodium Correction",
    blurb: "Calculate the corrected sodium in hyperglycaemia.",
    tone: "coral",
    Icon: DropletIcon,
  },
} satisfies Record<DrillKey, DrillCardContent>;

export const drillCards: readonly { drill: DrillKey; shortTitle?: string }[] = [
  { drill: "compensation" },
  { drill: "delta-ratio" },
  { drill: "anion-gap" },
  { drill: "corrections", shortTitle: "Glucose / Sodium" },
  { drill: "aa-gradient" },
  { drill: "pf-ratio" },
];

export const compensationRules = {
  "met-acidosis": { label: "Metabolic acidosis", hint: "Winter’s formula" },
  "met-alkalosis": { label: "Metabolic alkalosis", hint: "Expected PaCO₂" },
  respiratory: { label: "Respiratory disorder", hint: "Acute vs chronic" },
} satisfies Record<CompensationRule, { label: string; hint: string }>;
