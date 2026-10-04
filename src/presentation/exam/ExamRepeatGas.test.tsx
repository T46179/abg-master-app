// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExamValues, presentExamMetric } from "./ExamValues";
import { ExamResultValues } from "./ExamResultValues";
import { ExamSitting } from "./ExamSitting";
import { sittingReducer, type SittingAction } from "./sittingModel";
import type { ExamQuestion, ExamTable, SittingState } from "./sittingTypes";
import { toSitting } from "../../core/examRuntime";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const initial: ExamTable = { id: "initial", heading: "Initial ABG", grouping: "", rows: [
  { id: "i-co2", label: "PaCO2", value: 228, unit: "mmHg", pressure: true, primary: true, refLow: 35, refHigh: 45 },
  { id: "i-na", label: "Na", value: 142, unit: "mmol/L" },
] };
const repeat: ExamTable = { id: "repeat", heading: "Repeat ABG", grouping: "", rows: [
  { id: "r-co2", label: "PaCO2", value: 68, initialValue: 228, unit: "mmHg", pressure: true, primary: true, refLow: 35, refHigh: 45 },
  { id: "r-be", label: "BE", value: -7, initialValue: -23.7, unit: "mEq/L", refLow: -2, refHigh: 2 },
  { id: "r-fio2", label: "FiO2", value: 0.5, initialValue: 1, unit: "" },
] };
const question: ExamQuestion = { id: "asthma", scenario: "Initial story and repeat story", tables: [initial, repeat],
  sections: [{ id: "story1", type: "text", content: "Initial story" }, { id: "initial", type: "data_table", tableId: "initial" },
    { id: "story2", type: "text", content: "Repeat story" }, { id: "repeat", type: "data_table", tableId: "repeat" }],
  parts: [
    { id: "p1", kind: "concept", marks: 1, prompt: "First assessment", stimulusSectionIds: ["story1", "initial"] },
    { id: "p2", kind: "concept", marks: 1, prompt: "Second assessment", stimulusSectionIds: ["story1", "initial"] },
    { id: "p3", kind: "concept", marks: 1, prompt: "Repeat assessment", stimulusSectionIds: ["story2", "repeat"] },
  ] };
let container: HTMLDivElement, root: Root;
let router: ReturnType<typeof createMemoryRouter> | undefined;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); router?.dispose(); router = undefined; container.remove(); });
function renderValues(table = repeat, showRanges = true) {
  act(() => root.render(<ExamValues table={table} pressureUnit="mmHg" showRanges={showRanges} />));
}
function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(b => b.textContent?.includes(label) || b.getAttribute("aria-label") === label)!;
  expect(button).toBeTruthy(); act(() => button.click());
}
describe("repeat-gas comparison presentation", () => {
  it("formats both values and bounds in the active pressure unit", () => {
    expect(presentExamMetric(repeat.rows[0], "kPa", true)).toMatchObject({ renderedValue: "9.1", unit: "kPa",
      comparison: { initialValue: "30.4", referenceRange: "4.7 - 6.0" } });
    expect(presentExamMetric(repeat.rows[1], "kPa", true).comparison).toEqual({ initialValue: "-23.7", referenceRange: "-2 - 2" });
    expect(presentExamMetric({ ...repeat.rows[0], initialValue: 0 }, "mmHg", true).comparison?.initialValue).toBe("0.0");
    expect(presentExamMetric(repeat.rows[0], "mmHg").comparison).toBeUndefined();
  });
  it("renders INITIAL and REF without footer units in primary and secondary cards", () => {
    renderValues();
    const footers = [...container.querySelectorAll(".metric-card__comparison")];
    expect(footers).toHaveLength(3);
    expect(footers[0].textContent).toBe("INITIAL228.0REF35 - 45");
    expect(footers[1].textContent).toBe("INITIAL-23.7REF-2 - 2");
    expect(footers[2].textContent).toBe("INITIAL1");
    expect(container.querySelector(".metric-card__value")?.textContent).toBe("68.0mmHg");
  });
  it("keeps INITIAL with hidden or unavailable ranges and retains zero", () => {
    renderValues({ ...repeat, rows: [{ ...repeat.rows[0], initialValue: 0 }] }, false);
    expect(container.querySelector(".metric-card__comparison")?.textContent).toBe("INITIAL0.0");
    renderValues({ ...repeat, rows: [{ ...repeat.rows[0], refLow: undefined, refHigh: undefined }] });
    expect(container.querySelector(".metric-card__comparison")?.textContent).toBe("INITIAL228.0");
  });
  it("renders the existing normal card when no initial matches", () => {
    renderValues(initial);
    expect(container.querySelector(".metric-card__comparison")).toBeNull();
    expect(container.querySelector(".metric-card__reference")?.textContent).toBe("35 - 45 mmHg");
  });
  it("does not introduce comparison footers into the deferred Results layout", () => {
    act(() => root.render(<ExamResultValues table={repeat} pressureUnit="mmHg" visible />));
    expect(container.querySelector(".metric-card__comparison")).toBeNull();
  });
});
describe("Part-specific stimulus selection", () => {
  function mount(sitting: SittingState) {
    function Harness() {
      const [state, setState] = useState(sitting);
      const dispatch = (action: SittingAction) => setState(s => sittingReducer(s, action) ?? s);
      return <ExamSitting sitting={state} dispatch={dispatch} />;
    }
    router = createMemoryRouter([{ path: "/", element: <Harness /> }]);
    act(() => root.render(<RouterProvider router={router!} />));
  }
  it("switches only the displayed sections through Next, Previous and direct Part navigation", () => {
    mount(sittingReducer(null, { type: "start", questions: [question], pressureUnit: "mmHg", now: 0 })!);
    expect(container.querySelector(".exam-scenario")?.textContent).toContain("Initial story");
    expect(container.querySelector('[aria-label="Repeat ABG"]')).toBeNull();
    click("Next part"); click("Next part");
    expect(container.querySelector(".exam-scenario")?.textContent).toContain("Repeat story");
    expect(container.querySelector('[aria-label="Initial ABG"]')).toBeNull();
    expect(container.textContent).not.toContain("Na");
    click("Previous");
    expect(container.querySelector(".exam-scenario")?.textContent).toContain("Initial story");
    click("Part 3, not answered");
    expect(container.querySelector(".exam-scenario")?.textContent).toContain("Repeat story");
  });
  it("restores selected sections from recovered payloads without extra scenario state", () => {
    let state = toSitting({ id: "attempt", status: "active", revision: 1, pressureUnit: "kPa", createdAt: "2026-10-03T00:00:00Z",
      presentedAt: null, finishedAt: null, questions: [question], answers: { p1: "Saved response" } });
    state = sittingReducer(state, { type: "jump", questionIndex: 0, partIndex: 2 })!;
    mount(state);
    expect(container.querySelector(".exam-scenario")?.textContent).toContain("Repeat story");
    expect(container.querySelector(".metric-card__value")?.textContent).toBe("9.1kPa");
    click("Part 1, answered");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Saved response");
    expect(container.querySelector(".exam-scenario")?.textContent).toContain("Initial story");
  });
  it("keeps the legacy shared stimulus when a Part omits selection", () => {
    const legacy = { ...question, parts: [{ ...question.parts[0], stimulusSectionIds: undefined }] };
    mount(sittingReducer(null, { type: "start", questions: [legacy], pressureUnit: "mmHg", now: 0 })!);
    expect(container.querySelector(".exam-scenario")?.textContent).toContain(question.scenario);
    expect(container.querySelectorAll(".exam-values")).toHaveLength(2);
  });
});
