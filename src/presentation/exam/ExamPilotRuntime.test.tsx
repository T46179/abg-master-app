// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExamSittingProvider } from "./ExamSittingContext";
import ExamPilotRuntime from "./ExamPilotRuntime.dev";
import type { RuntimeAttempt } from "../../core/examRuntime";
vi.mock("../../app/AppProvider", () => ({ useAppContext: () => ({ state: { sessionState: { pressureUnit: "kPa" } } }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let attempt: RuntimeAttempt;
let loseSubmission = false;
let router: ReturnType<typeof createMemoryRouter>;
const invoke = vi.fn();
const client = { functions: { invoke } } as unknown as SupabaseClient;
const categories = [{ category_id: "toxicology_management", label: "Toxicology management and antidotes" }, { category_id: "mechanical_ventilation", label: "Mechanical ventilation" }];
function historyPage(rows: any[] = []) {
 return { attempts: rows, nextCursor: null, latestAttemptId: rows[0]?.id ?? null, total: rows.length,
 counts: { all: rows.length, mock: rows.filter(r => r.examKind === "mock").length, custom: rows.filter(r => r.examKind === "custom").length },
 summary: { submitted: rows.length, average: null, best: null, trend: [], totalCases: rows.reduce((n,r)=>n+r.caseCount,0), awaiting: rows.length, pending: rows.length } };
}
function row(id: string, kind = "mock", exclusions: string[] = []) { return { id, createdAt: "2026-10-05T00:00:00Z", presentedAt: null, finishedAt: "2026-10-05T00:10:00Z", marksAvailable: 4, marksAwarded: null, caseCount: 3, examKind: kind, excludedCategories: exclusions, gradingStatus: "pending", canRetryGrading: false }; }
async function mount(unitCount = 3, customisationCategories: typeof categories = [], allowedUnitCounts?: number[]) {
 router = createMemoryRouter([{ path: "/", element: <ExamSittingProvider><ExamPilotRuntime client={client} userId="test-owner" canStart unitCount={unitCount} allowedUnitCounts={allowedUnitCounts} customisationCategories={customisationCategories} /></ExamSittingProvider> }, { path: "/away", element: <p>Away</p> }]);
 await act(async () => { root.render(<RouterProvider router={router} />); });
}
async function click(text: string) {
 const button = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!;
 expect(button).toBeTruthy(); await act(async () => button.click());
}
beforeEach(() => {
 Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
 localStorage.clear(); invoke.mockReset(); loseSubmission = false;
 attempt = { id: "test-attempt", marksAvailable: 2, status: "active", revision: 0, pressureUnit: "kPa", createdAt: new Date().toISOString(), presentedAt: null, finishedAt: null, answers: {}, questions: [{ id: "test-unit", tables: [], parts: [{ id: "part", kind: "concept", prompt: "Explain your answer", marks: 2 }] }] };
 invoke.mockImplementation(async (_name, { body: { operation, input } }) => {
   if (operation === "current") return { data: { attempt: null } };
   if (operation === "history_page") return { data: historyPage() };
   if (operation === "start") attempt = { ...attempt, examKind: input.examKind, excludedCategories: input.excludedCategories };
   if (operation === "present") attempt = { ...attempt, revision: attempt.revision + 1, presentedAt: new Date().toISOString() };
   if (operation === "save") attempt = { ...attempt, revision: attempt.revision + 1, answers: input.answers };
   if (operation === "submit") {
     attempt = { ...attempt, status: "submitted", answers: input.answers, finishedAt: new Date().toISOString(), parts: [{ partId: "part", status: "pending" }], feedback: { part: { answer: { mmHg: "Reference answer", kPa: "Reference answer" }, reasoning: { mmHg: "Teaching explanation", kPa: "Teaching explanation" }, primaryObjective: "test", display: "text_and_resources", resources: [], criteria: [] } } };
     if (loseSubmission) { loseSubmission = false; return { error: new Error("lost response") }; }
   }
   return { data: structuredClone(attempt) };
 });
 container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("saves raw answers and shows teaching with pending marks only after acceptance", async () => {
 await mount(); await click("Begin");
 const textarea = container.querySelector("textarea")!;
 await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "  raw answer  "); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
 expect(attempt.answers.part).toBe("  raw answer  ");
 expect(container.textContent).not.toContain("Teaching explanation");
 await click("Review exam"); await click("Submit");
 expect(container.textContent).toContain("Teaching explanation");
 expect(container.textContent).toContain("Grading pending");
 expect(container.textContent).not.toContain("Development preview");
 expect(container.textContent).not.toContain("Criterion breakdown");
 expect(container.querySelector(".exam-results__part-marks")!.textContent).toContain("— / 2");
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "start")).toHaveLength(1);
});
it("locks review after a lost submission response and recovers Results without resubmitting", async () => {
 await mount(); await click("Begin"); await click("Review exam");
 loseSubmission = true; await click("Submit anyway");
 expect(container.textContent).not.toContain("Teaching explanation");
 expect(container.querySelector('fieldset')!.disabled).toBe(true);
 await click("Check submission / retry");
 expect(container.textContent).toContain("Teaching explanation");
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "submit")).toHaveLength(1);
});
it("reload recovers the same questions and saved raw answer through read and claim", async () => {
 await mount(); await click("Begin");
 const textarea = container.querySelector("textarea")!;
 await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "saved draft"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
 await act(async () => root.unmount()); root = createRoot(container); await mount(); await click("Recover attempt");
 expect(container.querySelector('textarea')!.value).toBe("saved draft");
 expect(invoke.mock.calls.some(c => c[1].body.operation === "claim")).toBe(true);
});

it("navigation waits for server abandonment and stays in the exam on failure", async () => {
 await mount(); await click("Begin");
 await act(async () => { void router.navigate("/away"); });
 expect(container.querySelector("dialog")).not.toBeNull();
 invoke.mockResolvedValueOnce({ error: new Error("offline") });
 await click("Exit anyway");
 expect(router.state.location.pathname).toBe("/");
 expect(container.textContent).toContain("Exit could not be confirmed");
 await act(async () => { void router.navigate("/away"); });
 await click("Exit anyway");
 expect(router.state.location.pathname).toBe("/away");
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "abandon")).toHaveLength(2);
});

it("automatically renders completed server marks without a manual refresh control", async () => {
 vi.useFakeTimers();
 await mount(); await click("Begin"); await click("Review exam"); await click("Submit anyway");
 attempt = { ...attempt, gradingStatus: "completed", marksAwarded: 1, parts: [{ partId: "part", status: "completed", marksAwarded: 1, marksAvailable: 2, criteria: { a: 0, b: 1 } }],
   feedback: { ...attempt.feedback!, part: { ...attempt.feedback!.part, criteria: [{ id: "a", label: "First criterion" }, { id: "b", label: "Second criterion" }] } } };
 await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
 expect(container.textContent).not.toContain("Refresh grading status");
 expect(container.querySelector(".exam-results__marks h1")?.textContent).toBe("1 / 2 marks");
 const rows = [...container.querySelectorAll('[aria-label="Criterion marks"] li')];
 expect(rows[0].textContent).toContain("0 / 1"); expect(rows[1].textContent).toContain("1 / 1");
 expect(container.textContent).not.toContain("Development preview");
});
it("retries failed grading through its own operation without resubmitting", async () => {
 vi.useFakeTimers();
 await mount(); await click("Begin"); await click("Review exam"); await click("Submit anyway");
 attempt = { ...attempt, gradingStatus: "failed", canRetryGrading: true, parts: [{ partId: "part", status: "failed" }] };
 await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); await click("Retry grading");
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "retry_grading")).toHaveLength(1);
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "submit")).toHaveLength(1);
});

it("reports against the displayed attempt and keeps confirmation inside the popup", async () => {
 vi.useFakeTimers();
 await mount(); await click("Begin"); await click("Review exam"); await click("Submit anyway");
 await click("Report a problem with this question");
 await act(async () => container.querySelector<HTMLInputElement>('input[type="radio"]')!.click());
 invoke.mockResolvedValueOnce({data:{reportId:"12345678-1234-1234-1234-123456789abc"}});
 await click("Submit");
 const report=invoke.mock.calls.find(c=>c[1].body.operation==='report_problem')![1].body.input;
 expect(report.attemptId).toBe('test-attempt'); expect(report.questionId).toBe('test-unit'); expect(report.details).toBe('');
 expect(container.querySelector('dialog')!.textContent).toContain('Report Submitted.');
 expect(container.querySelector('section[aria-label="Exam pilot"] > p[role="status"]')).toBeNull();
 await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
 expect(container.querySelector('dialog')!.textContent).toContain('Report Submitted.');
 await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close report dialog"]')!.click());
 expect(container.querySelector('dialog')).toBeNull();
 expect(invoke.mock.calls.filter(c=>c[1].body.operation==='submit')).toHaveLength(1);
});

it("uses the account count and the connected runtime on localhost", async () => {
 vi.stubGlobal("location", { hostname: "127.0.0.1" });
 await mount(4);
 expect(container.textContent).toContain("4 cases");
 expect(container.textContent).not.toContain("Local preview");
 await click("Begin");
 expect(invoke.mock.calls.some(c => c[1].body.operation === "start")).toBe(true);
});
it("retains the three-Unit tester description", async () => {
 await mount(); expect(container.textContent).toContain("3 cases");
});

it("defaults to Mock, remembers Custom inclusions without erasing them, and sends only Custom exclusions", async () => {
  localStorage.setItem("abgm-exam-custom-clpfecuohwzwrgmqzeos-test-owner", '["mechanical_ventilation"]');
  await mount(3, categories);
  expect(container.querySelector('[aria-label="Sitting type"] [aria-pressed="true"]')?.textContent).toBe("Standard Examdefault settings");
  await click("Custom ExamChoose what's included");
  expect(container.textContent).toContain("Interpretation, calculations, physiology and reasoning are always included.");
  const switches = [...container.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
  expect(switches.slice(0,2).map(b => b.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  await act(async () => switches[1].click());
  await click("Standard Examdefault settings");
  expect(JSON.parse(localStorage.getItem("abgm-exam-custom-clpfecuohwzwrgmqzeos-test-owner")!)).toEqual(["mechanical_ventilation", "toxicology_management"]);
  await click("Begin");
  expect(invoke.mock.calls.find(c => c[1].body.operation === "start")![1].body.input).toMatchObject({ examKind: "mock", excludedCategories: [] });
});
it("sends catalogue exclusions and hides setup while a start needs recovery", async () => {
  await mount(3, categories); await click("Custom ExamChoose what's included");
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Include Toxicology"]')!.click());
  invoke.mockResolvedValueOnce({ error: new Error("lost start") });
  await click("Begin");
  const input = invoke.mock.calls.find(c => c[1].body.operation === "start")![1].body.input;
  expect(input).toMatchObject({ examKind: "custom", excludedCategories: ["toxicology_management"] });
  expect(container.querySelector<HTMLFieldSetElement>(".exam-setup-fields")!.disabled).toBe(true);
  localStorage.setItem("abgm-exam-custom-clpfecuohwzwrgmqzeos-test-owner", '[]');
  await click("Recover saved attempt");
  const starts = invoke.mock.calls.filter(c => c[1].body.operation === "start");
  expect(starts[1][1].body.input).toEqual(input);
});
it("disables Custom with a legacy backend and does not share another user's preferences", async () => {
  localStorage.setItem("abgm-exam-custom-clpfecuohwzwrgmqzeos-another-owner", '["mechanical_ventilation"]');
  await mount();
  expect([...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Custom ExamChoose what's included")?.disabled).toBe(true);
});
it("withholds a connected final score when the persisted denominator is inconsistent", async () => {
  await mount(); await click("Begin"); await click("Review exam");
  attempt = { ...attempt, marksAvailable: 99, gradingStatus: "completed", parts: [{ partId: "part", status: "completed", marksAwarded: 2 }] };
  await click("Submit anyway");
  expect(container.textContent).toContain("Final score unavailable");
  expect(container.textContent).toContain("saved marks total does not match");
});

it("keeps a Custom exam with no exclusions labelled Custom in Results", async () => {
  await mount(3, categories); await click("Custom ExamChoose what's included"); await click("Begin");
  await click("Review exam"); await click("Submit anyway");
  expect(container.textContent).toContain("Custom Exam · All Parts included");
});
it("shows saved history exclusions using catalogue labels", async () => {
  const original = invoke.getMockImplementation()!;
  invoke.mockImplementation(async (...args) => args[1].body.operation === "history_page"
    ? { data: historyPage([row("12345678-1234-1234-1234-123456789abc", "custom", ["mechanical_ventilation"])]) }
    : original(...args));
  await mount(3, categories);
  await click("Past attempts");
  expect(container.textContent).toContain("Mechanical ventilation");
});

it("opens a saved example's exact historical Question and Part, then returns to Error log", async () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  attempt = { ...attempt, id, status: "submitted", finishedAt: "2026-10-07T00:00:00Z", marksAvailable: 4,
    questions: [...attempt.questions, { id: "second-unit", tables: [], parts: [{ id: "target", kind: "concept", prompt: "Historical target", marks: 2 }] }],
    parts: [{ partId: "part", status: "pending" }, { partId: "target", status: "pending" }], feedback: {} };
  const log = { catalogue: { topics: [{ id: "acid_base", label: "Acid–base" }], concepts: [{ id: "calculation", label: "Calculation", topicId: "acid_base", errorType: "Calculation", active: true }] },
    entries: [{ conceptId: "calculation", status: "to_review", exampleCount: 1, createdAt: "2026-10-07T00:00:00Z", lastSavedAt: "2026-10-07T00:00:00Z", archivedAt: null, reopenedAt: null }],
    attemptId: null, savedSources: {}, toReviewCount: 1 };
  invoke.mockImplementation(async (_name, { body: { operation, input } }) => {
    if (operation === "current") return { data: { attempt: null } };
    if (operation === "history_page") return { data: historyPage([row(id)]) };
    if (operation === "error_log_list") return { data: { ...log, attemptId: input.attemptId ?? null } };
    if (operation === "error_log_examples") return { data: { examples: [{ id, attemptId: id, unitId: "second-unit", partId: "target", prompt: "Historical target", questionNumber: 2, partNumber: 1,
      examKind: "mock", finishedAt: attempt.finishedAt, savedAt: attempt.finishedAt }], nextCursor: null } };
    return { data: structuredClone(attempt) };
  });
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
  await mount();
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.includes("Error log"))!.click());
  await act(async () => container.querySelector<HTMLButtonElement>(".exam-error-log__examples button")!.click());
  expect(container.querySelector('[aria-label="Question 2"]')!.getAttribute("aria-pressed")).toBe("true");
  const selected = container.querySelector('[aria-label="Question 2 results"]')!;
  expect(selected.hasAttribute("hidden")).toBe(false);
  expect(selected.querySelector('.exam-results__part-toggle')?.getAttribute("aria-expanded") ?? selected.querySelector('button[aria-expanded]')?.getAttribute("aria-expanded")).toBe("true");
  expect(scroll).toHaveBeenCalled();
  await click("Back to Exam Room");
  expect(container.querySelector(".exam-error-log h1")?.textContent).toBe("Error log");
  expect(invoke.mock.calls.find(c => c[1].body.operation === "read")![1].body.input).toEqual({ attemptId: id });
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

it("derives connected controls from frozen mappings and confirms saves for only the source Part", async () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  const feedback = { answer: { mmHg: "Reference", kPa: "Reference" }, reasoning: { mmHg: "Teaching", kPa: "Teaching" },
    primaryObjective: "test", display: "text_and_resources" as const, resources: [], criteria: [], errorLog: { partConceptIds: ["calculation"] } };
  attempt = { ...attempt, id, status: "submitted", marksAvailable: 4, finishedAt: "2026-10-07T00:00:00Z", gradingStatus: "completed", marksAwarded: 0,
    questions: [{ ...attempt.questions[0], parts: [...attempt.questions[0].parts, { id: "other", kind: "concept", prompt: "Another Part", marks: 2 }] }],
    parts: ["part", "other"].map(partId => ({ partId, status: "completed", marksAwarded: 0, marksAvailable: 2, criteria: {} })),
    feedback: { part: feedback, other: feedback } };
  let saved = false; let saves = 0;
  function log(source: string | null) { return { catalogue: { topics: [{ id: "acid_base", label: "Acid–base" }], concepts: [{ id: "calculation", label: "Current study label", topicId: "acid_base", errorType: "Calculation", active: true }] },
    entries: saved ? [{ conceptId: "calculation", status: "to_review", exampleCount: 1, createdAt: attempt.finishedAt, lastSavedAt: attempt.finishedAt, archivedAt: null, reopenedAt: null }] : [],
    attemptId: source, savedSources: source && saved ? { part: ["calculation"] } : {}, toReviewCount: saved ? 1 : 0 }; }
  invoke.mockImplementation(async (_name, { body: { operation, input } }) => {
    if (operation === "current") return { data: { attempt: null } };
    if (operation === "history_page") return { data: historyPage([row(id)]) };
    if (operation === "error_log_list") return { data: log(input.attemptId ?? null) };
    if (operation === "error_log_save") {
      if (++saves === 1) return { error: new Error("offline") };
      saved = true; return { data: { ...log(id), savedConceptIds: input.conceptIds } };
    }
    return { data: structuredClone(attempt) };
  });
  await mount();
  await click("Latest result");
  expect(container.textContent).toContain("Current study label");
  expect([...container.querySelectorAll('.exam-results__part-toggle')].every(b => b.getAttribute("aria-expanded") === "false")).toBe(true);
  await act(async () => container.querySelector<HTMLButtonElement>('.exam-results__part-toggle')!.click());
  await click("Add to error log");
  expect(container.textContent).toContain("Couldn’t confirm the save");
  expect(container.textContent).not.toContain("Already saved");
  await click("Add to error log");
  const parts = [...container.querySelectorAll('.exam-results__part')];
  expect(parts[0].textContent).toContain("Already saved");
  expect(parts[1].textContent).toContain("Add to error log");
  expect(parts[1].textContent).not.toContain("Already saved");
  expect(invoke.mock.calls.filter(c => c[1].body.operation === "error_log_save").map(c => c[1].body.input))
    .toEqual([{ attemptId: id, partId: "part", conceptIds: ["calculation"] }, { attemptId: id, partId: "part", conceptIds: ["calculation"] }]);
});

it("keeps history failure independent of Begin and disables unfinished drill actions",async()=>{
 const original=invoke.getMockImplementation()!;
 invoke.mockImplementation(async(...args)=>args[1].body.operation==="history_page"?{error:new Error("offline")}:original(...args));
 await mount();expect(container.textContent).toContain("Retry history");
 expect([...container.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.trim()==="Begin")!.disabled).toBe(false);
 await click("Focused Drills");expect(container.textContent).toContain("Coming soon");
 expect(container.textContent).not.toContain("67%");expect(container.textContent).not.toContain("45 attempted");
 expect(container.querySelector<HTMLButtonElement>(".exam-start")!.disabled).toBe(true);
 expect(invoke.mock.calls.some(c=>c[1].body.operation==="start")).toBe(false);
});
it("opens the actual Latest result and returns to a filtered history without clearing an active journal",async()=>{
 const id="12345678-1234-1234-1234-123456789abc";
 const original=invoke.getMockImplementation()!;
 invoke.mockImplementation(async(...args)=>args[1].body.operation==="history_page"?{data:{...historyPage([row(id,"custom")]),latestAttemptId:id}}:original(...args));
 attempt={...attempt,id,status:"submitted",finishedAt:"2026-10-05T00:10:00Z",feedback:{},parts:[{partId:"part",status:"pending"}]};
 await mount();await click("Latest result");expect(invoke.mock.calls.find(c=>c[1].body.operation==="read")![1].body.input).toEqual({attemptId:id});
 await click("Back to Exam Room");await click("Past attempts");
 await click("Custom1");
 await act(async()=>container.querySelector<HTMLButtonElement>(".exam-attempt-open")!.click());
 await click("Back to Exam Room");expect(container.querySelector(".exam-history h1")?.textContent).toBe("Past attempts");
 expect(container.querySelector('[aria-label="Past attempts filter"] [aria-pressed="true"]')?.textContent).toBe("Custom1");
});
it("refreshes on history entry and discards a Results response after leaving history",async()=>{
 const id="12345678-1234-1234-1234-123456789abc";
 const original=invoke.getMockImplementation()!;
 let resolveRead: (value: unknown)=>void=()=>{};
 invoke.mockImplementation(async(...args)=>{
  if(args[1].body.operation==="history_page")return {data:historyPage([row(id)])};
  if(args[1].body.operation==="read")return new Promise(resolve=>{resolveRead=resolve;});
  return original(...args);
 });
 await mount();const before=invoke.mock.calls.filter(c=>c[1].body.operation==="history_page").length;
 await click("Past attempts");expect(invoke.mock.calls.filter(c=>c[1].body.operation==="history_page").length).toBeGreaterThan(before);
 await act(async()=>container.querySelector<HTMLButtonElement>(".exam-attempt-open")!.click());
 await click("Back to Exam Room");
 await act(async()=>resolveRead({data:{...attempt,id,status:"submitted",finishedAt:"2026-10-07T00:00:00Z",feedback:{},parts:[{partId:"part",status:"pending"}]}}));
 expect(container.querySelector(".exam-history")).toBeNull();expect(container.querySelector(".exam-results")).toBeNull();
 expect(container.textContent).toContain("Latest result");
});
it("defaults a confirmed private three/five choice to three and sends five when selected",async()=>{
 await mount(5,[],[3,5]);expect(container.textContent).toContain("3 cases");
 await click("5 cases");expect(container.textContent).toContain("30 min");await click("Begin");
 expect(invoke.mock.calls.find(c=>c[1].body.operation==="start")![1].body.input.unitCount).toBe(5);
});
it("applies and recovers the timer and reference-range choices",async()=>{
 await mount();
 await act(async()=>[...container.querySelectorAll<HTMLButtonElement>(".exam-toggle-row button")].forEach(b=>b.click()));
 await click("Begin");expect(container.textContent).toContain("Show timer");
 const journal=JSON.parse(localStorage.getItem("abgm-exam-pilot-clpfecuohwzwrgmqzeos-test-owner")!);expect(journal).toMatchObject({showTimer:false,showRanges:false,unitCount:3});
 await act(async()=>root.unmount());root=createRoot(container);await mount();await click("Recover attempt");expect(container.textContent).toContain("Show timer");
});
