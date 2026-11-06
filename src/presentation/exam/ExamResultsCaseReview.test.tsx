// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import ExamResultsPresentation, { type PartGrade } from "./ExamResultsPresentation";
import type { ExamQuestion, ExamTable, SittingState } from "./sittingTypes";
import type { PressureUnit } from "../../core/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const initial: ExamTable = { id: "gas-initial", heading: "Initial ABG", grouping: "", rows: [
  { id: "initial-co2", label: "PaCO2", value: 228, pressure: true, unit: "mmHg" },
] };
const repeat: ExamTable = { id: "gas-repeat", heading: "Repeat VBG", grouping: "", rows: [
  { id: "repeat-co2", label: "PaCO2", value: 68, initialValue: 228, pressure: true, unit: "mmHg" },
] };
const third: ExamTable = { id: "gas-third", heading: "Third gas", grouping: "", rows: [
  { id: "third-co2", label: "PaCO2", value: 50, pressure: true, unit: "mmHg" },
] };
const question: ExamQuestion = { id: "q1", scenario: "Combined initial and follow-up fallback", tables: [repeat, initial],
  sections: [
    { id: "repeat-gas-section", type: "data_table", tableId: repeat.id },
    { id: "repeat-story", type: "text", content: "Following resuscitation" },
    { id: "initial-gas-section", type: "data_table", tableId: initial.id },
    { id: "initial-story", type: "text", content: "Initial presentation" },
  ],
  parts: [
    { id: "p1", kind: "concept", marks: 1, prompt: "Initial assessment", stimulusSectionIds: ["initial-story", "initial-gas-section"] },
    { id: "p2", kind: "concept", marks: 1, prompt: "Explain mechanism", stimulusSectionIds: ["initial-story", "initial-gas-section"] },
    { id: "p3", kind: "concept", marks: 1, prompt: "Repeat assessment", stimulusSectionIds: ["repeat-story", "repeat-gas-section"] },
  ] };
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
function render(questions = [question], pressureUnit: PressureUnit = "mmHg", grades: Record<string, PartGrade> = {}, initialPartId?: string) {
  const sitting: SittingState = { questions, phase: "complete", questionIndex: 0, partIndices: {}, answers: { p1: "My initial answer", p3: "My follow-up answer" },
    pressureUnit: "mmHg", showRanges: true, showTimer: false, startedAt: 0, finishedAt: 1000 };
  act(() => root.render(<ExamResultsPresentation sitting={sitting} pressureUnit={pressureUnit} onExit={() => {}} feedback={{}} grades={grades} initialPartId={initialPartId} />));
}
function panel(number = 1) { return container.querySelector<HTMLElement>(`[aria-label="Question ${number} results"]`)!; }
function selector(number = 1) { return panel(number).querySelector<HTMLElement>('[aria-label="Case review scenario"]')!; }
function click(label: string, scope: ParentNode = panel()) {
  const button = [...scope.querySelectorAll("button")].find(b => b.textContent === label || b.getAttribute("aria-label") === label || b.querySelector(".exam-results__eyebrow")?.textContent === label)!;
  expect(button).toBeTruthy(); act(() => button.click());
}
it("deduplicates Part selections in Part order and pairs by explicit IDs", () => {
  render();
  expect([...selector().querySelectorAll("button")].map(b => b.textContent)).toEqual(["Initial ABG", "Repeat VBG"]);
  expect(selector().querySelector('[aria-pressed="true"]')?.textContent).toBe("Initial ABG");
  expect(panel().querySelectorAll(".exam-results__scenario")).toHaveLength(1);
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(1);
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Initial presentation");
  expect(panel().querySelector('[aria-label="Initial ABG"]')?.textContent).toContain("228.0");
  expect(panel().textContent).not.toContain("Combined initial and follow-up fallback");
  const breakdown = panel().querySelector(".exam-results__parts")!.textContent;
  click("Repeat VBG");
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(1);
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Following resuscitation");
  expect(panel().querySelector('[aria-label="Initial ABG"]')).toBeNull();
  expect(panel().querySelector('[aria-label="Repeat VBG"]')?.textContent).toContain("68.0");
  expect(panel().querySelector(".exam-results__parts")!.textContent).toBe(breakdown);
  expect(panel().querySelector(".metric-comparison")).toBeNull();
});
it("opens the linked repeat Part beside its own scenario and gas", () => {
  render([question], "mmHg", {}, "p3");
  expect(selector().querySelector('[aria-pressed="true"]')?.textContent).toBe("Repeat VBG");
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Following resuscitation");
  expect(panel().querySelector(".exam-results__scenario")?.textContent).not.toContain("Initial presentation");
  expect(panel().querySelector('[aria-label="Repeat VBG"]')).not.toBeNull();
  expect(panel().querySelector('[aria-label="Initial ABG"]')).toBeNull();
  expect(panel().querySelector('[aria-label="Collapse Part 3"]')?.getAttribute("aria-expanded")).toBe("true");
});
it("preserves a manual override of linked context through question changes, refreshes, and units", () => {
  const second = { ...question, id: "q2", parts: question.parts.map(p => ({ ...p, id: `q2-${p.id}` })) };
  render([question, second], "mmHg", {}, "q2-p3");
  expect(panel(2).hidden).toBe(false);
  expect(selector(2).querySelector('[aria-pressed="true"]')?.textContent).toBe("Repeat VBG");
  expect(selector().querySelector('[aria-pressed="true"]')?.textContent).toBe("Initial ABG");
  click("Initial ABG", selector(2));
  click("Question 1", container); click("Question 2", container);
  render([structuredClone(question), structuredClone(second)], "kPa", { "q2-p3": { status: "completed", score: 1 } }, "q2-p3");
  expect(selector(2).querySelector('[aria-pressed="true"]')?.textContent).toBe("Initial ABG");
  expect(panel(2).querySelector(".exam-results__scenario")?.textContent).toContain("Initial presentation");
  expect(panel(2).querySelector('[aria-label="Initial ABG"]')?.textContent).toContain("30.4kPa");
  expect(panel(2).querySelector('[aria-label="Repeat VBG"]')).toBeNull();
});
it.each([undefined, "missing", "p1", "p2"])("keeps the first view for ordinary, absent, or shared-initial targets: %s", target => {
  render([question], "mmHg", {}, target);
  expect(selector().querySelector('[aria-pressed="true"]')?.textContent).toBe("Initial ABG");
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Initial presentation");
});
it("keeps legacy shared context when the linked Part has no selectors", () => {
  const legacy = { ...question, parts: question.parts.map(({ stimulusSectionIds: _ids, ...part }) => part) };
  render([legacy], "mmHg", {}, "p3");
  expect(selector()).toBeNull();
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(2);
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Initial presentation");
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Following resuscitation");
  render([{ ...legacy, sections: undefined }], "mmHg", {}, "p3");
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain(question.scenario);
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(2);
});
it.each([["missing-section"], []])("never substitutes unrelated context for explicit linked selectors: %j", (...ids) => {
  const linked = { ...question, parts: question.parts.map(part => part.id === "p3" ? { ...part, stimulusSectionIds: ids } : part) };
  render([linked], "mmHg", {}, "p3");
  expect(panel().querySelector(".exam-results__scenario")).toBeNull();
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(0);
  expect(panel().querySelector('[aria-label="Collapse Part 3"]')).not.toBeNull();
});

it("supports three views and excludes unselected stems and gases", () => {
  const value: ExamQuestion = { ...question, tables: [third, ...question.tables], sections: [...question.sections!,
    { id: "third-story", type: "text", content: "Later reassessment" }, { id: "third-gas-section", type: "data_table", tableId: third.id }],
    parts: [...question.parts, { id: "p4", kind: "concept", marks: 1, prompt: "Later assessment", stimulusSectionIds: ["third-story", "third-gas-section"] }] };
  render([value]);
  expect([...selector().querySelectorAll("button")].map(b => b.textContent)).toEqual(["Initial ABG", "Repeat VBG", "Third gas"]);
  click("Third gas");
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Later reassessment");
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(1);
  expect(panel().querySelector('[aria-label="Third gas"]')?.textContent).toContain("50.0");
  expect(panel().querySelector('[aria-label="Repeat VBG"]')).toBeNull();
  click("Repeat VBG"); expect(panel().querySelector('[aria-label="Repeat VBG"]')).not.toBeNull();
});
it("keeps each Question selection through navigation and grading refreshes", () => {
  const second = { ...question, id: "q2", parts: question.parts.map(p => ({ ...p, id: `q2-${p.id}` })) };
  render([question, second]); click("Repeat VBG");
  click("Question 2", container);
  expect(selector(2).querySelector('[aria-pressed="true"]')?.textContent).toBe("Initial ABG");
  click("Question 1", container);
  expect(selector().querySelector('[aria-pressed="true"]')?.textContent).toBe("Repeat VBG");
  render([question, second], "mmHg", { p3: { status: "completed", score: 1 } });
  expect(selector().querySelector('[aria-pressed="true"]')?.textContent).toBe("Repeat VBG");
  expect(panel().querySelector('[aria-label="Repeat VBG"]')).not.toBeNull();
});
it("reopens both disclosures when switching views", () => {
  render(); click("Collapse Scenario"); click("Initial ABG", panel().querySelector(".exam-results__values")!);
  expect(panel().querySelector(".exam-results__scenario-text")?.hasAttribute("hidden")).toBe(true);
  expect(panel().querySelector(".exam-results__table-body")?.hasAttribute("hidden")).toBe(true);
  click("Repeat VBG"); click("Initial ABG", selector());
  expect(panel().querySelector(".exam-results__scenario-text")?.hasAttribute("hidden")).toBe(false);
  expect(panel().querySelector(".exam-results__table-body")?.hasAttribute("hidden")).toBe(false);
});
it("converts the selected compact gas without adding comparison footers", () => {
  render(); click("Repeat VBG"); render([question], "kPa");
  expect(panel().querySelector('[aria-label="Repeat VBG"]')?.textContent).toContain("9.1kPa");
  expect(panel().querySelector('[aria-label="Initial ABG"]')).toBeNull();
  expect(panel().querySelector(".metric-comparison")).toBeNull();
});
it("retains the complete legacy review when section selections are absent", () => {
  render([{ ...question, sections: undefined, parts: question.parts.map(({ stimulusSectionIds: _ids, ...p }) => p) }]);
  expect(selector()).toBeNull();
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain(question.scenario);
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(2);
});
it("keeps multiple selected tables without introducing unrelated scenarios", () => {
  render([{ ...question, parts: [{ ...question.parts[0], stimulusSectionIds: ["initial-story", "initial-gas-section", "repeat-gas-section"] }] }]);
  expect(selector()).toBeNull();
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(2);
  expect(panel().textContent).not.toContain("Following resuscitation");
  expect(panel().textContent).not.toContain("Combined initial and follow-up fallback");
});
it("does not fall back to unrelated context for an unresolved selection", () => {
  render([{ ...question, parts: [{ ...question.parts[0], stimulusSectionIds: ["missing-section"] }] }]);
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(0);
  expect(panel().textContent).not.toContain("Following resuscitation");
});
it("keeps a repeat-only view and comparison values after the initial Parts are omitted", () => {
  render([{ ...question, parts: [question.parts[2]] }]);
  expect(selector()).toBeNull();
  expect(panel().textContent).toContain("Following resuscitation");
  expect(panel().textContent).not.toContain("Initial presentation");
  expect(panel().querySelector('[aria-label="Initial ABG"]')).toBeNull();
  expect(question.tables[0].rows[0].initialValue).toBe(228);
});
it("does not add a selector for a single resolved view", () => {
  render([{ ...question, parts: question.parts.slice(0, 2) }]);
  expect(selector()).toBeNull();
  expect(panel().querySelectorAll(".exam-results__values")).toHaveLength(1);
  expect(panel().querySelector('[aria-label="Initial ABG"]')).not.toBeNull();
});

it("numbers scenario tabs when different stems reuse the same gas", () => {
  render([{ ...question, parts: question.parts.map(part => ({ ...part,
    stimulusSectionIds: part.id === "p3" ? ["repeat-story", "initial-gas-section"] : part.stimulusSectionIds,
  })) }]);
  expect([...selector().querySelectorAll("button")].map(button => button.textContent)).toEqual(["Scenario 1", "Scenario 2"]);
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Initial presentation");
  click("Scenario 2");
  expect(selector().querySelector('[aria-pressed="true"]')?.textContent).toBe("Scenario 2");
  expect(panel().querySelector(".exam-results__scenario")?.textContent).toContain("Following resuscitation");
  expect(panel().querySelector('[aria-label="Initial ABG"]')?.textContent).toContain("228.0");
});
it("numbers duplicate table headings while retaining distinct headings", () => {
  render([{ ...question, tables: [{ ...initial, heading: "Blood Gas" }, { ...repeat, heading: "Blood Gas" }, third],
    sections: [...question.sections!, { id: "third-gas-section", type: "data_table", tableId: third.id }],
    parts: [...question.parts, { id: "p4", kind: "concept", marks: 1, prompt: "Third assessment", stimulusSectionIds: ["third-gas-section"] }],
  }]);
  expect([...selector().querySelectorAll("button")].map(button => button.textContent)).toEqual(["Scenario 1", "Scenario 2", "Third gas"]);
});
