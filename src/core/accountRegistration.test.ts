import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSiteAccount } from "./siteAccount";
import { createAccountRegistration, REGISTRATION_PENDING_KEY, REGISTRATION_CODE_KEY, REGISTRATION_RESEND_DELAY_MS } from "./accountRegistration";
import { createMemoryStorage } from "./storage";
const stops: Array<() => void> = [];
afterEach(() => { stops.splice(0).forEach(stop => stop()); });
function client(id: string, anonymous: boolean, hasPassword = false) {
  let user = { id, is_anonymous: anonymous, email: anonymous ? undefined : id + "@example.test", email_confirmed_at: anonymous ? undefined : "verified" };
  let passwordExists = hasPassword;
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: { user, access_token: "test-access-" + user.id, refresh_token: "test-refresh-" + user.id } }, error: null })),
    getUser: vi.fn(async () => ({ data: { user }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    updateUser: vi.fn(async (value: { email?: string; password?: string }) => { if (value.password) passwordExists = true; return { data: { user }, error: null }; }),
    signInAnonymously: vi.fn(async () => ({ data: { user }, error: null })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ data: { user, session: null as any }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    setSession: vi.fn(async () => ({ error: null })),
    stopAutoRefresh: vi.fn(),
  };
  const rpc = vi.fn(async () => ({ data: { hasPassword: passwordExists }, error: null }));
  return { auth, rpc, client: { auth, rpc } as unknown as SupabaseClient,
    change(id: string, anonymous = false) { user = { id, is_anonymous: anonymous, email: anonymous ? undefined : id + "@example.test", email_confirmed_at: anonymous ? undefined : "verified" }; },
    hasPassword(value: boolean) { passwordExists = value; }
  };
}
async function fixture() {
  const canonical = client("guest", true); const pending = client("fresh", true); const proof = client("guest", false);
  const account = createSiteAccount(canonical.client); account.start(); stops.push(account.stop); await account.refresh();
  const bound = client("guest", true); const freshBound = client("fresh", true);
  const storage = createMemoryStorage(); const temporary = vi.fn((kind: "pending" | "callback", credentials?: { access_token: string }) => kind === "pending" ? pending.client : credentials ? credentials.access_token.endsWith("fresh") ? freshBound.client : bound.client : proof.client);
  canonical.auth.setSession.mockImplementation(async () => { canonical.change((await proof.auth.getUser()).data.user.id); canonical.hasPassword(true); return { error: null }; });
  const r = createAccountRegistration(account, canonical.client, temporary, storage);
  const callback = (purpose: "verify" | "complete" = "verify") => r.callback({ kind: "session", accessToken: "test-access", refreshToken: "test-refresh", purpose, destination: "trial" });
  return { canonical, pending, proof, bound, freshBound, account, storage, temporary, r, callback };
}
describe("email-first account registration", () => {
  it("keeps the same guest owner and never submits a password before verification", async () => {
    const f = await fixture(); f.storage.setItem("owned-progress", "xp:120;calibration;history;draft");
    await f.r.begin(" new@example.test ", true, "trial");
    expect(f.bound.auth.updateUser).toHaveBeenCalledWith({ email: "new@example.test" }, expect.objectContaining({ emailRedirectTo: expect.stringContaining("account_action=verify") }));
    expect(f.canonical.auth.updateUser).not.toHaveBeenCalled();
    expect(f.r.getSnapshot().phase).toBe("awaiting_email");
    await f.callback(); expect(f.r.getSnapshot().phase).toBe("password");
    await f.r.completePassword("Test-only-password1!");
    expect(f.proof.auth.updateUser).toHaveBeenCalledWith({ password: "Test-only-password1!" });
    expect(f.account.getSnapshot()).toMatchObject({ userId: "guest", status: "verified" });
    expect(f.r.getSnapshot().phase).toBe("complete");
    expect(f.storage.getItem("owned-progress")).toBe("xp:120;calibration;history;draft");
    expect(f.storage.getItem(REGISTRATION_PENDING_KEY)).toBeNull();
    expect(f.storage.getItem("password")).toBeNull();
  });
  it("creates the shared guest when a new visitor chooses the default keep-progress path", async () => {
    const f = await fixture();
    f.canonical.auth.getSession.mockResolvedValueOnce({ data: { session: null as any }, error: null });
    await f.account.refresh();
    f.canonical.auth.getSession.mockResolvedValueOnce({ data: { session: null as any }, error: null });
    f.canonical.auth.getSession.mockResolvedValueOnce({ data: { session: null as any }, error: null });
    await f.r.begin("new@example.test", true, "trial");
    expect(f.canonical.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(f.r.getSnapshot().phase).toBe("awaiting_email");
    expect(f.r.pending()).toMatchObject({ ownerId: "guest", targetId: "guest", keepProgress: true });
  });
  it("restores an interrupted registration without storing credentials in its draft", async () => {
    const f = await fixture(); await f.r.begin("new@example.test", true, "trial");
    const restored = createAccountRegistration(f.account, f.canonical.client, f.temporary, f.storage);
    await restored.resume(); expect(restored.getSnapshot().phase).toBe("awaiting_email");
    f.canonical.change("guest"); f.bound.change("guest"); await f.account.refresh();
    await restored.resume(); expect(restored.getSnapshot().phase).toBe("password");
    const saved = f.storage.getItem(REGISTRATION_PENDING_KEY)!;
    expect(saved).not.toContain("test-access"); expect(saved).not.toContain("test-refresh"); expect(saved).not.toContain("password");
  });
  it("can retry after leaving an in-flight registration without retaining a busy lock", async () => {
    const f = await fixture(); let finish!: (value: any) => void;
    f.bound.auth.updateUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const operation = f.r.begin("first@example.test", true, "exam");
    await vi.waitFor(() => expect(f.bound.auth.updateUser).toHaveBeenCalled());
    f.r.resetView(); finish({ data: { user: { id: "guest" } }, error: null }); await operation;
    expect(f.r.isBusy()).toBe(false);
    await f.r.begin("retry@example.test", true, "exam"); expect(f.r.pending()?.email).toBe("retry@example.test");
  });
  it("starting fresh does not replace or modify the active guest before completion", async () => {
    const f = await fixture(); await f.r.begin("fresh@example.test", false, "exam");
    expect(f.freshBound.auth.updateUser).toHaveBeenCalledWith({ email: "fresh@example.test" }, expect.anything());
    expect(f.canonical.auth.updateUser).not.toHaveBeenCalled();
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    expect(f.account.getSnapshot().userId).toBe("guest");
    f.proof.change("fresh");
    await f.callback(); expect(f.r.getSnapshot().phase).toBe("switch");
    f.r.confirmSwitch(); await f.r.completePassword("Fresh-test-password1!");
    expect(f.account.getSnapshot().userId).toBe("fresh");
  });
  it("uses an existing-account-only completion email without depending on a pending record", async () => {
    const f = await fixture();
    await f.r.completionEmail("guest@example.test", "trial");
    expect(f.pending.auth.signInWithOtp).toHaveBeenCalledWith({ email: "guest@example.test", options: { shouldCreateUser: false, emailRedirectTo: expect.stringContaining("account_action=complete") } });
    await f.callback("complete"); expect(f.r.getSnapshot().phase).toBe("password");
  });
  it("never adopts a completion-link session or updates a password that already exists", async () => {
    const f = await fixture(); f.proof.hasPassword(true);
    await f.callback("complete");
    expect(f.r.getSnapshot().phase).toBe("signin");
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
  });
  it("checks again before password submission when another browser finished setup", async () => {
    const f = await fixture(); await f.callback("complete"); f.proof.hasPassword(true);
    await f.r.completePassword("must-not-overwrite");
    expect(f.r.getSnapshot().phase).toBe("signin"); expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
  });
  it("requires an explicit account switch for a different verified registration", async () => {
    const f = await fixture(); f.canonical.change("existing"); await f.account.refresh(); f.proof.change("new");
    await f.callback("complete"); expect(f.r.getSnapshot().phase).toBe("switch");
    await f.r.completePassword("not-authorized"); expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
  });
  it("fails closed when setup status is unavailable or malformed", async () => {
    const f = await fixture(); f.proof.rpc.mockResolvedValue({ data: { hasPassword: undefined as any }, error: null });
    await f.callback("complete");
    expect(f.r.getSnapshot().phase).toBe("error"); expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
  });
  it("resends email without submitting or staging any password", async () => {
    const f = await fixture(); await f.r.begin("first@example.test", true, "exam"); await f.r.resend("corrected@example.test");
    expect(f.bound.auth.updateUser.mock.lastCall?.[0]).toEqual({ email: "corrected@example.test" });
    expect(f.r.pending()?.email).toBe("corrected@example.test");
  });
  it("ignores an old registration result after the active account changes", async () => {
    const f = await fixture(); let finish!: (value: any) => void;
    f.bound.auth.updateUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const operation = f.r.begin("first@example.test", true, "exam");
    await vi.waitFor(() => expect(f.bound.auth.updateUser).toHaveBeenCalled());
    f.canonical.change("other"); await f.account.refresh();
    finish({ data: { user: { id: "guest" } }, error: null }); await operation;
    expect(f.r.getSnapshot().phase).toBe("error"); expect(f.r.pending()).toBeNull(); expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
  });
  it("does not disclose old pending emails to a different active owner", async () => {
    const f = await fixture(); await f.r.begin("private@example.test", true, "exam");
    f.canonical.change("other"); await f.account.refresh(); f.r.accountChanged();
    expect(f.r.pending()).toBeNull(); expect(f.r.getSnapshot().email).toBe("");
  });
});

function recoveryToken(id: string, method = "otp", overrides = {}) {
  return "test." + btoa(JSON.stringify({ sub: id, iss: "https://clpfecuohwzwrgmqzeos.supabase.co/auth/v1",
    role: "authenticated", is_anonymous: false, session_id: "test-session", exp: Date.now() / 1000 + 3600, amr: [{ method }], ...overrides })) + ".signature";
}
async function resetFixture(method = "otp") {
  const f = await fixture();
  f.proof.change("recovered"); f.proof.hasPassword(true);
  f.proof.auth.getSession.mockImplementation(async () => {
    const { data } = await f.proof.auth.getUser();
    return { data: { session: { user: data.user, access_token: recoveryToken(data.user.id, method), refresh_token: "reset-refresh" } }, error: null };
  });
  f.proof.auth.verifyOtp.mockImplementation(async () => {
    const session = (await f.proof.auth.getSession()).data.session;
    return { data: { user: session.user, session }, error: null };
  });
  const callback = () => f.r.callback({ kind: "recovery", tokenHash: "test-reset-hash", purpose: "reset", destination: "practice" });
  return { ...f, callback };
}
describe("password recovery", () => {
  it("uses the standard reset email, a safe local destination and no signup or canonical session write", async () => {
    const f = await resetFixture();
    await f.r.requestResetEmail(" recovered@example.test ", "practice");
    expect(f.proof.auth.resetPasswordForEmail).toHaveBeenCalledWith("recovered@example.test", { redirectTo: expect.stringContaining("account_action=reset&return_to=practice") });
    expect(f.r.getSnapshot()).toMatchObject({ phase: "awaiting_email", email: "recovered@example.test" });
    expect(f.proof.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    f.proof.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "user_not_found" } } as any);
    await f.r.requestResetEmail("unknown@example.test");
    expect(f.r.getSnapshot().phase).toBe("awaiting_email");
  });
  it("does not report email success on network or rate-limit failure", async () => {
    const f = await resetFixture();
    f.proof.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "over_email_send_rate_limit" } } as any);
    await f.r.requestResetEmail("recovered@example.test");
    expect(f.r.getSnapshot()).toMatchObject({ phase: "error" });
  });
  it("resets only the proven target without switching a different active account or its progress", async () => {
    const f = await resetFixture(); f.canonical.change("other"); await f.account.refresh();
    f.storage.setItem("other-journal", "preserved");
    await f.callback(); expect(f.r.getSnapshot()).toMatchObject({ phase: "reset_password", email: "recovered@example.test" });
    expect(f.proof.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "test-reset-hash", type: "recovery" });
    expect(f.r.canSetPassword()).toBe(false);
    await f.r.completeReset("New-test-password1!");
    expect(f.proof.auth.updateUser).toHaveBeenCalledWith({ password: "New-test-password1!" });
    expect(f.r.getSnapshot().phase).toBe("reset_complete");
    expect(f.proof.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(f.canonical.auth.signOut).not.toHaveBeenCalled();
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    expect(f.account.getSnapshot().userId).toBe("other");
    expect(f.storage.getItem("other-journal")).toBe("preserved");
    expect(JSON.stringify(f.r.getSnapshot())).not.toContain("New-test-password1!");
  });
  it("signs out the matching local identity after reset while retaining its journal", async () => {
    const f = await resetFixture(); f.canonical.change("recovered"); await f.account.refresh();
    f.storage.setItem("recovered-journal", "preserved");
    f.canonical.auth.signOut.mockImplementation(async () => {
      f.canonical.auth.getSession.mockResolvedValue({ data: { session: null as any }, error: null }); return { error: null };
    });
    await f.callback(); await f.r.completeReset("New-test-password1!");
    expect(f.account.getSnapshot().status).toBe("signed_out");
    expect(f.r.getSnapshot()).toMatchObject({ phase: "reset_complete", completedUserId: null });
    expect(f.storage.getItem("recovered-journal")).toBe("preserved");
  });
  it.each(["password", "magiclink", "otp"])("rejects a relabelled existing %s session without a recovery exchange", async method => {
    const f = await resetFixture(method);
    await f.r.callback({ kind: "session", accessToken: recoveryToken("recovered", method), refreshToken: "r", purpose: "reset", destination: "exam" } as any);
    expect(f.proof.auth.verifyOtp).not.toHaveBeenCalled();
    expect(f.r.getSnapshot().phase).toBe("error");
    expect(f.r.canResetPassword()).toBe(false);
    await f.r.completeReset("must-not-write");
    expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects expired signed claims and unverified server identities", async () => {
    const f = await resetFixture();
    const user = (await f.proof.auth.getUser()).data.user;
    f.proof.auth.getSession.mockResolvedValue({ data: { session: { user, access_token: recoveryToken(user.id, "otp", { exp: 1 }), refresh_token: "r" } }, error: null });
    await f.callback(); expect(f.r.canResetPassword()).toBe(false);
    const second = await resetFixture();
    second.proof.auth.getUser.mockResolvedValue({ data: { user: { ...user, email_confirmed_at: undefined } }, error: null });
    await second.callback(); expect(second.r.getSnapshot().phase).toBe("error");
    expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
  });
  it("does not allow registration completion to overwrite an existing password", async () => {
    const f = await resetFixture(); await f.callback();
    await f.r.completePassword("must-not-use-setup-method");
    expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
  });
  it("rechecks identity and recovery proof before writing a password", async () => {
    const f = await resetFixture(); await f.callback();
    f.canonical.change("different"); await f.account.refresh();
    await f.r.completeReset("must-not-write");
    expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
    expect(f.r.getSnapshot().phase).toBe("error");
    expect(f.r.getSnapshot().email).toBe("");
  });
  it("ignores a delayed reset result after another account signs in", async () => {
    const f = await resetFixture(); await f.callback();
    let finish!: (value: any) => void;
    f.proof.auth.updateUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const operation = f.r.completeReset("Target-only-password1!");
    await vi.waitFor(() => expect(f.proof.auth.updateUser).toHaveBeenCalled());
    f.canonical.change("different"); await f.account.refresh(); f.r.accountChanged();
    finish({ data: { user: { id: "recovered" } }, error: null }); await operation;
    expect(f.r.getSnapshot()).toMatchObject({ phase: "idle", email: "" });
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    expect(f.canonical.auth.signOut).not.toHaveBeenCalled();
  });
  it("shows a safe retry for expired links and handles same-password rejection without success", async () => {
    const f = await resetFixture();
    await f.r.callback({ kind: "error", purpose: "reset" });
    expect(f.r.getSnapshot()).toMatchObject({ phase: "error", email: "" });
    expect(f.r.emailPurpose()).toBe("reset");
    await f.callback();
    f.proof.auth.updateUser.mockResolvedValueOnce({ data: { user: null as any }, error: { code: "same_password" } } as any);
    await f.r.completeReset("Same-test-password1!");
    expect(f.r.getSnapshot()).toMatchObject({ phase: "error", error: "Choose a password different from your current password." });
    expect(f.r.canResetPassword()).toBe(true);
  });
});

describe("server-verified reset grants", () => {
  it("requires a successful one-time recovery exchange before showing password fields", async () => {
    const f = await resetFixture();
    f.proof.auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "otp_expired" } } as any);
    await f.callback();
    expect(f.r.getSnapshot()).toMatchObject({ phase: "error" });
    expect(f.r.canResetPassword()).toBe(false);
    await f.r.completeReset("must-not-write");
    expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
  });
  it("does not trust a different session installed after the recovery exchange", async () => {
    const f = await resetFixture(); await f.callback();
    const user = (await f.proof.auth.getUser()).data.user;
    f.proof.auth.getSession.mockResolvedValue({ data: { session: { user, access_token: recoveryToken(user.id, "otp", { session_id: "another-session" }), refresh_token: "r" } }, error: null });
    await f.r.completeReset("must-not-write");
    expect(f.proof.auth.updateUser).not.toHaveBeenCalled();
    expect(f.r.getSnapshot().phase).toBe("error");
  });
});

describe("single-tab registration codes", () => {
  const requestCode = "123456";
  function confirm(f: Awaited<ReturnType<typeof fixture>>, fresh = false) {
    const verifier = fresh ? f.freshBound : f.bound;
    if (fresh) f.pending.auth.setSession.mockImplementation(async () => { f.pending.change("fresh"); return { error: null }; });
    verifier.auth.verifyOtp.mockImplementation(async () => {
      verifier.change(fresh ? "fresh" : "guest");
      return { data: { user: (await verifier.auth.getUser()).data.user, session: (await verifier.auth.getSession()).data.session }, error: null };
    });
    return verifier;
  }
  it("verifies the pending email on its isolated guest session and keeps progress until password completion", async () => {
    const f = await fixture(); f.storage.setItem("owned-progress", "xp:120;history;draft");
    await f.r.begin("guest@example.test", true, "trial"); const verifier = confirm(f);
    await f.r.verifyCode(requestCode);
    expect(verifier.auth.verifyOtp).toHaveBeenCalledWith({ email: "guest@example.test", token: requestCode, type: "email_change" });
    expect(f.r.getSnapshot()).toMatchObject({ phase: "password", destination: "trial" });
    expect(f.canonical.auth.verifyOtp).not.toHaveBeenCalled();
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    expect(f.storage.getItem("owned-progress")).toBe("xp:120;history;draft");
    expect(f.storage.getItem(REGISTRATION_CODE_KEY)).not.toContain(requestCode);
    await f.r.completePassword("Test-only-password1!");
    expect(f.account.getSnapshot()).toMatchObject({ userId: "guest", status: "verified" });
    expect(f.r.getSnapshot().phase).toBe("complete");
    expect(f.storage.getItem(REGISTRATION_CODE_KEY)).toBeNull();
  });
  it("does not replace the active guest when verifying a fresh account", async () => {
    const f = await fixture(); await f.r.begin("fresh@example.test", false, "practice");
    const verifier = confirm(f, true); f.proof.change("fresh");
    await f.r.verifyCode(requestCode);
    expect(verifier.auth.verifyOtp).toHaveBeenCalled();
    expect(f.account.getSnapshot().userId).toBe("guest");
    expect(f.r.getSnapshot().phase).toBe("switch");
    expect(f.pending.auth.setSession).toHaveBeenCalled();
    const restored = createAccountRegistration(f.account, f.canonical.client, f.temporary, f.storage);
    await restored.resume(); expect(restored.getSnapshot().phase).toBe("switch");
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    f.r.confirmSwitch(); await f.r.completePassword("Test-only-password1!");
    expect(f.account.getSnapshot().userId).toBe("fresh");
  });
  it.each(["email", "identity"])("rejects a verified session for the wrong %s", async mismatch => {
    const f = await fixture(); await f.r.begin(mismatch === "email" ? "new@example.test" : "other@example.test", true, "exam");
    f.bound.auth.verifyOtp.mockImplementation(async () => {
      f.bound.change(mismatch === "identity" ? "other" : "guest");
      return { data: { user: (await f.bound.auth.getUser()).data.user, session: null }, error: null };
    });
    await f.r.verifyCode(requestCode);
    expect(f.r.getSnapshot()).toMatchObject({ phase: "error", error: expect.stringContaining("does not match") });
    expect(f.r.canSetPassword()).toBe(false); expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
  });
  it("rejects malformed codes before contacting Auth", async () => {
    const f = await fixture(); await f.r.begin("guest@example.test", true, "exam");
    await f.r.verifyCode("bad-code");
    expect(f.bound.auth.verifyOtp).not.toHaveBeenCalled(); expect(f.r.getSnapshot().phase).toBe("error");
  });
  it("keeps invalid or expired codes retryable without exposing provider details", async () => {
    const f = await fixture(); await f.r.begin("guest@example.test", true, "exam");
    f.bound.auth.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "otp_expired", message: "private provider detail" } } as any);
    await f.r.verifyCode(requestCode);
    expect(f.r.getSnapshot().error).toBe("This code is incorrect or has expired. Try again or request a new code.");
    expect(f.r.canSetPassword()).toBe(false);
    confirm(f); await f.r.verifyCode(requestCode);
    expect(f.r.getSnapshot().phase).toBe("password");
  });
  it("ignores a successful response if the active account changed while verifying", async () => {
    const f = await fixture(); await f.r.begin("guest@example.test", true, "trial");
    let finish!: (value: any) => void;
    f.bound.auth.verifyOtp.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const work = f.r.verifyCode(requestCode);
    await vi.waitFor(() => expect(f.bound.auth.verifyOtp).toHaveBeenCalled());
    f.canonical.change("other"); await f.account.refresh(); f.r.accountChanged();
    finish({ data: { user: { id: "guest" }, session: null }, error: null }); await work;
    expect(f.r.canSetPassword()).toBe(false); expect(f.r.codeRequest()).toBeNull();
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
  });
  it("restores the pending email, purpose and destination on refresh without sending another email", async () => {
    const f = await fixture(); await f.r.begin("guest@example.test", true, "learn");
    const restored = createAccountRegistration(f.account, f.canonical.client, f.temporary, f.storage);
    await restored.resume();
    expect(restored.getSnapshot()).toMatchObject({ phase: "awaiting_email", email: "guest@example.test", destination: "learn" });
    expect(restored.codeRequest()?.purpose).toBe("verify");
    expect(f.bound.auth.updateUser).toHaveBeenCalledTimes(1);
  });
  it("enforces resend cooldown and binds a changed address to a new request", async () => {
    const f = await fixture(); await f.r.begin("guest@example.test", true, "trial");
    await f.r.resend(); expect(f.bound.auth.updateUser).toHaveBeenCalledTimes(1);
    expect(f.r.getSnapshot().error).toContain("Please wait");
    await f.r.resend("changed@example.test");
    expect(f.r.codeRequest()?.email).toBe("changed@example.test");
    await f.r.verifyCode(requestCode);
    expect(f.bound.auth.verifyOtp).toHaveBeenCalledWith({ email: "changed@example.test", token: requestCode, type: "email_change" });
    const time = vi.spyOn(Date, "now").mockReturnValue(Date.now() + REGISTRATION_RESEND_DELAY_MS + 1);
    try { await f.r.resend(); expect(f.bound.auth.updateUser).toHaveBeenCalledTimes(3); } finally { time.mockRestore(); }
  });
  it("rejects a code request superseded by another tab", async () => {
    const f = await fixture(); await f.r.begin("guest@example.test", true, "exam");
    const stored = JSON.parse(f.storage.getItem(REGISTRATION_CODE_KEY)!);
    f.storage.setItem(REGISTRATION_CODE_KEY, JSON.stringify({ ...stored, email: "changed@example.test" }));
    await f.r.verifyCode(requestCode);
    expect(f.bound.auth.verifyOtp).not.toHaveBeenCalled();
    expect(f.r.canSetPassword()).toBe(false);
  });
  it("does not submit duplicate verification requests", async () => {
    const f = await fixture(); await f.r.begin("guest@example.test", true, "exam");
    let finish!: (value: any) => void;
    f.bound.auth.verifyOtp.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = f.r.verifyCode(requestCode);
    await vi.waitFor(() => expect(f.bound.auth.verifyOtp).toHaveBeenCalled());
    await f.r.verifyCode(requestCode); expect(f.bound.auth.verifyOtp).toHaveBeenCalledTimes(1);
    finish({ data: { user: null, session: null }, error: { code: "otp_expired" } }); await first;
  });
  it("verifies completion codes in a separate persistent setup session and resumes after refresh", async () => {
    const f = await fixture(); await f.r.completionEmail("fresh@example.test", "trial");
    f.pending.auth.verifyOtp.mockImplementation(async () => {
      f.pending.change("fresh");
      return { data: { user: (await f.pending.auth.getUser()).data.user, session: (await f.pending.auth.getSession()).data.session }, error: null };
    });
    await f.r.verifyCode(requestCode);
    expect(f.pending.auth.verifyOtp).toHaveBeenCalledWith({ email: "fresh@example.test", token: requestCode, type: "email" });
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    const restored = createAccountRegistration(f.account, f.canonical.client, f.temporary, f.storage);
    await restored.resume();
    expect(restored.emailPurpose()).toBe("complete");
    expect(restored.getSnapshot()).toMatchObject({ phase: "switch", email: "fresh@example.test", destination: "trial" });
  });
  it("never overwrites an existing password after a completion code", async () => {
    const f = await fixture(); await f.r.completionEmail("fresh@example.test", "exam");
    f.pending.change("fresh"); f.pending.hasPassword(true);
    await f.r.verifyCode(requestCode);
    expect(f.r.getSnapshot().phase).toBe("signin");
    expect(f.r.canSetPassword()).toBe(false);
    expect(f.pending.auth.updateUser).not.toHaveBeenCalled(); expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
  });
});
