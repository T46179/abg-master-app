import type { ErrorLogCandidate, ErrorLogCatalogue } from "./errorLogTypes";
import type { PartFeedback, PartGrade } from "./resultsTypes";
import type { ExamAnswer, ExamPart } from "./sittingTypes";
import { isCompletedPartGrade } from "./resultsModel";

// Derive suggestions only from this Part's frozen feedback and accepted grade.
// No grading, diagnosis, saving, or fallback to newer authored question mappings.
export function derivePartErrorLogCandidates({ part, feedback, grade, answer, catalogue }: {
  part: Pick<ExamPart, "id" | "kind" | "marks" | "options">;
  feedback?: PartFeedback;
  grade?: PartGrade;
  answer?: ExamAnswer;
  catalogue: ErrorLogCatalogue;
}): ErrorLogCandidate[] {
  const mapping = feedback?.errorLog;
  if (!mapping || !isCompletedPartGrade(part, feedback, grade) || grade.score === part.marks) return [];
  const activeIds = new Set(catalogue.concepts.filter(c => c.active).map(c => c.id));
  const unanswered = Array.isArray(answer) ? !answer.length : !answer?.trim();
  const candidates = new Map<string, ErrorLogCandidate>();
  function include(ids: readonly string[], source: "part" | "criterion" | "option", sourceId?: string) {
    for (const conceptId of ids) {
      if (!activeIds.has(conceptId)) continue;
      let candidate = candidates.get(conceptId);
      if (!candidate) {
        candidate = { conceptId, partId: part.id,
          evidence: { partMarkLoss: false, criterionIds: [], incorrectOptionIds: [], unanswered } };
        candidates.set(conceptId, candidate);
      }
      if (source === "part") candidate.evidence.partMarkLoss = true;
      else {
        const evidenceIds = source === "criterion" ? candidate.evidence.criterionIds : candidate.evidence.incorrectOptionIds;
        if (sourceId && !evidenceIds.includes(sourceId)) evidenceIds.push(sourceId);
      }
    }
  }
  const criteria = feedback?.criteria ?? [];
  if (!criteria.length) include(mapping.partConceptIds ?? [], "part");
  for (const criterion of criteria) {
    if (grade.criteria?.[criterion.id] === 0) {
      include(mapping.criterionConceptIds?.[criterion.id] ?? [], "criterion", criterion.id);
    }
  }
  if (part.kind === "single" || part.kind === "multiAll" || part.kind === "multiN") {
    const selected = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []);
    for (const option of part.options ?? []) {
      if (selected.has(option.id)) include(mapping.incorrectOptionConceptIds?.[option.id] ?? [], "option", option.id);
    }
  }
  return [...candidates.values()];
}
