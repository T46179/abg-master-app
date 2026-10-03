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
async function mount() {
 router = createMemoryRouter([{ path: "/", element: <ExamSittingProvider><ExamPilotRuntime client={client} userId="test-owner" canStart /></ExamSittingProvider> }, { path: "/away", element: <p>Away</p> }]);
 await act(async () => { root.render(<RouterProvider router={router} />); });
}
async function click(text: string) {
 const button = [...container.querySelectorAll('button')].find(b => b.textContent === text)!;
 expect(button).toBeTruthy(); await act(async () => button.click());
}
beforeEach(() => {
 Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
 localStorage.clear(); invoke.mockReset(); loseSubmission = false;
 attempt = { id: "test-attempt", status: "active", revision: 0, pressureUnit: "kPa", createdAt: new Date().toISOString(), presentedAt: null, finishedAt: null, answers: {}, questions: [{ id: "test-unit", tables: [], parts: [{ id: "part", kind: "concept", prompt: "Explain your answer", marks: 2 }] }] };
 invoke.mockImplementation(async (_name, { body: { operation, input } }) => {
   if (operation === "current") return { data: { attempt: null } };
   if (operation === "history") return { data: { attempts: [] } };
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
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
it("saves raw answers and shows teaching with pending marks only after acceptance", async () => {
 await mount(); await click("Start Exam");
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
 await mount(); await click("Start Exam"); await click("Review exam");
 loseSubmission = true; await click("Submit anyway");
 expect(container.textContent).not.toContain("Teaching explanation");
 expect(container.querySelector('fieldset')!.disabled).toBe(true);
 await click("Check submission / retry");
 expect(container.textContent).toContain("Teaching explanation");
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "submit")).toHaveLength(1);
});
it("reload recovers the same questions and saved raw answer through read and claim", async () => {
 await mount(); await click("Start Exam");
 const textarea = container.querySelector("textarea")!;
 await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "saved draft"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
 await act(async () => root.unmount()); root = createRoot(container); await mount(); await click("Recover attempt");
 expect(container.querySelector('textarea')!.value).toBe("saved draft");
 expect(invoke.mock.calls.some(c => c[1].body.operation === "claim")).toBe(true);
});

it("navigation waits for server abandonment and stays in the exam on failure", async () => {
 await mount(); await click("Start Exam");
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
 await mount(); await click("Start Exam"); await click("Review exam"); await click("Submit anyway");
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
 await mount(); await click("Start Exam"); await click("Review exam"); await click("Submit anyway");
 attempt = { ...attempt, gradingStatus: "failed", canRetryGrading: true, parts: [{ partId: "part", status: "failed" }] };
 await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); await click("Retry grading");
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "retry_grading")).toHaveLength(1);
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "submit")).toHaveLength(1);
});

it("reports against the displayed attempt and keeps confirmation inside the popup", async () => {
 vi.useFakeTimers();
 await mount(); await click("Start Exam"); await click("Review exam"); await click("Submit anyway");
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
