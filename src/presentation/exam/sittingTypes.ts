import type { ReactNode } from "react";
import type { PressureUnit } from "../../core/types";

// Display inputs only; these are not delivery or grading contracts.
export interface ExamOption { id: string; text: ReactNode; textKpa?: ReactNode }
export interface ExamPart {
  id: string;
  kind: "single" | "multiAll" | "multiN" | "numeric" | "concept";
  prompt: ReactNode;
  instruction?: string;
  marks: number;
  options?: ExamOption[];
  optionOrder?: "randomised" | "fixed";
  selectN?: number;
  pressureAnswer?: boolean;
  answerUnit?: string;
  additionalContext?: ReactNode;
  stimulusSectionIds?: string[];
}
export interface ExamMetric {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  primary?: boolean;
  oxygenation?: boolean;
  pressure?: boolean;
  reference?: string;
  refLow?: number;
  refHigh?: number;
  analyteId?: string;
  initialValue?: number | string;
}
export interface ExamTable { id: string; heading: string; grouping: string; rows: ExamMetric[] }
export type ExamStimulusSection =
  | { id: string; type: "text"; content: ReactNode }
  | { id: string; type: "data_table"; tableId: string };
export interface ExamQuestion {
  id: string;
  scenario?: ReactNode;
  sections?: ExamStimulusSection[];
  tables: ExamTable[];
  parts: ExamPart[];
}
export type ExamAnswer = string | string[];
export interface SittingState {
  questions: ExamQuestion[];
  phase: "active" | "review" | "complete";
  questionIndex: number;
  partIndices: Record<string, number>;
  answers: Record<string, ExamAnswer>;
  pressureUnit: PressureUnit;
  showRanges: boolean;
  showTimer: boolean;
  startedAt: number;
  finishedAt?: number;
}

