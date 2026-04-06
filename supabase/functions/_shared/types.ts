export interface QuestionFlowStep {
  key: string;
  label?: string;
  prompt?: string;
  options?: string[];
}

export const EXPLANATION_DOMAINS = [
  "ph_status",
  "primary_disorder",
  "compensation",
  "anion_gap",
  "additional_metabolic_process",
  "diagnosis",
  "clinical_context",
  "key_takeaway"
] as const;

export type ExplanationDomain = typeof EXPLANATION_DOMAINS[number];
export type ExplanationVariant = "beginner" | "intermediate" | "advanced" | "master";
export type ExplanationKind = "core_reasoning" | "diagnosis" | "clinical_context";

export interface ExplanationBlueprintEntry {
  domain: ExplanationDomain;
  variant: ExplanationVariant;
  title: string;
  body: string;
  order: number;
  kind?: ExplanationKind;
  stepKey?: string | null;
}

export interface StepFeedbackEntry {
  key: ExplanationDomain;
  title: string;
  body: string;
  order: number;
}

export interface PublicCasePayload {
  case_id: string;
  title?: string;
  archetype?: string;
  category?: string;
  clinical_stem?: string;
  difficulty_level?: number;
  difficulty_label?: string;
  learning_objective?: string;
  inputs?: Record<string, unknown>;
  questions_flow?: QuestionFlowStep[];
  protected_payload_mode?: string;
  step_feedback?: Record<string, StepFeedbackEntry>;
  answer_key?: Record<string, string>;
}

export interface StructuredExplanation {
  overview: string;
  sections: Array<{ key: ExplanationDomain; title: string; body: string; order: number }>;
}

export interface PublishedCaseRow {
  content_version: string;
  case_id: string;
  difficulty_label: string;
  difficulty_level: number;
  archetype: string;
  category: string | null;
  public_payload: PublicCasePayload;
  grading_payload: {
    answer_key?: Record<string, string>;
    explanation_blueprint?: ExplanationBlueprintEntry[];
    structured_explanation?: StructuredExplanation;
    legacy_explanation?: string;
    progression_config?: Record<string, unknown>;
  };
}

export interface IssuedCaseSessionRow {
  case_token: string;
  user_id: string;
  content_version: string;
  case_id: string;
  difficulty_label: string;
  difficulty_level: number;
  status: "issued" | "completed" | "expired" | "superseded";
  issued_at: string;
  expires_at: string;
  completed_at: string | null;
  submitted_answers: Array<{ key: string; chosen: string }> | null;
  graded_response: Record<string, unknown> | null;
}
