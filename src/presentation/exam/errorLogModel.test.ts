import { describe, expect, it } from "vitest";
import { derivePartErrorLogCandidates } from "./errorLogModel";
import { demoErrorLogCatalogue } from "./demoErrorLogCatalogue.dev";
import { demoFeedback } from "./demoFeedback.dev";
import { demoQuestions } from "./demoFixtures.dev";
import type { ErrorLogCatalogue } from "./errorLogTypes";
import type { PartFeedback, PartGrade } from "./resultsTypes";
import type { ExamAnswer, ExamPart } from "./sittingTypes";

const catalogue: ErrorLogCatalogue = {
  topics: [{ id: "topic", label: "Study topic" }],
  concepts: ["area", "other"].map(id => ({ id, label: id, topicId: "topic", errorType: "Revision", active: true })),
};
const part: ExamPart = { id: "part", kind: "single", prompt: "Prompt", marks: 1,
  options: [{ id: "a", text: "First" }, { id: "b", text: "Second" }] };
const feedback: PartFeedback = {
  primaryObjective: "Objective", answer: { mmHg: "Answer", kPa: "Answer" },
  reasoning: { mmHg: "Explanation", kPa: "Explanation" }, resources: [], criteria: [],
  display: "text_and_resources", errorLog: { partConceptIds: ["area"] },
};
const grade: PartGrade = { status: "completed", score: 0 };
function derive(overrides: Partial<Parameters<typeof derivePartErrorLogCandidates>[0]> = {}) {
  return derivePartErrorLogCandidates({ part, feedback, grade, catalogue, answer: "a", ...overrides });
}
function authored(partId: string, score: number, criterionMarks?: Record<string, number>, answer = "Submitted answer") {
  const authoredPart = demoQuestions.flatMap(q => q.parts).find(p => p.id === partId)!;
  return derive({ part: authoredPart, feedback: demoFeedback[partId], catalogue: demoErrorLogCatalogue,
    grade: { status: "completed", score, ...(criterionMarks ? { criteria: criterionMarks } : {}) }, answer });
}

describe("Error Log study suggestions", () => {
  it("keeps specific missed mechanism evidence beneath one broad revision area", () => {
    const candidates = authored("EXAM-0002-P4", 0, { identify_vq_mismatch: 0, identify_haldane_effect: 0 });
    expect(candidates).toEqual([{ conceptId: "oxygen_induced_hypercapnia_mechanisms", partId: "EXAM-0002-P4",
      evidence: { partMarkLoss: false, criterionIds: ["identify_vq_mismatch", "identify_haldane_effect"],
        incorrectOptionIds: [], unanswered: false } }]);
    expect(authored("EXAM-0002-P4", 1, { identify_vq_mismatch: 1, identify_haldane_effect: 0 })[0].evidence.criterionIds)
      .toEqual(["identify_haldane_effect"]);
  });

  it("offers only the calculation actually missed in a combined SAQ", () => {
    const candidates = authored("EXAM-0005-P4", 3, {
      calculate_expected_pco2: 1, calculate_anion_gap: 0, calculate_delta_ratio: 1, interpret_triple_disorder: 1,
    });
    expect(candidates.map(c => c.conceptId)).toEqual(["anion_gap_calculation_interpretation"]);
    expect(candidates[0].evidence.criterionIds).toEqual(["calculate_anion_gap"]);
  });

  it("uses the same study area for a numeric Part and the corresponding SAQ criterion", () => {
    const numeric = authored("EXAM-0003-P2", 0, undefined, "29");
    const saq = authored("EXAM-0005-P4", 3, {
      calculate_expected_pco2: 0, calculate_anion_gap: 1, calculate_delta_ratio: 1, interpret_triple_disorder: 1,
    });
    expect(numeric[0].conceptId).toBe(saq[0].conceptId);
    expect(numeric[0].evidence.partMarkLoss).toBe(true);
    expect(saq[0].evidence.partMarkLoss).toBe(false);
    expect(numeric[0].partId).not.toBe(saq[0].partId);
  });

  it("retains ordinal criterion evidence without inventing a particular missing ventilator adjustment", () => {
    const criteria = Array.from({ length: 5 }, (_, i) => ({ id: `adjustment_${i}`, label: "Appropriate adjustment" }));
    const candidates = derive({ part: { ...part, kind: "concept", marks: 5 },
      feedback: { ...feedback, criteria, criteriaSummaryLabel: "Distinct appropriate adjustments",
        errorLog: { criterionConceptIds: Object.fromEntries(criteria.map(c => [c.id, ["area"]])) } },
      grade: { status: "completed", score: 3, criteria: { adjustment_0: 1, adjustment_1: 1, adjustment_2: 1, adjustment_3: 0, adjustment_4: 0 } },
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidence.criterionIds).toEqual(["adjustment_3", "adjustment_4"]);
  });

  it.each(["single", "multiAll", "multiN"] as const)("uses selected incorrect-option mappings for %s", kind => {
    const candidates = derive({ part: { ...part, kind }, answer: kind === "single" ? "b" : ["a", "b"],
      feedback: { ...feedback, errorLog: { incorrectOptionConceptIds: { b: ["area"], unselected: ["other"] } } } });
    expect(candidates).toEqual([{ conceptId: "area", partId: "part",
      evidence: { partMarkLoss: false, criterionIds: [], incorrectOptionIds: ["b"], unanswered: false } }]);
  });

  it("deduplicates overlapping Part and selected option mappings while retaining both sources", () => {
    const candidates = derive({ answer: ["b", "b"],
      feedback: { ...feedback, errorLog: { partConceptIds: ["area", "area"], incorrectOptionConceptIds: { b: ["area", "other"] } } } });
    expect(candidates.map(c => c.conceptId)).toEqual(["area", "other"]);
    expect(candidates[0].evidence).toEqual({ partMarkLoss: true, criterionIds: [], incorrectOptionIds: ["b"], unanswered: false });
  });

  it("does not use select-option evidence for numeric or text responses", () => {
    for (const kind of ["numeric", "concept"] as const) {
      expect(derive({ part: { ...part, kind }, answer: "b",
        feedback: { ...feedback, errorLog: { incorrectOptionConceptIds: { b: ["area"] } } } })).toEqual([]);
    }
  });

  const unansweredAnswers: (ExamAnswer | undefined)[] = [undefined, "", "   ", []];
  it.each(unansweredAnswers.map(answer => ({ answer })))("retains unanswered status without creating an omission concept (%j)", ({ answer }) => {
    const candidates = derive({ answer });
    expect(candidates[0].evidence.unanswered).toBe(true);
    expect(candidates[0].conceptId).toBe("area");
  });

  it("lets a blank SAQ identify mapped study areas and keeps the unanswered evidence", () => {
    const candidates = authored("EXAM-0002-P4", 0, { identify_vq_mismatch: 0, identify_haldane_effect: 0 }, " ");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidence.unanswered).toBe(true);
    expect(candidates[0].evidence.criterionIds).toHaveLength(2);
  });

  it.each(["pending", "failed"] as const)("offers nothing while grading is %s", status => {
    expect(derive({ grade: { status, score: 0 } })).toEqual([]);
  });

  it("offers nothing for absent, invalid or full-credit grades", () => {
    for (const invalid of [undefined, {}, { score: -1 }, { score: 2 }, { score: 0.5 }, { score: NaN }, { score: Infinity }, { score: 1 }]) {
      const supplied = invalid ? { status: "completed" as const, ...invalid } : undefined;
      expect(derive({ grade: supplied })).toEqual([]);
    }
  });

  it("rejects incomplete, non-binary, extra or score-inconsistent SAQ decisions", () => {
    const criteria = feedbackForSaq();
    const invalidDecisions: (Record<string, number> | undefined)[] = [undefined, {}, { c1: 0 }, { c1: 0, c2: 0, extra: 0 },
      { c1: 0, c2: 0.5 }, { c1: 0, c2: 1 }, { other1: 0, other2: 0 }];
    for (const decisions of invalidDecisions) {
      expect(derive({ part: { ...part, kind: "concept", marks: 2 }, feedback: criteria,
        grade: { status: "completed", score: 0, criteria: decisions } })).toEqual([]);
    }
  });

  it("does not diagnose an unmapped miss or apply current mappings to legacy feedback", () => {
    expect(derive({ feedback: { ...feedback, errorLog: undefined } })).toEqual([]);
    expect(derive({ feedback: undefined })).toEqual([]);
    expect(derive({ part: { ...part, kind: "concept", marks: 2 }, feedback: feedbackForSaq(),
      grade: { status: "completed", score: 1, criteria: { c1: 1, c2: 0 } } })).toEqual([]);
    expect(derive({ feedback: { ...feedback, errorLog: { incorrectOptionConceptIds: { b: ["area"] } } }, answer: [] })).toEqual([]);
  });

  it("skips retired and unknown concepts, and uses only this Part's criterion and option IDs", () => {
    const retired = structuredClone(catalogue);
    retired.concepts[0].active = false;
    expect(derive({ catalogue: retired, feedback: { ...feedback, errorLog: { partConceptIds: ["area", "unknown", "other"] } } })
      .map(c => c.conceptId)).toEqual(["other"]);
    expect(derive({ feedback: { ...feedback, errorLog: { incorrectOptionConceptIds: { foreign: ["area"] } } }, answer: "foreign" })).toEqual([]);
    expect(derive({ part: { ...part, kind: "concept", marks: 2 }, feedback: { ...feedbackForSaq(),
      errorLog: { criterionConceptIds: { foreign: ["area"] }, partConceptIds: ["other"] } },
      grade: { status: "completed", score: 0, criteria: { c1: 0, c2: 0 } } })).toEqual([]);
  });

  it("keeps labels and grouping editable independently of source evidence and never mutates inputs", () => {
    const inputs = { part, feedback, grade, catalogue, answer: "a" };
    const before = structuredClone(inputs);
    const first = derivePartErrorLogCandidates(inputs);
    const renamed = structuredClone(catalogue);
    renamed.concepts[0].label = "New wording";
    renamed.concepts[0].topicId = "new_topic";
    renamed.concepts[0].errorType = "New grouping";
    expect(derive({ catalogue: renamed })).toEqual(first);
    first[0].evidence.criterionIds.push("changed output");
    expect(inputs).toEqual(before);
    expect(derive()[0].evidence.criterionIds).toEqual([]);
  });
});

function feedbackForSaq(): PartFeedback {
  return { ...feedback, criteria: [{ id: "c1", label: "Mapped skill" }, { id: "c2", label: "Unmapped skill" }],
    errorLog: { criterionConceptIds: { c1: ["area"] } } };
}
