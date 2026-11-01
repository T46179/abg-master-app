// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import type { RegistrationCallback } from "../../core/registrationCallback";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SiteAccountProvider, useSiteAccount } from "../../app/SiteAccountProvider";
import { RegistrationProvider } from "../../app/RegistrationProvider";
import AccountNav from "./AccountNav.dev";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyExamOnboarding, saveExamOnboarding } from "../../core/examOnboarding";

const m = vi.hoisted(() => ({ client: null as unknown, temporary: null as any, access: vi.fn(), active: false, recover: false, runtime: vi.fn(), begin: vi.fn() }));
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
  const controls = { fullSetup, withSetup: (content: unknown) => <div>Trial overview{content as any}</div>, canRecover: m.recover, ready: true, busy: false, canBegin: props.canStart && props.allowedUnitCounts.includes(3), timed: true, showRanges: true, setTimed: vi.fn(), setShowRanges: vi.fn(), begin: m.begin };
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
async function render(callback?: RegistrationCallback) { await act(async () => root.render(<MemoryRouter><SiteAccountProvider client={m.client as SupabaseClient}><RegistrationProvider client={m.client as SupabaseClient} callback={callback}>{createPortal(<AccountNav />, host)}<OwnedExperience /></RegistrationProvider></SiteAccountProvider></MemoryRouter>)); await flush(); }
async function login(id = "a") {
  await fill("exam-signin-email", ` ${id}@example.test `); await fill("exam-signin-password", " password ");
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await flush();
}
async function menu() { await act(async () => host.querySelector<HTMLButtonElement>("button")!.click()); }
beforeEach(() => {
  vi.useFakeTimers(); vi.stubEnv("VITE_EXAM_PILOT_SUPABASE_URL", "https://clpfecuohwzwrgmqzeos.supabase.co"); vi.stubEnv("VITE_EXAM_PILOT_SUPABASE_ANON_KEY", "public");
  localStorage.clear(); m.temporary = null; current = null; m.active = false; m.recover = false; m.runtime.mockClear(); m.begin.mockClear(); m.access.mockReset(); m.access.mockResolvedValue({ status: "allowed", allowedUnitCounts: [3, 5], customisationCategories: [] });
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
  it("starts as guest, preserves current copy and does not create an account", async () => {
    await render(); expect(container.textContent).toContain("Preparing for exams?"); expect(container.textContent).toContain("Your Session"); expect(container.textContent).toContain("Graded Short Answers"); expect(container.textContent).not.toContain("Train for the real thing");
    expect(auth.signInAnonymously).not.toHaveBeenCalled(); expect(m.access).not.toHaveBeenCalled();
    await click("Start trial exam"); expect(container.textContent).toContain("Creating an account saves your progress across devices so you can pick up where you left off.");
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
    expect(container.textContent).toContain("Start trial exam"); expect(container.textContent).not.toContain("Tell us a little about yourselfShare");
    await menu(); const toggle = host.querySelector<HTMLInputElement>('input[role="switch"]')!;
    await act(async () => toggle.click()); expect(container.textContent).toContain("Full Exam setup for a; counts:3,5");
    expect(m.runtime.mock.lastCall?.[0].canStart).toBe(true);
    await click("Sign out"); expect(container.textContent).toContain("Start trial exam"); expect(host.textContent).not.toContain("a@example.test"); expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("restores the correct owner's draft and validates conditional fields", async () => {
    current = { id: "a", email: "a@example.test" };
    saveExamOnboarding(localStorage, "https://clpfecuohwzwrgmqzeos.supabase.co", "a", { ...emptyExamOnboarding(), role: "Doctor", stage: "Prefer not to say" });
    await render(); await click("Start trial exam");
    expect(container.querySelector<HTMLInputElement>('input[value="Doctor"]')?.checked).toBe(true);
    expect(container.textContent).toContain("Respiratory"); expect(container.textContent).not.toContain("General practice");
    await click("Continue to exam setup"); expect(container.querySelector('[role="alert"]')?.textContent).toContain("highlighted");
    await act(async () => container.querySelector<HTMLInputElement>('input[value="Medical student"]')!.click());
    expect(container.textContent).not.toContain("Stage of training"); expect(container.textContent).not.toContain("Specialty");
    await act(async () => container.querySelector<HTMLInputElement>('input[value="General study and revision"]')!.click());
    await click("Continue to exam setup"); expect(container.textContent).toContain("Your trial sitting");
    await click("Begin trial exam"); expect(m.begin).toHaveBeenCalledTimes(1);
  });
  it("holds onboarding until a verified account has created a password", async () => {
    current = { id: "a", email: "a@example.test" };
    (m.client as any).rpc.mockResolvedValue({ data: { hasPassword: false }, error: null });
    await render();
    expect(container.textContent).toContain("Create your password");
    expect(m.runtime).not.toHaveBeenCalled();
    expect(container.querySelector('input[autocomplete="new-password"]')).not.toBeNull();
  });
  it("continues only after password creation has been confirmed by the account service", async () => {
    current = { id: "a", email: "a@example.test" };
    const rpc = (m.client as any).rpc;
    rpc.mockResolvedValue({ data: { hasPassword: false }, error: null });
    auth.updateUser = vi.fn(async () => { rpc.mockResolvedValue({ data: { hasPassword: true }, error: null }); return { data: { user: current }, error: null }; });
    await render(); expect(m.runtime).not.toHaveBeenCalled();
    await fill("registration-password", "test-setup-password"); await fill("registration-confirm", "test-setup-password");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await flush();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "test-setup-password" });
    expect(m.runtime).toHaveBeenCalled();
    expect(JSON.stringify(localStorage)).not.toContain("test-setup-password");
  });
  it("does not turn absent pilot permission into access when Paid is enabled", async () => {
    current = { id: "a", email: "a@example.test" }; m.access.mockResolvedValue({ status: "not_invited", allowedUnitCounts: [] });
    await render(); expect(container.textContent).toContain("does not have pilot access");
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
    await act(async () => finish({ status: "allowed", allowedUnitCounts: [5] }));
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
    expect(proof.auth.updateUser).not.toHaveBeenCalled();
    await fill("reset-password", "test-reset-password"); await fill("reset-confirm-password", "mismatch");
    await click("Save new password");
    expect(proof.auth.updateUser).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("reset-confirm-password");
    await fill("reset-confirm-password", "test-reset-password"); await click("Save new password");
    expect(proof.auth.updateUser).toHaveBeenCalledWith({ password: "test-reset-password" });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Your password has been updated");
    expect(JSON.stringify(localStorage)).not.toContain("test-reset-password");
    await click("Sign in with new password"); expect(document.getElementById("exam-signin-password")).not.toBeNull();
  });
  it("retains another account through reset and asks before a deliberate sign-in switch", async () => {
    current = { id: "a", email: "a@example.test" }; const { proof, callback } = resetProof(); await render(callback);
    expect(container.textContent).toContain("will not switch the account");
    await fill("reset-password", "test-reset-password"); await fill("reset-confirm-password", "test-reset-password");
    await click("Save new password"); expect(current?.id).toBe("a"); expect(auth.signOut).not.toHaveBeenCalled();
    expect(proof.auth.updateUser).toHaveBeenCalledTimes(1);
    await click("Sign in with new password"); expect(document.getElementById("exam-signin-password")).not.toBeNull();
    vi.mocked(window.confirm).mockReturnValueOnce(false); await login("b");
    expect(auth.signInWithPassword).not.toHaveBeenCalled(); expect(current?.id).toBe("a");
    await login("b"); expect(auth.signInWithPassword).toHaveBeenCalled(); expect(current?.id).toBe("b");
  });
  it("offers another reset request for expired or already-used links", async () => {
    await render({ kind: "error", purpose: "reset" });
    expect(container.textContent).toContain("expired or already been used");
    expect(document.getElementById("reset-request-email")).not.toBeNull();
    expect(document.getElementById("reset-password")).toBeNull();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
