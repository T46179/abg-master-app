// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import type { RegistrationCallback } from "../../core/registrationCallback";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SiteAccountProvider, useSiteAccount } from "../../app/SiteAccountProvider";
import { RegistrationProvider } from "../../app/RegistrationProvider";
import AccountNav from "./AccountNav.dev";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyExamOnboarding, saveExamOnboarding } from "../../core/examOnboarding";

const m = vi.hoisted(() => ({ client: null as unknown, temporary: null as any, lifecycle: undefined as any, access: vi.fn(), active: false, recover: false, runtime: vi.fn(), begin: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => m.temporary ?? m.client }));
vi.mock("../../core/examAuth", () => ({ createExamAuthClient: () => m.client, readExamAccess: m.access }));
vi.mock("../../core/accountDataClient", () => ({ createAccountDataClient: (_config: unknown, client: unknown) => client }));
vi.mock("../../app/AppProvider", async () => {
  const { initialAppState } = await import("../../app/state");
  return { useAppContext: () => ({ state: { ...initialAppState, status: "ready", sessionState: { ...initialAppState.sessionState, pressureUnit: "mmHg" }, calibrationState: { ...initialAppState.calibrationState, remoteStatus: "loaded" } } }) };
});
vi.mock("../exam/ExamSittingContext", () => ({ useOptionalExamSitting: () => ({ sitting: m.active ? { phase: "active" } : null }), useExamSitting: () => ({ sitting: m.active ? { phase: "active" } : null }) }));
vi.mock("../exam/ExamPilotRuntime", () => ({ default: (props: any) => {
  m.runtime(props);
  const fullSetup = <p>Full Exam setup for {props.userId}; counts:{props.allowedUnitCounts.join(",")}</p>;
  const trialSetup = <div className="exam-trial-builder"><h3>Your Trial Session</h3><button onClick={m.begin}>Begin Trial Exam</button></div>;
  const controls = { trialLifecycle: m.lifecycle, openTrialResult: vi.fn(), refreshTrial: vi.fn(), fullSetup, trialSetup, withSetup: (content: unknown) => <div>Trial overview{content as any}</div>, canRecover: m.recover, ready: true, busy: false, canBegin: props.canStart && props.allowedUnitCounts.includes(3), timed: true, showRanges: true, setTimed: vi.fn(), setShowRanges: vi.fn(), begin: m.begin };
  return <div>{props.renderDashboard(controls)}</div>;
} }));
import Experience from "./ExamAccountExperience.dev";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement; let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
let current: { id: string; email: string } | null;
let changed: (event: string, session: unknown) => void;
let auth: { [key: string]: ReturnType<typeof vi.fn> };
function emit(event: string, id: string | null) {
  current = id ? { id, email: `${id}@example.test` } : null;
  changed(event, current ? { user: { id: current.id } } : null);
}
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }
async function click(text: string) { const scope = host.querySelector(".exam-account-menu") ?? container; const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === text); expect(button, text).toBeTruthy(); await act(async () => button!.click()); await flush(); }
async function fill(id: string, value: string) { await act(async () => { const input = document.getElementById(id) as HTMLInputElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
function OwnedExperience() { const { identity } = useSiteAccount(); return <Experience key={identity.generation} />; }
function RouteProbe() { const location = useLocation(); return <output data-testid="account-location">{location.pathname + location.search}</output>; }
function route() { return container.querySelector('[data-testid="account-location"]')?.textContent; }
async function render(callback?: RegistrationCallback, initialEntry = "/") { await act(async () => root.render(<MemoryRouter initialEntries={[initialEntry]}><RouteProbe /><SiteAccountProvider client={m.client as SupabaseClient}><RegistrationProvider client={m.client as SupabaseClient} callback={callback}>{createPortal(<AccountNav />, host)}<OwnedExperience /></RegistrationProvider></SiteAccountProvider></MemoryRouter>)); await flush(); }
async function login(id = "a") {
  await fill("exam-signin-email", ` ${id}@example.test `); await fill("exam-signin-password", " password ");
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await flush();
}
async function menu() { await act(async () => host.querySelector<HTMLButtonElement>("button")!.click()); }
beforeEach(() => {
  vi.useFakeTimers(); vi.stubEnv("VITE_EXAM_PILOT_SUPABASE_URL", "https://clpfecuohwzwrgmqzeos.supabase.co"); vi.stubEnv("VITE_EXAM_PILOT_SUPABASE_ANON_KEY", "public");
  localStorage.clear(); m.temporary = null; m.lifecycle = { state: "available", attemptId: null, gradingStatus: null, canRetryGrading: false, requiresSupport: false, retryAvailableAt: null }; current = null; m.active = false; m.recover = false; m.runtime.mockClear(); m.begin.mockClear(); m.access.mockReset(); m.access.mockResolvedValue({ status: "allowed", canStartStandard: true, allowedUnitCounts: [3, 5], customisationCategories: [] });
  auth = {
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: current ? { user: { id: current.id }, access_token: "test-token", refresh_token: "test-refresh" } : null }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: current ? { ...current, is_anonymous: false, email_confirmed_at: "confirmed" } : null }, error: null })),
    onAuthStateChange: vi.fn(callback => { changed = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    signInWithPassword: vi.fn(async ({ email }: { email: string }) => { emit("SIGNED_IN", email.trim().split("@")[0]); return { error: null }; }),
    signOut: vi.fn(async () => { emit("SIGNED_OUT", null); return { error: null }; }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    stopAutoRefresh: vi.fn(),
    signInAnonymously: vi.fn()
  }; m.client = { auth, rpc: vi.fn().mockResolvedValue({ data: { hasPassword: true }, error: null }) };
  host = document.createElement("div"); host.id = "exam-account-nav-slot"; document.body.append(host);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });
describe("unified local pilot account flow", () => {
  it.each([
    ["/sign-in", "#exam-signin-email"],
    ["/create-account", "#registration-email"],
    ["/forgot-password", "#reset-request-email"]
  ])("opens %s directly without an Exam query parameter", async (path, field) => {
    await render(undefined, path);
    expect(route()).toBe(path);
    expect(container.querySelector(field)).not.toBeNull();
  });
  it("keeps sign-in fields before visibility and recovery controls in keyboard order", async () => {
    await render(undefined, "/sign-in");
    const controls = [...container.querySelectorAll<HTMLButtonElement | HTMLInputElement>("form input, form button")];
    expect(controls.map(el => el.id || el.getAttribute("aria-controls") || el.textContent?.trim())).toEqual([
      "exam-signin-email", "exam-signin-password", "exam-signin-password", "Forgot password?", "Sign In"
    ]);
    expect(controls.every(el => el.tabIndex === 0)).toBe(true);
  });
  it("normalizes old account links without dropping the destination", async () => {
    await render(undefined, "/dev/exam-pilot?account=signin&return_to=practice");
    expect(route()).toBe("/sign-in?return_to=practice");
    await click("Create account"); expect(route()).toBe("/create-account?return_to=practice");
    await click("Sign in"); expect(route()).toBe("/sign-in?return_to=practice");
    await click("Forgot password?"); expect(route()).toBe("/forgot-password?return_to=practice");
    await click("Back to sign in"); expect(route()).toBe("/sign-in?return_to=practice&reauthenticate=1");
    await login(); expect(route()).toBe("/practice");
  });
  it("preserves the originating page when navigation opens sign-in", async () => {
    await render(undefined, "/learn");
    await menu();
    expect(route()).toBe("/sign-in?return_to=learn");
    await login(); expect(route()).toBe("/learn");
  });
  it("starts as guest, preserves current copy and does not create an account", async () => {
    await render(); expect(container.textContent).toContain("Preparing for exams?"); expect(container.textContent).toContain("Your Session"); expect(container.textContent).toContain("Graded Short Answers"); expect(container.textContent).not.toContain("Train for the real thing");
    expect(auth.signInAnonymously).not.toHaveBeenCalled(); expect(m.access).not.toHaveBeenCalled();
    expect(container.querySelector(".account-trial-panel h3")?.textContent).toBe("Your first exam starts here");
    await click("Create your free account"); expect(container.textContent).toContain("Creating an account saves your progress across devices so you can pick up where you left off.");
    expect([...container.querySelectorAll("button")].find(b => b.textContent?.includes("Create Account"))?.disabled).toBe(false);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("uses real password sign-in and continues a trial into onboarding without storing the password", async () => {
    await render(); await click("Sign in"); await login();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.test", password: " password " });
    expect(container.textContent).toContain("Tell us a little about yourself"); expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain(" password ");
  });
  it("offers the revised nursing choices and keeps Other specialty text optional", async () => {
    await render(); await click("Sign in"); await login();
    expect(container.querySelector('input[value="Paramedic"]')).toBeNull();
    expect(container.textContent).not.toContain("Share your background");
    await act(async () => container.querySelector<HTMLInputElement>('#exam-about-role input[value="Nurse"]')!.click());
    expect([...container.querySelectorAll<HTMLInputElement>('#exam-about-specialty input')].map(el => el.value)).toEqual(["Critical care", "Other"]);
    await act(async () => container.querySelector<HTMLInputElement>('#exam-about-specialty input[value="Other"]')!.click());
    expect(container.textContent).toContain("Your specialty (optional)");
    await act(async () => container.querySelector<HTMLInputElement>('#exam-about-reason input')!.click());
    expect(container.querySelector('.account-entry-footer')?.textContent).toBe("Your answers help us improve ABG Master");
    expect([...container.querySelectorAll('button')].find(el => el.textContent === "Continue to exam setup")?.querySelector('svg')).toBeNull();
    await click("Continue to exam setup");
    expect(container.textContent).toContain("Begin Trial Exam");
  });
  it("shows rejected credentials below the password field and supports retrying", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    await render(); await click("Sign in"); await login();
    const feedback = container.querySelector("#exam-signin-password-error");
    expect(feedback?.textContent).toBe("Incorrect email or password");
    expect(feedback?.getAttribute("role")).toBe("alert");
    expect(container.querySelector("#exam-signin-password")?.getAttribute("aria-describedby")).toBe("exam-signin-password-error");
    expect(container.textContent).not.toContain("Sign-in could not be completed");
    expect(container.textContent).not.toContain("Enter your password");
    expect(container.querySelector(".account-notice")).toBeNull();
    expect(container.querySelector(".account-submit-rejected")?.textContent).toBe("Sign In");
    await login();
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(2);
    expect(container.querySelector("#exam-signin-password-error")?.textContent).toBe("Incorrect email or password");
  });
  it("retains the trial destination when verification renders before sign-in completes", async () => {
    let finish!: (value: unknown) => void;
    auth.signInWithPassword.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render(); await click("Sign in"); await login();
    await act(async () => emit("SIGNED_IN", "a")); await flush();
    await act(async () => finish({ error: null })); await flush();
    expect(container.querySelector(".account-onboarding")).not.toBeNull();
  });
  it("ordinary profile sign-in returns to the dashboard; Paid only changes allowed UI options", async () => {
    await render(); await menu();
    expect(host.querySelector(".exam-account-menu")).toBeNull();
    expect(container.querySelector("#exam-signin-email")).not.toBeNull();
    await click("Create account");
    expect(container.querySelector("#registration-email")).not.toBeNull();
    await click("Sign in"); await login();
    expect(container.textContent).toContain("Complete your profile"); expect(container.textContent).not.toContain("Tell us a little about yourselfShare");
    expect(container.querySelector(".account-trial-panel h3")?.textContent).toBe("Let's make this yours");
    await menu(); const toggle = host.querySelector<HTMLInputElement>('input[role="switch"]')!;
    await act(async () => toggle.click()); expect(container.textContent).toContain("Full Exam setup for a; counts:3,5");
    expect(m.runtime.mock.lastCall?.[0].canStart).toBe(true);
    await click("Sign out"); expect(container.textContent).toContain("Create your free account"); expect(host.textContent).not.toContain("a@example.test"); expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("restores the correct owner's draft and validates conditional fields", async () => {
    current = { id: "a", email: "a@example.test" };
    saveExamOnboarding(localStorage, "https://clpfecuohwzwrgmqzeos.supabase.co", "a", { ...emptyExamOnboarding(), role: "Doctor", stage: "Prefer not to say" });
    await render(); await click("Complete your profile");
    expect(container.querySelector<HTMLInputElement>('input[value="Doctor"]')?.checked).toBe(true);
    expect(container.textContent).toContain("Respiratory"); expect(container.textContent).not.toContain("General practice");
    await click("Continue to exam setup"); expect(container.querySelector('#exam-about-specialty-error')?.textContent).toBe("Select your specialty to continue.");
    await act(async () => container.querySelector<HTMLInputElement>('input[value="Medical student"]')!.click());
    expect(container.textContent).not.toContain("Stage of training"); expect(container.textContent).not.toContain("Specialty");
    await act(async () => container.querySelector<HTMLInputElement>('input[value="General study and revision"]')!.click());
    await click("Continue to exam setup"); expect(container.textContent).toContain("Your Trial Session");
    expect(container.querySelector(".account-trial-onboarding > .account-stepper")).not.toBeNull();
    expect(container.querySelector(".account-trial-onboarding > .exam-trial-builder")).not.toBeNull();
    expect(container.textContent).not.toContain("Trial overview");
    expect(container.textContent).not.toContain("Full Exam setup");
    expect(container.querySelector(".account-trial-onboarding > .account-back")?.textContent).toContain("Back to Exam Room");
    expect(container.querySelector(".account-trial-later")?.textContent).toBe("Do this later");
    await act(async () => container.querySelector<HTMLButtonElement>('.account-stepper button[aria-label="About you"]')!.click());
    expect(container.querySelector<HTMLInputElement>('input[value="Medical student"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[value="General study and revision"]')?.checked).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('.account-stepper button[aria-label="Exam setup"]')!.click());
    expect(container.textContent).toContain("Your Trial Session");
    await act(async () => container.querySelector<HTMLButtonElement>('.account-stepper button[aria-label="About you"]')!.click());
    await act(async () => container.querySelector<HTMLInputElement>('input[value="Doctor"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('.account-stepper button[aria-label="Exam setup"]')!.click());
    expect(container.textContent).not.toContain("Your Trial Session");
    expect(container.querySelector('#exam-about-stage-error')?.textContent).toBe("Select your stage of training to continue.");
    await act(async () => container.querySelector<HTMLInputElement>('input[value="Medical student"]')!.click());
    await click("Continue to exam setup");
    await click("Do this later");
    expect(container.textContent).toContain("Trial overview");
    expect(container.textContent).not.toContain("Your Trial Session");
    expect(container.querySelector(".account-trial-panel h3")?.textContent).toBe("Your trial exam is almost ready");
    await click("Setup my trial exam");
    expect(container.textContent).toContain("Your Trial Session");
    await click("Begin Trial Exam"); expect(m.begin).toHaveBeenCalledTimes(1);
  });
  it("holds onboarding until a verified account has created a password", async () => {
    current = { id: "a", email: "a@example.test" };
    (m.client as any).rpc.mockResolvedValue({ data: { hasPassword: false }, error: null });
    await render();
    expect(container.textContent).toContain("Create your password");
    expect(m.runtime).not.toHaveBeenCalled();
    expect(container.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
  });
  it("keeps the password form visible and shows a CTA spinner while creating the account", async () => {
    current = { id: "a", email: "a@example.test" };
    (m.client as any).rpc.mockResolvedValue({ data: { hasPassword: false }, error: null });
    let finish!: (value: unknown) => void;
    auth.updateUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render();
    await fill("registration-password", "Valid-password1!"); await fill("registration-confirm", "Valid-password1!");
    await click("Create account");
    const cta = container.querySelector<HTMLButtonElement>('button[aria-label="Creating account"]')!;
    expect(cta.disabled).toBe(true); expect(cta.getAttribute("aria-busy")).toBe("true");
    expect(cta.querySelector(".figma-button__spinner")).not.toBeNull();
    expect(cta.textContent).toBe("");
    expect(container.querySelector<HTMLInputElement>("#registration-password")?.disabled).toBe(true);
    expect(container.querySelector("h1")?.textContent).toBe("Create your password");
    await act(async () => finish({ error: { code: "weak_password" } })); await flush();
    expect(container.querySelector("#registration-password")).not.toBeNull();
    expect(container.textContent).toContain("Choose a password");
  });
  it("keeps the email form visible while requesting a verification code", async () => {
    let finish!: (value: unknown) => void;
    auth.signInWithOtp = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    await render(undefined, "/finish-account");
    await fill("registration-email", "new@example.test"); await click("Send verification code");
    const cta = container.querySelector<HTMLButtonElement>('button[aria-label="Sending verification code"]')!;
    expect(cta.disabled).toBe(true); expect(cta.querySelector(".figma-button__spinner")).not.toBeNull();
    expect(container.querySelector("#registration-email")).not.toBeNull();
    expect(container.textContent).not.toContain("Checking account setup");
    await act(async () => finish({ error: null })); await flush();
    expect(container.querySelector("#registration-code")).not.toBeNull();
  });
  it("updates each password requirement while typing and resets when characters are removed", async () => {
    current = { id: "a", email: "a@example.test" };
    (m.client as any).rpc.mockResolvedValue({ data: { hasPassword: false }, error: null });
    await render();
    const states = () => [...container.querySelectorAll(".account-password-requirements li")].map(row => row.getAttribute("data-met"));
    expect(states()).toEqual(["false", "false", "false", "false", "false"]);
    await fill("registration-password", "a");
    expect(states()).toEqual(["false", "false", "false", "true", "false"]);
    await fill("registration-password", "Abcdefgh");
    expect(states()).toEqual(["true", "false", "true", "true", "false"]);
    await fill("registration-password", "Abcdefg1!");
    expect(states()).toEqual(["true", "true", "true", "true", "true"]);
    expect([...container.querySelectorAll(".account-password-requirements li")].every(row => row.getAttribute("aria-label")?.endsWith(": met"))).toBe(true);
    await fill("registration-password", "");
    expect(states()).toEqual(["false", "false", "false", "false", "false"]);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("continues only after password creation has been confirmed by the account service", async () => {
    current = { id: "a", email: "a@example.test" };
    const rpc = (m.client as any).rpc;
    rpc.mockResolvedValue({ data: { hasPassword: false }, error: null });
    auth.updateUser = vi.fn(async () => { rpc.mockResolvedValue({ data: { hasPassword: true }, error: null }); return { data: { user: current }, error: null }; });
    await render(); expect(m.runtime).not.toHaveBeenCalled();
    expect([...container.querySelectorAll(".account-password-pair input, .account-password-pair button")].map(el => el.id || el.getAttribute("aria-controls"))).toEqual(["registration-password", "registration-confirm", "registration-password", "registration-confirm"]);
    await fill("registration-password", "Test-setup-password1!"); await fill("registration-confirm", "Test-setup-password1!");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await flush();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "Test-setup-password1!" });
    expect(m.runtime).toHaveBeenCalled();
    expect(JSON.stringify(localStorage)).not.toContain("Test-setup-password1!");
  });
  it("does not turn absent pilot permission into access when Paid is enabled", async () => {
    current = { id: "a", email: "a@example.test" }; m.access.mockResolvedValue({ status: "not_invited", allowedUnitCounts: [] });
    await render(); expect(container.textContent).not.toContain("does not have pilot access");
    await menu(); await act(async () => host.querySelector<HTMLInputElement>('input[role="switch"]')!.click());
    expect(m.runtime.mock.lastCall?.[0]).toMatchObject({ canStart: false, allowedUnitCounts: [] });
  });
  it("hides prior-user data immediately on expiry and restores only the new account", async () => {
    current = { id: "a", email: "a@example.test" }; await render(); await menu();
    await act(async () => emit("SIGNED_OUT", null)); expect(host.textContent).not.toContain("a@example.test");
    expect(container.textContent).not.toContain("Full Exam setup for a"); expect(auth.signInAnonymously).not.toHaveBeenCalled();
    await act(async () => emit("SIGNED_IN", "b")); await flush();
    expect(host.querySelector("button")?.getAttribute("aria-label")).toContain("b@example.test");
    expect(m.runtime.mock.lastCall?.[0].userId).toBe("b");
  });
  it("warns before sign-out during unfinished work and preserves its journal", async () => {
    current = { id: "a", email: "a@example.test" }; m.active = true;
    localStorage.setItem("abgm-exam-pilot-clpfecuohwzwrgmqzeos-a", "saved-journal");
    await render(); await menu(); expect(host.querySelector<HTMLInputElement>('input[role="switch"]')?.disabled).toBe(true);
    vi.mocked(window.confirm).mockReturnValueOnce(false); await click("Sign out"); expect(auth.signOut).not.toHaveBeenCalled();
    await menu(); await click("Sign out"); expect(localStorage.getItem("abgm-exam-pilot-clpfecuohwzwrgmqzeos-a")).toBe("saved-journal");
  });
  it("prioritises an existing recoverable sitting over onboarding", async () => {
    current = { id: "a", email: "a@example.test" }; m.recover = true;
    await render(); expect(container.textContent).toContain("Full Exam setup for a"); expect(container.textContent).not.toContain("Tell us a little about yourself");
  });
  it("ignores delayed access for an account that has switched", async () => {
    current = { id: "a", email: "a@example.test" }; let finish!: (v: unknown) => void;
    m.access.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await render();
    await act(async () => emit("SIGNED_IN", "b")); await flush();
    await act(async () => finish({ status: "allowed", canStartStandard: true, allowedUnitCounts: [5] }));
    expect(m.runtime.mock.lastCall?.[0]).toMatchObject({ userId: "b", allowedUnitCounts: [3] });
  });
});

describe("connected password reset pages", () => {
  function resetProof() {
    const user = { id: "b", email: "b@example.test", is_anonymous: false, email_confirmed_at: "confirmed" };
    const token = "h." + btoa(JSON.stringify({ sub: "b", iss: "https://clpfecuohwzwrgmqzeos.supabase.co/auth/v1", role: "authenticated",
      is_anonymous: false, session_id: "reset-session", exp: Date.now() / 1000 + 3600, amr: [{ method: "otp" }] })) + ".s";
    const proof = { auth: {
      setSession: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ data: { user, session: { user, access_token: token, refresh_token: "r" } }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: { user, access_token: token, refresh_token: "r" } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      updateUser: vi.fn(async () => ({ data: { user }, error: null })),
      signOut: vi.fn(async () => ({ error: null })), stopAutoRefresh: vi.fn()
    } };
    m.temporary = proof;
    return { proof, callback: { kind: "recovery", purpose: "reset", destination: "exam", tokenHash: "test-reset-hash" } as RegistrationCallback };
  }
  it("verifies a completion code and reaches password setup in the same tab", async () => {
    const user = { id: "new", email: "new@example.test", is_anonymous: false, email_confirmed_at: "confirmed" };
    let verified = false;
    const setupAuth = {
      getSession: vi.fn(async () => ({ data: { session: verified ? { user, access_token: "setup-access", refresh_token: "setup-refresh" } : null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: verified ? user : null }, error: null })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => { verified = true; return { data: { user, session: { user } }, error: null }; }),
      stopAutoRefresh: vi.fn()
    };
    m.temporary = { auth: setupAuth, rpc: vi.fn(async () => ({ data: { hasPassword: false }, error: null })) };
    await render(undefined, "/finish-account?return_to=trial");
    await fill("registration-email", "new@example.test"); await click("Send verification code");
    expect(route()).toBe("/check-email?return_to=trial");
    const input = container.querySelector<HTMLInputElement>("#registration-code")!;
    expect(input.autocomplete).toBe("one-time-code"); expect(input.inputMode).toBe("numeric");
    expect(input.closest('[data-sentry-mask="true"]')).not.toBeNull();
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.startsWith("Resend code"))?.disabled).toBe(true);
    await fill("registration-code", "12"); await click("Verify email");
    expect(container.querySelector("#registration-code-error")?.textContent).toContain("Enter the verification code");
    expect(setupAuth.verifyOtp).not.toHaveBeenCalled();
    setupAuth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "otp_expired" } } as any);
    await fill("registration-code", "123456"); await click("Verify email");
    expect(route()).toBe("/check-email?return_to=trial");
    expect(container.querySelector("#registration-code-error")?.textContent).toContain("incorrect or has expired");
    await fill("registration-code", "654321"); await click("Verify email");
    expect(setupAuth.verifyOtp).toHaveBeenLastCalledWith({ email: "new@example.test", token: "654321", type: "email" });
    expect(route()).toBe("/create-password?return_to=trial");
    expect(container.querySelector("#registration-password")).not.toBeNull();
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(JSON.stringify(localStorage)).not.toContain("654321");
  });
  it("restores a completion code step on refresh and lets the user change the address", async () => {
    localStorage.setItem("abgm-registration-code-v1:clpfecuohwzwrgmqzeos", JSON.stringify({
      version: 1, ownerId: null, email: "pending@example.test", purpose: "complete", destination: "practice", sentAt: Date.now(), resendAvailableAt: Date.now() + 60000
    }));
    await render(undefined, "/check-email?return_to=practice");
    expect(container.textContent).toContain("pending@example.test");
    expect(container.querySelector("#registration-code")).not.toBeNull();
    await click("Change email");
    expect(route()).toBe("/finish-account?return_to=practice");
    expect(container.querySelector<HTMLInputElement>("#registration-email")?.value).toBe("pending@example.test");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("keeps the reset request form visible while sending, then shows the simplified confirmation", async () => {
    let finish!: (value: unknown) => void;
    auth.resetPasswordForEmail.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render(undefined, "/forgot-password");
    await fill("reset-request-email", "new@example.test"); await click("Send reset link");
    const cta = container.querySelector<HTMLButtonElement>('button[aria-label="Sending reset email"]')!;
    expect(cta.disabled).toBe(true); expect(cta.getAttribute("aria-busy")).toBe("true");
    expect(cta.querySelector(".figma-button__spinner")).not.toBeNull(); expect(cta.textContent).toBe("");
    expect(container.querySelector("h1")?.textContent).toBe("Forgot your password?");
    expect(container.querySelector<HTMLInputElement>("#reset-request-email")?.disabled).toBe(true);
    await act(async () => finish({ error: null })); await flush();
    expect(container.querySelector("h1")?.textContent).toBe("Check your email");
    expect(container.textContent).not.toContain("Checking password reset");
    expect(container.textContent).not.toContain("new@example.test");
    expect(container.querySelector(".account-card-icon")).toBeNull();
    expect([...container.querySelectorAll(".account-card button")].map(button => button.textContent)).toEqual(["Back to sign in"]);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });
  it("connects Forgot password, validates email and gives the neutral email result", async () => {
    await render(); await click("Sign in"); await click("Forgot password?");
    await fill("reset-request-email", "invalid"); await click("Send reset link");
    expect(document.activeElement?.id).toBe("reset-request-email");
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    await fill("reset-request-email", "unknown@example.test"); await click("Send reset link");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("unknown@example.test", { redirectTo: expect.stringContaining("account_action=reset") });
    expect(container.textContent).toContain("If an account exists for this address");
    expect(container.textContent).not.toContain("is being connected next");
    await click("Back to sign in"); expect(document.getElementById("exam-signin-password")).not.toBeNull();
  });
  it("validates passwords, saves only through the recovery session and returns to explicit sign-in", async () => {
    const { proof, callback } = resetProof(); await render(callback);
    expect(container.textContent).toContain("Set a new password");
    expect(container.querySelector(".account-card-icon")).toBeNull();
    expect(container.querySelector(".account-address")).toBeNull();
    expect(container.querySelectorAll(".account-password-requirements li")).toHaveLength(5);
    const controls = [...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>("form input, form button")];
    expect(controls.map(el => el.id || el.getAttribute("aria-controls") || el.textContent?.trim())).toEqual([
      "reset-password", "reset-confirm-password", "reset-password", "reset-confirm-password", "Save new password"
    ]);
    expect(controls.every(el => el.tabIndex === 0)).toBe(true);
    const toggles = container.querySelectorAll<HTMLButtonElement>(".account-password-pair button");
    await act(async () => toggles[0].click());
    expect(document.getElementById("reset-password")?.getAttribute("type")).toBe("text");
    expect(document.getElementById("reset-confirm-password")?.getAttribute("type")).toBe("password");
    await act(async () => toggles[1].click());
    expect(document.getElementById("reset-confirm-password")?.getAttribute("type")).toBe("text");
    expect(proof.auth.updateUser).not.toHaveBeenCalled();
    await fill("reset-password", "Test-reset-password1!"); await fill("reset-confirm-password", "mismatch");
    expect(container.querySelectorAll('.account-password-requirements li[data-met="true"]')).toHaveLength(5);
    await click("Save new password");
    expect(proof.auth.updateUser).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("reset-confirm-password");
    await fill("reset-confirm-password", "Test-reset-password1!"); await click("Save new password");
    expect(proof.auth.updateUser).toHaveBeenCalledWith({ password: "Test-reset-password1!" });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Password updated");
    expect(JSON.stringify(localStorage)).not.toContain("Test-reset-password1!");
    await click("Sign in"); expect(document.getElementById("exam-signin-password")).not.toBeNull();
  });
  it("retains another account through reset and asks before a deliberate sign-in switch", async () => {
    current = { id: "a", email: "a@example.test" }; const { proof, callback } = resetProof(); await render(callback);
    expect(container.querySelector(".account-notice")).toBeNull();
    expect(current?.id).toBe("a");
    await fill("reset-password", "Test-reset-password1!"); await fill("reset-confirm-password", "Test-reset-password1!");
    await click("Save new password"); expect(current?.id).toBe("a"); expect(auth.signOut).not.toHaveBeenCalled();
    expect(proof.auth.updateUser).toHaveBeenCalledTimes(1);
    await click("Sign in"); expect(document.getElementById("exam-signin-password")).not.toBeNull();
    vi.mocked(window.confirm).mockReturnValueOnce(false); await login("b");
    expect(auth.signInWithPassword).not.toHaveBeenCalled(); expect(current?.id).toBe("a");
    await login("b"); expect(auth.signInWithPassword).toHaveBeenCalled(); expect(current?.id).toBe("b");
  });
  it("offers another reset request for expired or already-used links", async () => {
    await render({ kind: "error", purpose: "reset" });
    expect(container.querySelector("#reset-request-email-error")?.textContent).toContain("expired or already been used");
    expect(container.querySelector("#reset-request-email")?.getAttribute("aria-describedby")).toBe("reset-request-email-error");
    expect(document.getElementById("reset-request-email")).not.toBeNull();
    expect(document.getElementById("reset-password")).toBeNull();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

it('provides a dashboard return that clears the trial setup route', async()=>{
 current={id:'a',email:'a@example.test'};
 await render(undefined,'/dev/exam-pilot?account=setup&return_to=trial');
 expect(container.querySelector('.account-trial-onboarding')).not.toBeNull();
 await act(async()=>m.runtime.mock.lastCall![0].onReturnToDashboard()); await flush();
 expect(route()).toBe('/dev/exam-pilot?return_to=trial');
 expect(container.querySelector('.account-trial-onboarding')).toBeNull();
 expect(container.textContent).toContain('Trial overview');
});

it.each([
 ["reserved", "pending", false, "Your exam is being marked"],
 ["reserved", "failed", false, "Your marking needs another try"],
 ["reserved", "failed", true, "Your marking needs assistance"],
 ["consumed", "completed", false, "Your trial exam is complete"]
])("uses server state %s/%s/support=%s on the non-paid dashboard", async (state, gradingStatus, requiresSupport, heading) => {
 current = { id: "a", email: "a@example.test" };
 m.lifecycle = { state, gradingStatus, requiresSupport, attemptId: "12345678-1234-1234-1234-123456789abc", canRetryGrading: gradingStatus === "failed" && !requiresSupport, retryAvailableAt: null };
 await render();
 expect(container.textContent).toContain(heading);
 expect(container.textContent).toContain("Latest result");
 expect(container.textContent).not.toContain("Complete your profile");
 expect(container.textContent).not.toContain("Begin Trial Exam");
});
it("does not open onboarding when lifecycle cannot be verified", async () => {
 current = { id: "a", email: "a@example.test" }; m.lifecycle = undefined;
 await render(); expect(container.textContent).toContain("confirm your trial status");
 expect(container.textContent).not.toContain("Complete your profile");
});
