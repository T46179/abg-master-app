// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BackgroundAccount } from "./BackgroundAccount";
import { useBackgroundAccount } from "./AccountLoading";
import { SiteAccountProvider, useSiteAccount } from "./SiteAccountProvider";
import { useAppContext } from "./AppProvider";
import { AppShell } from "../presentation/layout/AppShell";
import ExamAccountExperience from "../presentation/account/ExamAccountExperience.dev";
import type { RuntimeAttempt } from "../core/examRuntime";

vi.mock("../core/progressionSync", () => ({ loadRemoteProgressRow: vi.fn(async () => null), completeCalibrationProgress: vi.fn() }));
vi.mock("../core/analytics", () => ({ trackEvent: vi.fn(), trackPageView: vi.fn() }));
vi.mock("../presentation/layout/MainNav", () => ({ MainNav: () => <nav>Navigation</nav> }));
vi.mock("../core/accountDataClient", () => ({ createAccountDataClient: (_config: unknown, client: unknown) => client }));
vi.mock("./RegistrationProvider", () => ({ useRegistration: () => ({
  registration: { emailPurpose: () => null }, registrationState: { phase: "idle" }, hasPassword: true, paid: true,
}) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const config = { SUPABASE_URL: "https://clpfecuohwzwrgmqzeos.supabase.co", SUPABASE_ANON_KEY: "public" };
const payload = { deliveryMode: "protected_runtime" as const, contentVersion: "test", cases: [], progressionConfig: null, dashboardState: null, defaultUserState: null };
const loadPayload = vi.fn(async () => payload);
let mounts = 0;
function Public() {
  const background = useBackgroundAccount()!;
  const { state } = useAppContext();
  useEffect(() => { mounts++; }, []);
  return <><h1>Public content</h1><Link to="/practice?source=landing">Start</Link>
    <span>owner:{state.userId ?? "none"}</span><button onClick={background.retry}>Verify again</button></>;
}
let account: ReturnType<typeof useSiteAccount>["account"];
function Capture() { account = useSiteAccount().account; const location = useLocation(); return <span>{location.pathname + location.search}</span>; }
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  let id = "a";
  let event: (event: string, session: unknown) => void = () => {};
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: { user: { id }, access_token: "token" } }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: { id, is_anonymous: false, email: id + "@example.test", email_confirmed_at: "yes" } }, error: null })),
    signInAnonymously: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(callback => { event = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; })
  };
  return { auth, client: { auth } as unknown as SupabaseClient,
    change(next: string) { id = next; event("SIGNED_IN", { user: { id } }); },
    signOut() { event("SIGNED_OUT", null); } };
}
async function render(f: ReturnType<typeof fixture>, path = "/") {
  await act(async () => root.render(<SiteAccountProvider client={f.client}>
    <BackgroundAccount client={f.client} config={config} loadPayload={loadPayload}>
      <MemoryRouter initialEntries={[path]}><Capture /><Routes><Route path="/" element={<Public />} />
        <Route element={<AppShell />}><Route path="practice" element={<p>Private Practice</p>} /><Route path="sign-in" element={<p>Sign in form</p>} /></Route>
      </Routes></MemoryRouter>
    </BackgroundAccount>
  </SiteAccountProvider>));
}
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); mounts = 0; loadPayload.mockClear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it("keeps public content mounted through verification, account changes and sign-out", async () => {
  const f = fixture(); const pending = deferred<any>(); f.auth.getUser.mockReturnValueOnce(pending.promise);
  await render(f);
  expect(host.textContent).toContain("Public content"); expect(host.textContent).toContain("owner:none");
  expect(loadPayload).not.toHaveBeenCalled(); expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ data: { user: { id: "a", is_anonymous: false, email: "a@example.test", email_confirmed_at: "yes" } }, error: null }));
  expect(host.textContent).toContain("owner:a"); expect(mounts).toBe(1);
  await act(async () => f.change("b")); expect(host.textContent).not.toContain("owner:a");
  await act(async () => vi.advanceTimersByTimeAsync(0)); expect(host.textContent).toContain("owner:b");
  await act(async () => f.signOut()); expect(host.textContent).toContain("owner:none"); expect(mounts).toBe(1);
});

it("keeps a real exam mounted when offline focus fails both identity and access checks, then reconnects silently", async () => {
  const f = fixture();
  const onlineUser = f.auth.getUser.getMockImplementation()!;
  let offline = false;
  let attempt: RuntimeAttempt = { id: "offline-attempt", status: "active", revision: 0, pressureUnit: "mmHg", createdAt: new Date().toISOString(), presentedAt: null, finishedAt: null, answers: {}, marksAvailable: 2,
    questions: [{ id: "unit", tables: [], parts: [{ id: "answer", kind: "concept", prompt: "Explain your answer", marks: 2 }] }] };
  const invoke = vi.fn(async (name: string, { body }: { body: { operation?: string; input?: Record<string, any> } }) => {
    if (offline) return { error: new Error("offline") };
    if (name === "exam-access") return { data: { status: "allowed", canStartStandard: true, allowedUnitCounts: [3] } };
    if (body.operation === "onboarding_read") return { data: { revision: null, completedAt: null, answers: null } };
    if (body.operation === "preference_read" || body.operation === "preference_update") return { data: { feedbackTone: "professional" } };
    if (body.operation === "trial_status") return { data: { state: "available", attemptId: null, gradingStatus: null, canRetryGrading: false, requiresSupport: false, retryAvailableAt: null } };
    if (body.operation === "current") return { data: { attempt: null } };
    if (body.operation === "history_page") return { data: { attempts: [], nextCursor: null, latestAttemptId: null, total: 0, counts: { all: 0, mock: 0, custom: 0 }, summary: { submitted: 0, average: null, best: null, trend: [], totalCases: 0, awaiting: 0, pending: 0 } } };
    if (body.operation === "present") attempt = { ...attempt, revision: attempt.revision + 1, presentedAt: new Date().toISOString() };
    if (body.operation === "save") attempt = { ...attempt, revision: attempt.revision + 1, answers: body.input!.answers };
    if (["start", "present", "save"].includes(body.operation ?? "")) return { data: structuredClone(attempt) };
    throw new Error(`Unexpected operation ${body.operation}`);
  });
  Object.assign(f.client, { functions: { invoke } });
  const router = createMemoryRouter([{ element: <AppShell />, children: [{ path: "/dev/exam-pilot", element: <ExamAccountExperience /> }] }], { initialEntries: ["/dev/exam-pilot"] });
  await act(async () => root.render(<SiteAccountProvider client={f.client}>
    <BackgroundAccount client={f.client} config={config} loadPayload={loadPayload}><CaptureRouter router={router} /></BackgroundAccount>
  </SiteAccountProvider>));
  const button = [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === "Begin")!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
  const textarea = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Retained during offline verification");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(500);
  });
  const generation = account.getSnapshot().generation;
  const bootstraps = loadPayload.mock.calls.length;
  offline = true;
  f.auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } } as any);
  const warning = "We're having trouble checking your exam access. You can keep working while we try again.";
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(host.querySelector("textarea")).toBe(textarea);
  expect(host.textContent).not.toContain(warning);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(host.textContent).toContain(warning);
  expect(host.textContent).not.toContain("Frontend failed to initialize");
  expect(host.querySelector("textarea")).toBe(textarea);
  expect(textarea.value).toBe("Retained during offline verification");
  expect(account.getSnapshot()).toMatchObject({ status: "verified", userId: "a", generation });
  expect(loadPayload).toHaveBeenCalledTimes(bootstraps);
  offline = false; f.auth.getUser.mockImplementation(onlineUser);
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(host.textContent).not.toContain(warning);
  expect(host.querySelector("textarea")).toBe(textarea);
  expect(invoke.mock.calls.filter(c => c[1].body.operation === "start")).toHaveLength(1);
});

function CaptureRouter({ router }: { router: ReturnType<typeof createMemoryRouter> }) {
  account = useSiteAccount().account;
  return <RouterProvider router={router} />;
}

it("preserves a direct URL and navigation while verification is slow, then offers a scoped retry", async () => {
  const f = fixture(); f.auth.getUser.mockImplementation(() => new Promise(() => {}));
  await render(f, "/practice?source=direct");
  expect(host.textContent).toContain("Navigation"); expect(host.textContent).toContain("/practice?source=direct");
  expect(host.textContent).not.toContain("Private Practice");
  await act(async () => vi.advanceTimersByTimeAsync(3000)); expect(host.textContent).toContain("Connecting…");
  await act(async () => vi.advanceTimersByTimeAsync(12000)); expect(host.textContent).toContain("longer than usual");
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.textContent).not.toContain("longer than usual"); expect(f.auth.getUser).toHaveBeenCalledTimes(2);
  expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
});

it("keeps public content on verification failure and allows recovery pages", async () => {
  const f = fixture(); f.auth.getUser.mockRejectedValue(new Error("offline"));
  await render(f); expect(host.textContent).toContain("Public content"); expect(host.textContent).toContain("owner:none");
  expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  await act(async () => root.unmount()); root = createRoot(host);
  await render(f, "/sign-in?return_to=trial"); expect(host.textContent).toContain("Sign in form");
});

it("supersedes an old verification without clearing the session", async () => {
  const f = fixture(); const pending = deferred<any>(); f.auth.getUser.mockReturnValueOnce(pending.promise);
  await render(f);
  await act(async () => account.refresh()); expect(host.textContent).toContain("owner:a");
  await act(async () => pending.resolve({ data: { user: null }, error: { status: 503 } }));
  expect(host.textContent).toContain("owner:a"); expect(mounts).toBe(1);
});

it("accepts a successful verification after the slow threshold without restarting public content", async () => {
  const f = fixture(); const pending = deferred<any>(); f.auth.getUser.mockReturnValueOnce(pending.promise);
  await render(f); await act(async () => vi.advanceTimersByTimeAsync(16000));
  await act(async () => pending.resolve({ data: { user: { id: "a", is_anonymous: true } }, error: null }));
  expect(host.textContent).toContain("owner:a"); expect(mounts).toBe(1);
  expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
});

it("navigates from the public landing page while identity is unresolved", async () => {
  const f = fixture(); f.auth.getUser.mockImplementation(() => new Promise(() => {}));
  await render(f);
  await act(async () => host.querySelector<HTMLAnchorElement>("a")!.click());
  expect(host.textContent).toContain("/practice?source=landing"); expect(host.textContent).toContain("Navigation");
  expect(host.textContent).not.toContain("Private Practice"); expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
});

it("creates a guest only on entering a learner route after confirmed session absence", async () => {
  const f = fixture(); f.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any);
  await render(f); expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  f.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any);
  await act(async () => host.querySelector<HTMLAnchorElement>("a")!.click());
  expect(f.auth.signInAnonymously).toHaveBeenCalledTimes(1);
});
