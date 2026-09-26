// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamSittingProvider, useExamSitting } from "./ExamSittingContext";
import { ExamResponse, ExamSitting } from "./ExamSitting";
import { presentExamMetric } from "./ExamValues";
import { elapsedSeconds, sittingReducer, unansweredCount } from "./sittingModel";
import type { ExamPart, ExamQuestion } from "./sittingTypes";
import { SettingsPopover } from "../layout/SettingsPopover";
import { AppShell } from "../layout/AppShell";
import { ExamScreen } from "../screens/ExamScreen";

const patchSession = vi.fn();
vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      practiceState: { syncState: "idle", lastCaseSummary: null, pendingSubmission: null },
      payload: { progressionConfig: null, dashboardState: null, defaultUserState: null, cases: [] },
      userState: {}, sessionState: { pressureUnit: "kPa" },
      calibrationState: { localCompletion: {}, effectiveCompletion: {}, remoteStatus: "resolved" },
      storage: { loadSeenCaseState: () => ({}), savePressureUnitPreference: vi.fn() },
      appStatus: { warnings: {}, blocking: null }
    },
    patchSessionState: patchSession,
    retryPendingSubmissionNow: vi.fn(), discardPendingSubmission: vi.fn()
  })
}));
vi.mock("../../core/analytics", () => ({ trackEvent: vi.fn(), trackPageView: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const questions: ExamQuestion[] = [
  { id: "q1", tables: [], parts: [
    { id: "a", kind: "single", marks: 1, prompt: "Choose one", options: [{ id: "a1", text: "First" }, { id: "a2", text: "Second" }] },
    { id: "b", kind: "concept", marks: 2, prompt: "Name it" }
  ] },
  { id: "q2", tables: [], parts: [{ id: "c", kind: "numeric", marks: 1, prompt: "Enter pressure", pressureAnswer: true }] }
];

describe("Exam prototype model", () => {
  it("uses arbitrary dimensions, remembers Part positions and preserves responses through review", () => {
    let s = sittingReducer(null, { type: "start", questions: [...questions, ...Array.from({ length: 3 }, (_, i) => ({
      id: "extra" + i, tables: [], parts: [{ id: "extra-part" + i, kind: "concept" as const, prompt: "Extra", marks: 1 }]
    }))], pressureUnit: "kPa", now: 1000 })!;
    expect(s.questions).toHaveLength(5);
    s = sittingReducer(s, { type: "jump", questionIndex: 0, partIndex: 1 })!;
    s = sittingReducer(s, { type: "answer", partId: "b", value: "  raw answer  " })!;
    s = sittingReducer(s, { type: "jump", questionIndex: 4 })!;
    s = sittingReducer(s, { type: "jump", questionIndex: 0 })!;
    expect(s.partIndices.q1).toBe(1);
    expect(s.answers.b).toBe("  raw answer  ");
    expect(unansweredCount(s)).toBe(5);
    expect(s.pressureUnit).toBe("kPa");
    s = sittingReducer(s, { type: "review" })!;
    s = sittingReducer(s, { type: "timer" })!;
    expect(elapsedSeconds(s, 66000)).toBe(65);
    s = sittingReducer(s, { type: "submit", now: 66000 })!;
    expect(elapsedSeconds(s, 99000)).toBe(65);
    expect(sittingReducer(s, { type: "answer", partId: "b", value: "changed" })).toBe(s);
    expect(sittingReducer(s, { type: "jump", questionIndex: 0 })).toBe(s);
    expect(sittingReducer(s, { type: "exit" })).toBeNull();
  });
  it("formats supplied pressure ranges without adding abnormal highlighting or converting other units", () => {
    const metric = { id: "gas", label: "PCO2", value: 61, unit: "mmHg", pressure: true, refLow: 35, refHigh: 45 };
    expect(presentExamMetric(metric, "kPa")).toMatchObject({ renderedValue: "8.1", reference: "4.7 - 6.0 kPa", unit: "kPa", abnormal: false });
    expect(presentExamMetric({ ...metric, pressure: false, unit: "cm H2O" }, "kPa")).toMatchObject({ renderedValue: "61.0", unit: "cm H2O" });
  });
  it.each([
    ["pH", "7.40", "", "7.35–7.45", "7.40", "7.35 - 7.45"],
    ["HCO3", "22", "mmol/L", "22–26", "22.0", "22 - 26 mmol/L"],
    ["Na", "138", "mmol/L", "135–145", "138", "135 - 145 mmol/L"],
    ["K", "4", "mmol/L", "3.5–5", "4.0", "3.5 - 5.0 mmol/L"],
    ["Lactate", "2", "mmol/L", "0.5–2", "2.0", "0.5 - 2.0 mmol/L"],
    ["MetHb", "15.8", "%", "0–1.5", "15.8", "0 - 1.5 %"],
    ["FiO2", "0.21", "fraction", "—", "0.21", ""],
  ])("formats %s without changing supplied ranges or marking abnormalities", (label, value, unit, reference, renderedValue, expectedReference) => {
    expect(presentExamMetric({ id: label, label, value, unit, reference }, "mmHg"))
      .toMatchObject({ renderedValue, reference: expectedReference, abnormal: false });
  });
  it("counts all completed response forms without interpreting correctness", () => {
    let s = sittingReducer(null, { type: "start", questions, pressureUnit: "mmHg", now: 0 })!;
    for (const [partId, value] of [["a", "a2"], ["b", "anything"], ["c", "999"]] as const) {
      s = sittingReducer(s, { type: "answer", partId, value })!;
    }
    expect(unansweredCount(s)).toBe(0);
    expect(sittingReducer(s, { type: "submit", now: 1000 })).toBe(s);
    s = sittingReducer(s, { type: "review" })!;
    expect(sittingReducer(s, { type: "submit", now: 1000 })?.phase).toBe("complete");
  });
});

describe("Exam presentation interactions", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let router: ReturnType<typeof createMemoryRouter> | undefined;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  });
  afterEach(() => {
    act(() => root.unmount());
    router?.dispose();
    router = undefined;
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  function click(text: string) {
    const button = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === text);
    expect(button, text).toBeTruthy();
    act(() => button!.click());
  }
  function Harness() {
    const { sitting, dispatch } = useExamSitting();
    const [unit, setUnit] = useState<"mmHg" | "kPa">("kPa");
    const locked = Boolean(sitting && sitting.phase !== "complete");
    return <>
      <SettingsPopover open pressureUnit={locked ? sitting!.pressureUnit : unit} pressureUnitLocked={locked}
        examRanges={locked ? sitting!.showRanges : undefined} onExamRangesChange={() => dispatch({ type: "ranges" })}
        onToggle={() => {}} onClose={() => {}} onPressureUnitChange={setUnit} />
      <Link to="/other">Leave area</Link>
      {sitting ? <ExamSitting sitting={sitting} dispatch={dispatch} /> :
        <button onClick={() => dispatch({ type: "start", questions, pressureUnit: unit, now: Date.now() })}>Start</button>}
    </>;
  }
  function mount() {
    router = createMemoryRouter([{ element: <ExamSittingProvider><Outlet /></ExamSittingProvider>, children: [
      { path: "/exam", element: <Harness /> }, { path: "/other", element: <div>Other area</div> }
    ] }], { initialEntries: ["/exam"] });
    act(() => root.render(<RouterProvider router={router!} />));
    click("Start");
  }
  it("navigates across Questions, reviews all Parts, keeps edits and completes without a fake result", () => {
    mount();
    expect(container.querySelector('button[aria-label="Question 1"]')?.getAttribute("aria-current")).toBe("step");
    act(() => container.querySelector<HTMLInputElement>('input[type="radio"]')!.click());
    click("Next part");
    click("Next question");
    expect(container.querySelector('input[aria-label="Numeric answer in kPa"]')).not.toBeNull();
    click("Previous");
    expect(container.textContent).toContain("Name it");
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Question 2"]')!.click());
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Question 1"]')!.click());
    expect(container.textContent).toContain("Name it");
    act(() => container.querySelector<HTMLButtonElement>(".exam-question-pills button:last-child")!.click());
    while (Array.from(container.querySelectorAll("button")).some(b => b.textContent?.startsWith("Next part"))) click("Next part");
    click("Review exam");
    expect(container.querySelectorAll(".exam-review-part")).toHaveLength(3);
    expect(container.querySelector(".exam-final-review")!.textContent).not.toContain("First");
    expect(container.textContent).toContain("2 parts not answered");
    act(() => container.querySelector<HTMLButtonElement>(".exam-review-part")!.click());
    expect(container.querySelector<HTMLInputElement>('input[type="radio"]')!.checked).toBe(true);
    act(() => container.querySelector<HTMLButtonElement>(".exam-question-pills button:last-child")!.click());
    while (Array.from(container.querySelectorAll("button")).some(b => b.textContent?.startsWith("Next part"))) click("Next part");
    click("Review exam");
    click("Submit anyway");
    expect(container.textContent).toContain("Prototype complete");
    expect(container.textContent).not.toContain("Continue to result");
    expect(container.querySelector<HTMLButtonElement>(".main-nav__unit-option")!.disabled).toBe(false);
    click("Back to Exam Room");
    expect(container.textContent).toContain("Start");
  });
  it("locks pressure only during the attempt, toggles ranges, and hiding the timer never pauses it", async () => {
    mount();
    expect(container.textContent).toContain("Fixed for this exam");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>(".main-nav__unit-control button")).every(b => b.disabled)).toBe(true);
    click("On");
    expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
    click("Hide timer");
    act(() => { vi.advanceTimersByTime(65000); });
    click("Show timer");
    expect(container.querySelector(".exam-elapsed")?.textContent).toContain("01:05");
    await act(async () => { container.querySelector<HTMLAnchorElement>("a")!.click(); });
    await act(async () => click("Exit anyway"));
    expect(router!.state.location.pathname).toBe("/other");
  });
  it("launches from the real dashboard without a start page and coordinates real shell Settings", async () => {
    vi.useRealTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    router = createMemoryRouter([{ element: <AppShell />, children: [
      { path: "/exam", element: <ExamScreen /> }
    ] }], { initialEntries: ["/exam"] });
    act(() => root.render(<RouterProvider router={router!} />));
    click("Mock Exam");
    await act(async () => {
      click("Begin mock exam");
      await vi.dynamicImportSettled();
    });
    expect(container.querySelectorAll(".exam-question-pills button")).toHaveLength(3);
    expect(container.textContent).not.toContain("You're about to begin");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click());
    expect(container.textContent).toContain("Fixed for this exam");
    expect(container.querySelector<HTMLButtonElement>('.main-nav__unit-option[aria-pressed="true"]')?.textContent).toBe("kPa");
    expect(container.querySelectorAll(".metric-card__reference").length).toBeGreaterThan(0);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Exam reference ranges"]')!.click());
    expect(container.querySelectorAll(".metric-card__reference")).toHaveLength(0);
    act(() => container.querySelector<HTMLButtonElement>(".exam-question-pills button:last-child")!.click());
    while (Array.from(container.querySelectorAll("button")).some(b => b.textContent?.startsWith("Next part"))) click("Next part");
    click("Review exam");
    expect(container.querySelectorAll(".exam-review-part")).toHaveLength(11);
    click("Submit anyway");
    click("Back to Exam Room");
    expect(container.textContent).toContain("Begin mock exam");
    expect(container.textContent).not.toContain("Fixed for this exam");
  });
  it("confirms route navigation and allows staying before exit", async () => {
    mount();
    await act(async () => { container.querySelector<HTMLAnchorElement>('a')!.click(); });
    expect(container.querySelector("dialog")?.textContent).toContain("Exit this exam?");
    click("Stay");
    expect(router!.state.location.pathname).toBe("/exam");
    await act(async () => { container.querySelector<HTMLAnchorElement>("a")!.click(); });
    click("Stay");
    expect(container.querySelector('button[aria-label="Question 1"]')?.getAttribute("aria-current")).toBe("step");
    await act(async () => { container.querySelector<HTMLAnchorElement>('a')!.click(); });
    await act(async () => { Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Exit anyway")!.click(); });
    expect(router!.state.location.pathname).toBe("/other");
  });
  it.each(["multiAll", "multiN", "concept", "numeric"] as const)("retains raw values for %s controls", kind => {
    let answer: unknown;
    const part: ExamPart = { id: "test", kind, prompt: "Test", marks: 1, selectN: 2, pressureAnswer: true,
      options: [{ id: "stable-a", text: "A" }, { id: "stable-b", text: "B" }] };
    function Control() {
      const [value, setValue] = useState<string | string[]>();
      return <ExamResponse part={part} value={value} unit="kPa" onChange={v => { answer = v; setValue(v); }} />;
    }
    act(() => root.render(<Control />));
    if (kind.startsWith("multi")) {
      act(() => container.querySelector<HTMLInputElement>("input")!.click());
      expect(answer).toEqual(["stable-a"]);
      act(() => container.querySelector<HTMLInputElement>("input")!.click());
      expect(answer).toEqual([]);
    } else {
      const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")!;
      const proto = kind === "numeric" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      act(() => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, " 4.20 ");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(answer).toBe(" 4.20 ");
    }
  });
});
