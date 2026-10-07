import type { PartFeedback, PartGrade } from "./resultsTypes";
import type { ExamPart } from "./sittingTypes";

// Shared by Results and revision suggestions. An unverified grade never identifies a study area.
export function isCompletedPartGrade(
  part: Pick<ExamPart, "marks">,
  feedback: Pick<PartFeedback, "criteria"> | undefined,
  grade: PartGrade | undefined,
): grade is PartGrade & { status: "completed"; score: number } {
  const expectedCriteria = feedback?.criteria ?? [];
  const validCriteria = !expectedCriteria.length || Boolean(grade?.criteria
    && Object.keys(grade.criteria).length === expectedCriteria.length
    && expectedCriteria.every(c => grade.criteria![c.id] === 0 || grade.criteria![c.id] === 1)
    && expectedCriteria.reduce((sum, c) => sum + grade.criteria![c.id], 0) === grade.score);
  return validCriteria && grade?.status === "completed" && Number.isInteger(grade.score)
    && grade.score! >= 0 && grade.score! <= part.marks;
}
