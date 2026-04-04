export interface QuestionFlowStep {
  key: string;
  label?: string;
  prompt?: string;
  options?: string[];
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
}

export interface StructuredExplanation {
  overview: string;
  sections: Array<{ title: string; body: string }>;
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
    structured_explanation?: StructuredExplanation;
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
