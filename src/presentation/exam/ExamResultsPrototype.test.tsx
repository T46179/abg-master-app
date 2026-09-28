// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ExamResultsPrototype from "./ExamResultsPrototype.dev";
import type { SittingState } from "./sittingTypes";
import type { PressureUnit } from "../../core/types";
import { demoFeedback } from "./demoFeedback.dev";

const resourceState = vi.hoisted(() => ({ fail: false }));
vi.mock("../practice/compensation/CompensationVisualContent", async importOriginal => {
  const actual = await importOriginal<typeof import("../practice/compensation/CompensationVisualContent")>();
  return { CompensationVisualContent: (props: Parameters<typeof actual.CompensationVisualContent>[0]) => {
    if (resourceState.fail) throw new Error("Test resource failure");
    return <actual.CompensationVisualContent {...props} />;
  } };
});
vi.mock("./demoFeedback.dev", async importOriginal => {
  const actual = await importOriginal<typeof import("./demoFeedback.dev")>();
  return { demoFeedback: {
    ...actual.demoFeedback,
    p1: { answer: { mmHg: "Model answer one in mmHg", kPa: "Model answer one in kPa" },
      reasoning: { mmHg: "Reasoning in mmHg", kPa: "Reasoning in kPa" },
      criteria: [{ id: "one", label: "Criterion one" }, { id: "two", label: "Criterion two" }],
      resources: [], display: "resources_with_text_fallback", difficulty: 3 },
    p2: { answer: { mmHg: "Model answer two", kPa: "Model answer two" }, reasoning: { mmHg: "Fallback two", kPa: "Fallback two" },
      criteria: [], resources: [{ kind: "unavailable" }], display: "resources_with_text_fallback" }
  } };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const longScenario = "Original scenario. ".repeat(20);
const sitting: SittingState = { questions: [
  { id: "q1", scenario: longScenario, tables: [], parts: [{ id: "p1", kind: "concept", prompt: "Explain", marks: 2 }] },
  { id: "q2", scenario: longScenario, tables: [], parts: [{ id: "p2", kind: "numeric", prompt: "Calculate", marks: 1, pressureAnswer: true }] }
], phase: "complete", questionIndex: 0, partIndices: {}, answers: { p1: "  unchanged answer  ", p2: "5.3" },
 pressureUnit: "kPa", showRanges: true, showTimer: true, startedAt: 1000, finishedAt: 61000 };
function render(value = sitting, unit?: PressureUnit) {
  act(() => root.render(<ExamResultsPrototype sitting={value} pressureUnit={unit} onExit={() => {}} />));
}
function click(label: string, scope: ParentNode = container) {
  const button = Array.from(scope.querySelectorAll("button")).find(b => b.textContent === label || b.getAttribute("aria-label") === label)!;
  expect(button).toBeTruthy(); act(() => button.click());
}
function panel(number: number) { return container.querySelector<HTMLElement>(`[aria-label="Question ${number} results"]`)!; }
beforeEach(() => {
  resourceState.fail = false;
  vi.useFakeTimers(); container = document.createElement("div"); document.body.append(container); root = createRoot(container); render();
});
afterEach(() => { act(() => root.unmount()); expect(vi.getTimerCount()).toBe(0); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("renders EXAM-0002 P2 takeaway as a list in the selected review units", () => {
  const value: SittingState = { ...sitting, questions: [{ id: "q1", tables: [], parts: [
    { id: "EXAM-0002-P2", kind: "single", prompt: "Saturation", marks: 1 }
  ] }], answers: {} };
  for (const [unit, pressures] of [["mmHg", ["60", "50", "40", "27"]], ["kPa", ["8.0", "6.7", "5.3", "3.6"]]] as const) {
    render(value, unit);
    const takeaway = container.querySelector(".exam-results__takeaway")!;
    expect(takeaway.querySelector("p")?.textContent).toBe("For the standard O2-Hb dissociation curve (approximates):");
    expect(Array.from(takeaway.querySelectorAll("ul li"), li => li.textContent)).toEqual(
      pressures.map((pressure, index) => `PaO2 ${pressure} ${unit} → SaO2 ≈ ${["90%", "80–85%", "75%", "50%"][index]}`)
    );
    expect(takeaway.querySelectorAll("p")).toHaveLength(1);
    expect(takeaway.querySelectorAll("li sub")).toHaveLength(8);
  }
});
it("opens a question-specific report, selects one reason and resets after dismissal or navigation", () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  click("Report a problem with this question", panel(1));
  let dialog = container.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(dialog.querySelector("h2")?.textContent).toBe("Question 1");
  expect(dialog.querySelector(".exam-report-dialog__id")?.textContent).toBe("q1");
  const submit = dialog.querySelector<HTMLButtonElement>(".exam-report-dialog__submit")!;
  expect(submit.disabled).toBe(true);
  const reasons = dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  act(() => reasons[0].click());
  act(() => reasons[1].click());
  expect(reasons[0].checked).toBe(false);
  expect(reasons[1].checked).toBe(true);
  expect(submit.disabled).toBe(false);
  click("Cancel", dialog);
  expect(container.querySelector("dialog")).toBeNull();
  expect(document.activeElement?.textContent).toBe("Report a problem with this question");
  click("Report a problem with this question", panel(1));
  dialog = container.querySelector("dialog")!;
  expect(dialog.querySelector<HTMLButtonElement>(".exam-report-dialog__submit")?.disabled).toBe(true);
  act(() => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(container.querySelector("dialog")).toBeNull();
  click("Report a problem with this question", panel(1));
  click("Question 2");
  expect(container.querySelector("dialog")).toBeNull();
  click("Report a problem with this question", panel(2));
  dialog = container.querySelector("dialog")!;
  expect(dialog.querySelector("h2")?.textContent).toBe("Question 2");
  act(() => dialog.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: -1, clientY: -1 })));
  expect(container.querySelector("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(0)); // Flush jsdom focus/selection tasks from dialog dismissal.
});
it("releases teaching immediately while marks are pending, preserving raw responses and units", () => {
  expect(container.textContent).toContain("Model answer one"); expect(container.textContent).toContain("This may take a moment...");
  expect(container.textContent).toContain("You can start reviewing your answers below");
  expect(container.querySelector(".exam-results__raw")?.textContent).toBe("  unchanged answer  ");
  expect(container.textContent).toContain("5.3 kPa");
  expect(container.textContent).not.toContain("Partial credit");
  expect(container.querySelector(".exam-results__criteria")).toBeNull();
  expect(container.querySelector(".exam-results__ring")?.textContent).toBe("0%");
  expect(container.textContent).toContain("Fallback two");
});
it("preserves navigation and disclosures while delayed marks populate", () => {
  expect(panel(1).querySelector(".exam-results__scenario-text")?.hasAttribute("hidden")).toBe(true);
  click("Expand Scenario", panel(1)); click("Collapse Part 1", panel(1)); click("Question 2");
  click("Expand Scenario", panel(2));
  act(() => vi.advanceTimersByTime(16000));
  expect(panel(2).hidden).toBe(false);
  expect(panel(2).querySelector('[aria-label="Collapse Scenario"]')?.getAttribute("aria-expanded")).toBe("true");
  click("Question 1");
  expect(panel(1).querySelector('[aria-label="Expand Part 1"]')).toBeTruthy();
  expect(panel(1).querySelector(".exam-results__part-body")?.hasAttribute("hidden")).toBe(true);
  expect(panel(1).querySelector(".exam-results__part-heading")?.textContent).toContain("Partial credit");
  expect(panel(1).querySelector(".exam-results__part-heading")?.textContent).toContain("1 / 2");
  expect(panel(1).querySelector(".exam-results__scenario-text")?.hasAttribute("hidden")).toBe(false);
  click("Collapse Scenario", panel(1));
  expect(panel(1).querySelector(".exam-results__scenario-text")?.hasAttribute("hidden")).toBe(true);
});
it("withholds totals on failure and retries only the failed Part", () => {
  click("Simulate grading failure");
  expect(container.textContent).toContain("No mark assigned");
  expect(container.textContent).toContain("Final score unavailable");
  expect(container.textContent).toContain("Some grading could not be completed");
  expect(container.textContent).toContain("1 Part could not be graded at this time.");
  expect(container.querySelector(".exam-results__retry p")?.textContent).toBe("This is a technical problem — your submission is safe and already-graded Parts are shown below. There is no need to resubmit or retake this exam. Grading will complete and update automatically when available.");
  expect(container.querySelector(".exam-results__ring")).toBeNull();
  expect(panel(1).querySelector(".exam-results__criteria")).toBeNull();
  expect(panel(2).querySelector(".exam-results__part")?.getAttribute("data-status")).toBe("completed");
  const resolvedCard = panel(2).querySelector(".exam-results__part");
  click("Retry grading");
  expect(panel(2).querySelector(".exam-results__part")).toBe(resolvedCard);
  expect(resolvedCard?.getAttribute("data-status")).toBe("completed");
  expect(panel(1).querySelector(".exam-results__part")?.getAttribute("data-status")).toBe("pending");
  expect(container.querySelector(".exam-results__metadata dd")?.textContent).toBe("1 / 2");
  act(() => vi.advanceTimersByTime(2500));
  expect(container.querySelector(".exam-results__marks h1")?.textContent).toBe("2 / 3 marks");
  expect(container.querySelector(".exam-results__ring")?.textContent).toContain("67%");
  expect(sitting.answers.p1).toBe("  unchanged answer  "); expect(sitting.phase).toBe("complete");
});
it("uses display preferences without reinterpreting the submitted response or restarting grading", () => {
  act(() => vi.advanceTimersByTime(9200));
  click("Collapse Part 1", panel(1)); click("Question 2");
  render(sitting, "mmHg");
  expect(container.querySelector(".exam-results__metadata dd")?.textContent).toBe("1 / 2");
  expect(container.textContent).toContain("Model answer one in mmHg");
  expect(panel(2).textContent).toContain("5.3 kPa");
  expect(panel(2).hidden).toBe(false);
  expect(panel(1).querySelector('[aria-label="Expand Part 1"]')).toBeTruthy();
  act(() => vi.advanceTimersByTime(300));
  expect(container.querySelector(".exam-results__marks h1")?.textContent).toBe("2 / 3 marks");
  expect(container.querySelectorAll(".exam-results__metadata dd")[2].textContent).toBe("1m 0s");
});
it("replay cancels old jobs and complete cancels outstanding retries", () => {
  act(() => vi.advanceTimersByTime(8000)); click("Replay grading delay");
  act(() => vi.advanceTimersByTime(2000));
  expect(container.querySelector(".exam-results__metadata dd")?.textContent).toBe("0 / 2");
  click("Simulate grading failure"); click("Retry grading"); click("Complete grading");
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(10000));
  expect(container.querySelector(".exam-results__marks h1")?.textContent).toBe("2 / 3 marks");
});
it.each([3, 5])("supports %i Questions, optional content and unanswered outcomes", count => {
  const value: SittingState = { ...sitting, questions: Array.from({ length: count }, (_, i) => ({
    id: `q${i}`, tables: [], parts: [{ id: `part${i}`, kind: "concept", prompt: `Prompt ${i}`, marks: 1 }]
  })), answers: {} };
  render(value); click("Complete grading"); click(`Question ${count}`);
  expect(container.querySelectorAll(".exam-results__navigation button")).toHaveLength(count);
  expect(panel(count).hidden).toBe(false);
  expect(panel(count).querySelector(".exam-results__scenario")).toBeNull();
  expect(panel(count).querySelector(".exam-results__values")).toBeNull();
  expect(panel(count).querySelector(".exam-results__answer--model")).toBeNull();
  expect(panel(count).textContent).toContain("Unanswered");
  expect(container.querySelector(".exam-results__marks h1")?.textContent).toBe(`0 / ${count} marks`);
});
it("shows full and no credit distinctly and retains long multi-select and free-text responses", () => {
  const raw = "  long answer\n".repeat(100);
  const value: SittingState = { ...sitting, questions: [{ id: "answers", tables: [], parts: [
    { id: "a", kind: "concept", prompt: "Long answer", marks: 1 },
    { id: "b", kind: "multiAll", prompt: "Select", marks: 1, options: [{ id: "one", text: "Option one" }, { id: "two", text: "Option two" }] }
  ] }], answers: { a: raw, b: ["one", "two"] } };
  render(value); click("Complete grading");
  expect(container.querySelector(".exam-results__raw")?.textContent).toBe(raw);
  expect(container.textContent).toContain("Option one"); expect(container.textContent).toContain("Option two");
  expect(container.textContent).toContain("No credit"); expect(container.textContent).toContain("Full credit");
});
it("keeps multiple tables independent, orders values, and converts only pressure metrics", () => {
  const table = { id: "gas", heading: "Initial gas", grouping: "", rows: [
    { id: "lactate", label: "Lactate", value: 1.2, unit: "mmol/L" },
    { id: "na", label: "Na", value: 140, unit: "mmol/L" },
    { id: "oxygen", label: "PaO2", value: 100, unit: "mmHg", pressure: true },
    { id: "ph", label: "pH", value: 7.4, unit: "" },
    { id: "co2", label: "PaCO2", value: 40, unit: "mmHg", pressure: true },
    { id: "bicarb", label: "HCO3", value: 24, unit: "mmol/L" }
  ] };
  const value: SittingState = { ...sitting, questions: [{ ...sitting.questions[0], tables: [table, { ...table, id: "repeat", heading: "Repeat gas" }] }] };
  render(value, "kPa");
  const cards = container.querySelectorAll(".exam-results__values");
  expect(cards).toHaveLength(2);
  expect(cards[0].querySelectorAll(".exam-results__metric")).toHaveLength(3);
  expect(cards[0].querySelector(".secondary-metric-rail__grid")?.textContent).toMatch(/PaO2.*13.3.*Na.*140.*Lactate.*1.2/);
  expect(cards[0].textContent).toContain("5.3");
  click("Repeat gas⌃");
  render(value, "mmHg");
  expect(cards[0].querySelector(".exam-results__table-body")?.hasAttribute("hidden")).toBe(false);
  expect(cards[1].querySelector(".exam-results__table-body")?.hasAttribute("hidden")).toBe(true);
  expect(cards[0].textContent).toContain("40.0");
  expect(cards[0].textContent).toContain("100.0");
  expect(cards[0].textContent).toContain("140");
});
it.each(["single", "multiAll", "multiN", "numeric"] as const)("omits duplicate reference feedback for a full-credit %s result", kind => {
  const value: SittingState = { ...sitting, questions: [sitting.questions[0], {
    ...sitting.questions[1], parts: [{ ...sitting.questions[1].parts[0], kind }]
  }] };
  render(value);
  expect(panel(2).querySelector(".exam-results__answer--model")).toBeTruthy();
  click("Complete grading");
  expect(panel(2).textContent).toContain("Full credit");
  expect(panel(2).querySelector(".exam-results__answer--model")).toBeNull();
  expect(panel(2).querySelector(".exam-results__answers--single")).toBeTruthy();
  expect(panel(2).querySelector(".exam-results__answer")?.classList.contains("exam-results__answer--correct")).toBe(true);
  expect(panel(2).textContent).toContain("Your answer");
  expect(panel(2).textContent).toContain("Fallback two");
});
it.each([
  ["single", "Correct answer"], ["multiAll", "Correct answers"],
  ["multiN", "Correct answers"], ["numeric", "Accepted answer"]
] as const)("retains %s reference feedback when incorrect, partial, unanswered or unresolved", (kind, label) => {
  const value: SittingState = { ...sitting, questions: [{ ...sitting.questions[1], parts: [{ ...sitting.questions[1].parts[0], kind }] }] };
  const assertReference = () => {
    expect(panel(1).querySelector(".exam-results__answer")?.classList.contains("exam-results__answer--correct")).toBe(false);
    expect(panel(1).querySelector(".exam-results__answer--model")?.classList.contains("exam-results__answer--correct")).toBe(true);
    expect(panel(1).querySelector(".exam-results__answer--model h4")?.textContent).toBe(label);
    expect(panel(1).querySelector(".exam-results__answer--model")?.textContent).toContain("Model answer two");
    expect(panel(1).querySelectorAll(".exam-results__answer")).toHaveLength(2);
  };
  render(value); assertReference();
  click("Simulate grading failure"); assertReference();
  expect(panel(1).textContent).toContain("Grading unavailable");
  click("Complete grading"); assertReference();
  expect(panel(1).textContent).toContain("No credit");
  render({ ...value, questions: [{ ...value.questions[0], parts: [{ ...value.questions[0].parts[0], marks: 2 }] }] });
  click("Complete grading"); assertReference();
  expect(panel(1).textContent).toContain("Partial credit");
  render({ ...value, answers: {} }); click("Complete grading"); assertReference();
  expect(panel(1).textContent).toContain("Unanswered");
});
it("keeps Your answer and Model answer for full-credit written SAQs", () => {
  const value: SittingState = { ...sitting, questions: [sitting.questions[0], {
    ...sitting.questions[1], parts: [{ ...sitting.questions[1].parts[0], kind: "concept" }]
  }] };
  render(value); click("Complete grading");
  expect(panel(2).textContent).toContain("Full credit");
  expect(panel(2).querySelector(".exam-results__answer--model h4")?.textContent).toBe("Model answer");
  expect(panel(2).querySelectorAll(".exam-results__answer")).toHaveLength(2);
});
it("pairs rationales with option text in displayed order and follows review units", () => {
  const feedback = demoFeedback.p1;
  const originalRationales = feedback.rationales;
  try {
    feedback.rationales = [
      { id: "second", text: { mmHg: "Second rationale mmHg", kPa: "Second rationale kPa" } },
      { id: "first", text: { mmHg: "First rationale mmHg", kPa: "First rationale kPa" } },
      { id: "missing-id", text: { mmHg: "Unresolved rationale", kPa: "Unresolved rationale" } }
    ];
    const value: SittingState = { ...sitting, questions: [{ ...sitting.questions[0], parts: [{
      ...sitting.questions[0].parts[0], kind: "single", options: [
        { id: "first", text: "PaCO2 40 mmHg", textKpa: "PaCO2 5.3 kPa" },
        { id: "second", text: "Second option" },
        { id: "no-rationale", text: "Option without rationale" }
      ]
    }] }] };
    render(value, "mmHg");
    const disclosure = panel(1).querySelector<HTMLDetailsElement>(".exam-results__option-breakdown")!;
    expect(disclosure.querySelector("summary")?.textContent).toBe("›Option breakdown");
    expect(disclosure.open).toBe(false);
    act(() => { disclosure.open = true; });
    act(() => vi.advanceTimersByTime(0)); // Flush the browser's queued details toggle event.
    const entries = disclosure.querySelectorAll(":scope > div");
    expect(entries).toHaveLength(3);
    expect(entries[0].querySelector("h4")?.textContent).toBe("PaCO2 40 mmHg");
    expect(entries[0].querySelector("sub")?.textContent).toBe("2");
    expect(entries[0].querySelector("p")?.textContent).toBe("First rationale mmHg");
    expect(entries[1].querySelector("h4")?.textContent).toBe("Second option");
    expect(entries[2].textContent).toContain("Option text unavailable");
    expect(disclosure.textContent).not.toContain("missing-id");
    render(value, "kPa"); click("Complete grading");
    expect(disclosure.open).toBe(true);
    expect(entries[0].querySelector("h4")?.textContent).toBe("PaCO2 5.3 kPa");
    expect(entries[0].querySelector("p")?.textContent).toBe("First rationale kPa");
    expect(entries[1].querySelector("h4")?.textContent).toBe("Second option");
  } finally { feedback.rationales = originalRationales; }
});
function resourceSitting(): SittingState {
  return { ...sitting, questions: [{ id: "resource", tables: [], parts: [
    { id: "EXAM-0003-P2", kind: "numeric", prompt: "Predict", marks: 1, pressureAnswer: true }
  ] }], answers: { "EXAM-0003-P2": "5.3" } };
}
it("renders the real compensation resource, preserves its disclosure through grading and follows review units", () => {
  const value = resourceSitting(); render(value, "kPa");
  expect(container.querySelector(".cmp")).toBeTruthy();
  expect(container.querySelector(".exam-results__reasoning")).toBeNull();
  act(() => container.querySelector<HTMLButtonElement>(".cmp-calc__toggle")!.click());
  click("Complete grading");
  render(value, "mmHg");
  expect(container.textContent).toContain("Hide calculation");
  expect(container.querySelector(".cmp")?.textContent).toContain("mmHg");
  expect(container.querySelector(".exam-results__raw")?.textContent).toBe("5.3 kPa");
});
it("falls back to authored teaching when a resource throws", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  resourceState.fail = true; render(resourceSitting(), "mmHg");
  expect(container.querySelector(".exam-results__reasoning")?.textContent).toContain("Winter");
  expect(container.querySelector(".exam-results__answer--model")).toBeTruthy();
});
it("shows fallback for invalid resources and both text and graphics when authored", () => {
  const feedback = demoFeedback["EXAM-0003-P2"];
  const originalResources = feedback.resources;
  const originalDisplay = feedback.display;
  try {
    feedback.display = "text_and_resources";
    render(resourceSitting());
    expect(container.querySelector(".cmp")).toBeTruthy();
    expect(container.querySelector(".exam-results__reasoning")).toBeTruthy();
    feedback.resources = [{ kind: "compensation", result: {} }];
    render(resourceSitting());
    expect(container.querySelector(".cmp")).toBeNull();
    expect(container.querySelector(".exam-results__reasoning")).toBeTruthy();
  } finally {
    feedback.resources = originalResources; feedback.display = originalDisplay;
  }
});
it("renders A-a resources in both units with collapsed calculations and invalid-data fallback", () => {
  const feedback = demoFeedback["EXAM-0003-P2"];
  const original = feedback.resources;
  try {
    feedback.resources = [{ kind: "aa_gradient", result: {
      formulaVersion: "alveolar_gas_v1", canonicalUnit: "mmHg",
      inputs: { fio2Fraction: 1, measuredPaCO2MmHg: 81, measuredPaO2MmHg: 78 },
      assumptions: { barometricPressureMmHg: 760, waterVapourPressureMmHg: 47, respiratoryQuotient: 0.8 },
      calculated: { inspiredOxygenPressureMmHg: 713, co2CorrectionMmHg: 101.25,
        alveolarOxygenPressureMmHg: 611.75, aaGradientMmHg: 533.75 },
      interpretation: { key: "exam_calculation", tone: "context", label: "Calculated A-a gradient",
        explanation: "Interpret with the clinical context." }
    } }];
    render(resourceSitting(), "mmHg");
    expect(container.querySelector(".aag")).toBeTruthy();
    expect(container.querySelector(".exam-results__reasoning")).toBeNull();
    expect(container.querySelector(".aag-calc__toggle")?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".aag")?.textContent).toContain("mmHg");
    render(resourceSitting(), "kPa");
    expect(container.querySelector(".aag")?.textContent).toContain("kPa");
    feedback.resources = [{ kind: "aa_gradient", result: {} }];
    render(resourceSitting());
    expect(container.querySelector(".aag")).toBeNull();
    expect(container.querySelector(".exam-results__reasoning")).toBeTruthy();
  } finally { feedback.resources = original; }
});
