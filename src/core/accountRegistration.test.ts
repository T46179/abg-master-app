import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSiteAccount } from "./siteAccount";
import { createAccountRegistration, REGISTRATION_PENDING_KEY } from "./accountRegistration";
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
    await f.r.completePassword("test-only-password");
    expect(f.proof.auth.updateUser).toHaveBeenCalledWith({ password: "test-only-password" });
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
    f.r.confirmSwitch(); await f.r.completePassword("fresh-test-password");
    expect(f.account.getSnapshot().userId).toBe("fresh");
  });
  it("uses an existing-account-only completion email without depending on a pending record", async () => {
    const f = await fixture();
    await f.r.completionEmail("guest@example.test", "trial");
    expect(f.proof.auth.signInWithOtp).toHaveBeenCalledWith({ email: "guest@example.test", options: { shouldCreateUser: false, emailRedirectTo: expect.stringContaining("account_action=complete") } });
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
    await f.r.completeReset("new-test-password");
    expect(f.proof.auth.updateUser).toHaveBeenCalledWith({ password: "new-test-password" });
    expect(f.r.getSnapshot().phase).toBe("reset_complete");
    expect(f.proof.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(f.canonical.auth.signOut).not.toHaveBeenCalled();
    expect(f.canonical.auth.setSession).not.toHaveBeenCalled();
    expect(f.account.getSnapshot().userId).toBe("other");
    expect(f.storage.getItem("other-journal")).toBe("preserved");
    expect(JSON.stringify(f.r.getSnapshot())).not.toContain("new-test-password");
  });
  it("signs out the matching local identity after reset while retaining its journal", async () => {
    const f = await resetFixture(); f.canonical.change("recovered"); await f.account.refresh();
    f.storage.setItem("recovered-journal", "preserved");
    f.canonical.auth.signOut.mockImplementation(async () => {
      f.canonical.auth.getSession.mockResolvedValue({ data: { session: null as any }, error: null }); return { error: null };
    });
    await f.callback(); await f.r.completeReset("new-test-password");
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
    const operation = f.r.completeReset("target-only-password");
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
    await f.r.completeReset("same-test-password");
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
