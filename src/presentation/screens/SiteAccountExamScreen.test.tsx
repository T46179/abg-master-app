// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountWorkspace } from "../../app/AccountWorkspace";
import type { RuntimeAttempt } from "../../core/examRuntime";
import { ExamSittingProvider } from "../exam/ExamSittingContext";
import { SiteAccountExamScreen } from "./SiteAccountExamScreen";
import Experience from "../account/ExamAccountExperience.dev";

const mocks = vi.hoisted(() => ({ access: vi.fn(), account: { refresh: vi.fn(), isCurrent: () => true }, client: null as unknown }));
vi.mock("../../core/examAuth", async importOriginal => ({ ...await importOriginal<object>(), readExamAccess: mocks.access }));
vi.mock("../../core/accountDataClient", () => ({ createAccountDataClient: () => mocks.client }));
vi.mock("../../app/SiteAccountProvider", () => ({ useSiteAccount: () => ({
  client: mocks.client,
  identity: { status: "verified", userId: "owner", generation: 1 },
  account: mocks.account,
}) }));
vi.mock("../../app/RegistrationProvider", () => ({ useRegistration: () => ({
  registration: { emailPurpose: () => null }, registrationState: { phase: "idle" }, paid: true, hasPassword: true,
}) }));
vi.mock("../../app/AppProvider", async () => {
  const { initialAppState } = await import("../../app/state");
  return { useAppContext: () => ({ state: initialAppState, patchSessionState: vi.fn() }) };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let attempt: RuntimeAttempt;
const invoke = vi.fn();
const workspace = {
  userId: "owner", isCurrent: mocks.account.isCurrent,
  runtimeConfig: { SUPABASE_URL: "https://clpfecuohwzwrgmqzeos.supabase.co" },
} as AccountWorkspace;
const granted = { status: "allowed", canStartStandard: true, allowedUnitCounts: [3], customisationCategories: [] };
async function render(local = false) {
  const router = createMemoryRouter([{ path: "/exam", element: <ExamSittingProvider>
    {local ? <Experience /> : <SiteAccountExamScreen workspace={workspace} />}
  </ExamSittingProvider> }], { initialEntries: ["/exam"] });
  await act(async () => root.render(<RouterProvider router={router} />));
}
function begin() { return [...container.querySelectorAll("button")].find(b => b.textContent?.trim() === "Begin")!; }

beforeEach(() => {
  localStorage.clear(); mocks.access.mockReset(); mocks.account.refresh.mockReset(); invoke.mockReset();
  mocks.access.mockResolvedValue(granted);
  mocks.client = { functions: { invoke } } as unknown as SupabaseClient;
  workspace.client = mocks.client as SupabaseClient;
  attempt = { id: "test-attempt", marksAvailable: 2, status: "active", revision: 0, pressureUnit: "mmHg", createdAt: new Date().toISOString(), presentedAt: null, finishedAt: null, answers: {}, questions: [{ id: "unit", tables: [], parts: [{ id: "part", kind: "concept", prompt: "Explain your answer", marks: 2 }] }] };
  invoke.mockImplementation(async (_name, { body: { operation, input } }) => {
    if (operation === "onboarding_read") return { data: { revision: null, completedAt: null, answers: null } };
    if (operation === "preference_read") return { data: { feedbackTone: "professional" } };
    if (operation === "preference_update") return { data: { feedbackTone: input.feedbackTone } };
    if (operation === "trial_status") return { data: { state: "available", attemptId: null, gradingStatus: null, canRetryGrading: false, requiresSupport: false, retryAvailableAt: null } };
    if (operation === "current") return { data: { attempt: null } };
    if (operation === "history_page") return { data: { attempts: [], nextCursor: null, latestAttemptId: null, total: 0, counts: { all: 0, mock: 0, custom: 0 }, summary: { submitted: 0, average: null, best: null, trend: [], totalCases: 0, awaiting: 0, pending: 0 } } };
    if (operation === "start") attempt = { ...attempt, examKind: input.examKind, excludedCategories: input.excludedCategories };
    else if (operation === "present") attempt = { ...attempt, revision: attempt.revision + 1, presentedAt: new Date().toISOString() };
    else if (operation === "save") attempt = { ...attempt, revision: attempt.revision + 1, answers: input.answers };
    else if (operation === "claim") attempt = { ...attempt, revision: attempt.revision + 1 };
    else if (operation === "read") return { data: structuredClone(attempt) };
    else throw new Error(`Unexpected operation: ${operation}`);
    return { data: structuredClone(attempt) };
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

it("starts a standard exam through the workspace for an eligible account", async () => {
  await render();
  expect(begin()).toBeTruthy(); expect(begin().disabled).toBe(false);
  await act(async () => begin().click());
  expect(invoke.mock.calls.filter(c => c[1].body.operation === "start")).toHaveLength(1);
  expect(invoke.mock.calls.find(c => c[1].body.operation === "start")?.[1].body.input.examKind).toBe("mock");
  expect(container.querySelector("textarea")).not.toBeNull();
});

it.each([
  { ...granted, canStartStandard: false },
  { ...granted, canStartStandard: undefined },
  { ...granted, status: "closed" },
  { ...granted, status: "not_invited" },
  { ...granted, allowedUnitCounts: [] },
])("disables standard starts for restricted access: %j", async access => {
  mocks.access.mockResolvedValue(access);
  await render();
  expect(begin()).toBeTruthy(); expect(begin().disabled).toBe(true);
  await act(async () => begin().click());
  expect(invoke.mock.calls.some(c => c[1].body.operation === "start")).toBe(false);
});

it("keeps a real sitting and its answer mounted through failure, warning, and recovery", async () => {
  vi.useFakeTimers();
  await render(true);
  await act(async () => begin().click());
  const textarea = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "My retained answer");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const warning = "We're having trouble checking your exam access. You can keep working while we try again.";
  mocks.access.mockRejectedValueOnce(new Error("offline"));
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(container.textContent).not.toContain(warning);
  expect(container.querySelector("textarea")).toBe(textarea);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(container.textContent).toContain(warning);
  expect(container.querySelector("textarea")).toBe(textarea);
  expect(textarea.value).toBe("My retained answer");
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(container.textContent).not.toContain(warning);
  expect(container.querySelector("textarea")).toBe(textarea);
  expect(textarea.value).toBe("My retained answer");
  expect(invoke.mock.calls.some(c => ["read", "claim"].includes(c[1].body.operation))).toBe(false);
  expect(invoke.mock.calls.filter(c => c[1].body.operation === "start")).toHaveLength(1);
});

const accessWarning = "We're having trouble checking your exam access. You can keep working while we try again.";
const connectionWarning = "We've lost connection. Check your connection, then retry to continue your exam.";
async function clickNotice() {
 const button = container.querySelector<HTMLButtonElement>(".exam-notice__retry")!;
 expect(button).toBeTruthy();
 await act(async () => { button.click(); button.click(); });
 return button;
}
async function failQuestion() {
 await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Question 2"]')!.click());
}

it.each(["pending", "failed"])("unblocks recovery independently of %s access verification and coalesces retries", async accessOutcome => {
 vi.useFakeTimers();
 attempt.questions.push({ id: "second-unit", tables: [], parts: [{ id: "second-part", kind: "concept", prompt: "Later question", marks: 1 }] });
 await render(true); await act(async () => begin().click());
 const original = invoke.getMockImplementation()!;
 let failPresent = true;
 let releaseRead!: () => void;
 const gate = new Promise<void>(resolve => { releaseRead = resolve; });
 invoke.mockImplementation(async (...args) => {
  if (args[1].body.operation === "present" && failPresent) return { error: { name: "FunctionsFetchError" } };
  if (args[1].body.operation === "read") await gate;
  return original(...args);
 });
 mocks.access.mockRejectedValueOnce(new Error("offline"));
 await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(15000); });
 expect(container.textContent).toContain(accessWarning);
 await failQuestion();
 expect(container.querySelectorAll(".exam-notice")).toHaveLength(1);
 expect(container.textContent).toContain(connectionWarning);
 expect(container.querySelector(".exam-notice strong")?.textContent).toBe("We've lost connection.");
 expect(container.textContent).not.toContain(accessWarning);
 expect(container.querySelector<HTMLFieldSetElement>(".exam-sitting-controls")!.disabled).toBe(true);
 let resolveAccess!: (value: unknown) => void;
 if (accessOutcome === "pending") mocks.access.mockImplementationOnce(() => new Promise(resolve => { resolveAccess = resolve; }));
 else mocks.access.mockRejectedValueOnce(new Error("access still offline"));
 const retry = await clickNotice();
 expect(retry.textContent).toBe("Retrying…");
 expect(retry.disabled).toBe(true);
 expect(retry.getAttribute("aria-busy")).toBe("true");
 expect(retry.querySelector('.figma-button__spinner[aria-hidden="true"]')).not.toBeNull();
 expect(container.textContent).toContain(connectionWarning);
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "read")).toHaveLength(1);
 expect(mocks.access).toHaveBeenCalledTimes(3);
 if (accessOutcome === "pending") {
  await act(async () => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus")); });
  expect(mocks.access).toHaveBeenCalledTimes(3);
 }
 failPresent = false;
 await act(async () => releaseRead());
 expect(container.querySelector<HTMLFieldSetElement>(".exam-sitting-controls")!.disabled).toBe(false);
 expect(container.textContent).not.toContain(connectionWarning);
 expect(container.textContent).toContain(accessWarning);
 expect(container.querySelectorAll(".exam-notice")).toHaveLength(1);
 expect(container.querySelector<HTMLButtonElement>(".exam-notice__retry")!.disabled).toBe(accessOutcome === "pending");
 if (accessOutcome === "pending") {
  await act(async () => resolveAccess(granted));
  expect(container.querySelector(".exam-notice")).toBeNull();
 }
});

it("keeps a failed sitting paused even when access verification succeeds and shows progress on every retry", async () => {
 vi.useFakeTimers();
 attempt.questions.push({ id: "second-unit", tables: [], parts: [{ id: "second-part", kind: "concept", prompt: "Later question", marks: 1 }] });
 await render(true); await act(async () => begin().click());
 const original = invoke.getMockImplementation()!;
 let offline = true;
 invoke.mockImplementation(async (...args) => {
  if (offline && ["present", "read"].includes(args[1].body.operation)) return { error: { name: "FunctionsFetchError" } };
  return original(...args);
 });
 await failQuestion();
 await clickNotice();
 expect(container.textContent).toContain(connectionWarning);
 expect(container.textContent).not.toContain(accessWarning);
 expect(container.querySelector<HTMLButtonElement>(".exam-notice__retry")!.disabled).toBe(false);
 expect(container.querySelector<HTMLFieldSetElement>(".exam-sitting-controls")!.disabled).toBe(true);
 const reads = invoke.mock.calls.filter(c => c[1].body.operation === "read").length;
 offline = false;
 await act(async () => { window.dispatchEvent(new Event("online")); });
 expect(invoke.mock.calls.filter(c => c[1].body.operation === "read")).toHaveLength(reads);
 expect(container.textContent).toContain(connectionWarning);
 await clickNotice();
 expect(container.querySelector(".exam-notice")).toBeNull();
 expect(container.querySelector<HTMLFieldSetElement>(".exam-sitting-controls")!.disabled).toBe(false);
});

it("shows access-only retry progress while leaving the sitting usable", async () => {
 vi.useFakeTimers(); await render(true); await act(async () => begin().click());
 mocks.access.mockRejectedValueOnce(new Error("offline"));
 await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(15000); });
 let resolve!: (value: unknown) => void;
 mocks.access.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
 await clickNotice();
 expect(container.querySelector(".exam-notice__retry")?.textContent).toBe("Retrying…");
 expect(container.querySelector<HTMLFieldSetElement>(".exam-sitting-controls")!.disabled).toBe(false);
 expect(invoke.mock.calls.some(c => c[1].body.operation === "read")).toBe(false);
 await act(async () => { window.dispatchEvent(new Event("online")); });
 expect(mocks.access).toHaveBeenCalledTimes(3);
 await act(async () => resolve(granted));
 expect(container.querySelector(".exam-notice")).toBeNull();
});
