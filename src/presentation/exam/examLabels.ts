import type { ExamKind } from "../../core/examRuntime";

export function examKindLabel(kind: ExamKind = "mock"): string {
  return kind === "custom" ? "Custom Exam" : "Standard Exam";
}
