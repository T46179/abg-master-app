import type { CaseInputs, CompensationResult, PressureUnit } from "../../core/types";
export type GradingStatus = "pending" | "completed" | "failed";
export interface ResultResource {
  kind: "compensation" | "anion_gap" | "aa_gradient" | "unavailable";
  result?: CompensationResult | unknown;
  measuredPaCO2MmHg?: number;
  caseInputs?: CaseInputs;
}
export interface PartFeedback {
  answer: Record<PressureUnit, string>;
  reasoning: Record<PressureUnit, string>;
  takeaway?: Record<PressureUnit, string>;
  rationales?: Array<{ id: string; text: Record<PressureUnit, string> }>;
  difficulty?: number;
  primaryObjective: string;
  criteria: Array<{ id: string; label: string }>;
  display: "resources_with_text_fallback" | "text_and_resources";
  resources: ResultResource[];
}
export type ExamFeedback = Record<string, PartFeedback>;
