// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import ExamResultsPresentation, { type PartGrade } from "./ExamResultsPresentation";
import type { PartFeedback } from "./resultsTypes";
import type { SittingState } from "./sittingTypes";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
function render(count: number, awarded: number, summary: string | undefined = "Identifies distinct appropriate ventilator adjustments", status: PartGrade["status"] = "completed", invalid = false) {
  const criteria = Array.from({ length: count }, (_, i) => ({ id: `c${i}`, label: `Individual criterion ${i + 1}` }));
  const decisions = Object.fromEntries(criteria.map((c, i) => [c.id, i < awarded ? 1 : 0]));
  if (invalid) delete decisions.c0;
  const sitting: SittingState = { questions: [{ id: "q1", tables: [], parts: [{ id: "p1", prompt: "List settings", kind: "concept", marks: count }] }],
    phase: "complete", questionIndex: 0, partIndices: {}, answers: { p1: "Submitted answer" }, pressureUnit: "mmHg", showRanges: true,
    showTimer: true, startedAt: 0, finishedAt: 1000 };
  const feedback: PartFeedback = { answer: { mmHg: "Model", kPa: "Model" }, reasoning: { mmHg: "Explanation", kPa: "Explanation" },
    criteria, ...(summary ? { criteriaSummaryLabel: summary } : {}), primaryObjective: "mechanism.explain", display: "text_and_resources", resources: [] };
  act(() => root.render(<ExamResultsPresentation sitting={sitting} onExit={() => {}} feedback={{ p1: feedback }}
    grades={{ p1: { status, score: awarded, criteria: decisions } }} />));
}
it.each([[0, "coral"], [3, "amber"], [5, "green"]] as const)("summarises %i/5 without listing the five criteria", (awarded, tone) => {
  render(5, awarded);
  const rows = container.querySelectorAll('.exam-results__criteria li');
  expect(rows).toHaveLength(1);
  expect(rows[0].textContent).toBe(`Identifies distinct appropriate ventilator adjustments${awarded} / 5`);
  expect(rows[0].getAttribute("data-tone")).toBe(tone);
  expect(container.textContent).not.toContain("Individual criterion");
});
it("uses the same summary behaviour for P3's two marks", () => {
  render(2, 1, "Identifies distinct important gas changes");
  expect(container.querySelector('.exam-results__criteria li')?.textContent).toBe("Identifies distinct important gas changes1 / 2");
});
it("retains detailed individual rows when the label is omitted", () => {
  render(5, 3, "");
  expect(container.querySelectorAll('.exam-results__criteria li')).toHaveLength(5);
  expect(container.querySelectorAll('.exam-results__criteria li[data-tone="green"]')).toHaveLength(3);
});
it.each(["pending", "failed"] as const)("does not present a summary score while grading is %s", status => {
  render(5, 0, "Summary", status);
  expect(container.querySelector('.exam-results__criteria')).toBeNull();
});
it("retains validation of the underlying individual marks", () => {
  render(5, 3, "Summary", "completed", true);
  expect(container.querySelector('.exam-results__criteria')).toBeNull();
  expect(container.textContent).toContain("Grading unavailable");
});
