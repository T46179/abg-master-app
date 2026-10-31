import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSiteAccount } from "./siteAccount";

const stops: Array<() => void> = [];
function fixture() {
  let callback: (event: string, session: { user: { id: string } } | null) => void = () => undefined;
  const unsubscribe = vi.fn();
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "a" } } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "a", is_anonymous: false, email: "a@example.test", email_confirmed_at: "confirmed" } }, error: null }),
    onAuthStateChange: vi.fn().mockImplementation(listener => {
      callback = listener; return { data: { subscription: { unsubscribe } } };
    }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ error: null })
  };
  const account = createSiteAccount({ auth } as unknown as SupabaseClient);
  stops.push(account.stop);
  return {
    auth, account, unsubscribe,
    emit: (event: string, userId: string | null) => callback(event, userId ? { user: { id: userId } } : null),
    identity(id: string, guest = false) {
      auth.getSession.mockResolvedValue({ data: { session: { user: { id } } }, error: null });
      auth.getUser.mockResolvedValue({ data: { user: { id, is_anonymous: guest, email: guest ? undefined : `${id}@example.test`, email_confirmed_at: guest ? undefined : "confirmed" } }, error: null });
    }
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.useRealTimers(); });

describe("site-wide account state", () => {
  it("verifies the stored identity without exposing tokens or creating another user", async () => {
    const { account, auth } = fixture();
    account.start(); await account.refresh();
    expect(account.getSnapshot()).toMatchObject({ status: "verified", userId: "a", email: "a@example.test" });
    expect(Object.keys(account.getSnapshot()).sort()).toEqual(["email", "generation", "status", "userId"]);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("clears the old visible account immediately on a cross-tab change", async () => {
    const f = fixture();
    f.account.start(); await f.account.refresh();
    const generation = f.account.getSnapshot().generation;
    f.identity("b"); f.emit("SIGNED_IN", "b");
    expect(f.account.getSnapshot().userId).toBeNull();
    expect(f.account.isCurrent(generation, "a")).toBe(false);
    await vi.runOnlyPendingTimersAsync();
    expect(f.account.getSnapshot()).toMatchObject({ status: "verified", userId: "b" });
  });

  it("ignores a stale verification response after the account changes", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    const old = deferred<{ data: { user: { id: string; is_anonymous: boolean } }; error: null }>();
    f.auth.getUser.mockReturnValueOnce(old.promise);
    const checkingOld = f.account.refresh();
    await Promise.resolve();
    f.identity("b"); f.emit("SIGNED_IN", "b");
    await vi.runOnlyPendingTimersAsync();
    old.resolve({ data: { user: { id: "a", is_anonymous: true } }, error: null });
    await checkingOld;
    expect(f.account.getSnapshot().userId).toBe("b");
  });

  it("does not run Auth methods from the auth-event callback", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    f.auth.getSession.mockClear(); f.auth.getUser.mockClear();
    f.emit("TOKEN_REFRESHED", "a");
    expect(f.auth.getSession).not.toHaveBeenCalled();
    expect(f.auth.getUser).not.toHaveBeenCalled();
    await vi.runOnlyPendingTimersAsync();
    expect(f.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it("retains the same account scope during token refresh and guest upgrade", async () => {
    const f = fixture(); f.identity("a", true); f.account.start(); await f.account.refresh();
    const generation = f.account.getSnapshot().generation;
    expect(f.account.getSnapshot().status).toBe("guest");
    f.identity("a"); f.emit("USER_UPDATED", "a");
    await vi.runOnlyPendingTimersAsync();
    expect(f.account.getSnapshot()).toMatchObject({ status: "verified", userId: "a", generation });
  });

  it("never replaces an account after temporary or invalid-session errors", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    for (const status of [401, 403, 503]) {
      f.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status } });
      await f.account.refresh();
      expect(f.account.getSnapshot().status).toBe("unavailable");
    }
    expect(f.auth.signOut).not.toHaveBeenCalled();
    expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("distinguishes an unverified permanent account from a guest", async () => {
    const f = fixture();
    f.auth.getUser.mockResolvedValue({ data: { user: { id: "a", is_anonymous: false, email: "a@example.test" } }, error: null });
    f.account.start(); await f.account.refresh();
    expect(f.account.getSnapshot().status).toBe("unverified");
  });

  it("clears the identity on sign-out without automatically making a guest", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    f.emit("SIGNED_OUT", null);
    expect(f.account.getSnapshot()).toMatchObject({ status: "signed_out", userId: null, email: null });
    expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("does not create a guest when session checking fails", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    f.auth.getSession.mockResolvedValue({ data: { session: null }, error: {} });
    await expect(f.account.continueAsGuest()).rejects.toThrow("existing sign-in");
    expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("reuses an existing identity when Continue as guest is requested", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    await f.account.continueAsGuest();
    expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(f.account.getSnapshot().userId).toBe("a");
  });

  it("creates a guest only after a successful signed-out session check", async () => {
    const f = fixture(); f.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    f.account.start(); await f.account.refresh();
    f.auth.signInAnonymously.mockImplementation(async () => { f.identity("guest", true); return { error: null }; });
    await f.account.continueAsGuest();
    expect(f.account.getSnapshot()).toMatchObject({ status: "guest", userId: "guest" });
  });

  it("lets an explicit account recheck supersede a queued SDK-event recheck", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh(); f.auth.getUser.mockClear();
    f.emit("TOKEN_REFRESHED", "a"); await f.account.refresh(); await vi.runOnlyPendingTimersAsync();
    expect(f.auth.getUser).toHaveBeenCalledTimes(1);
  });
  it("serializes simultaneous guest-entry requests", async () => {
    const f = fixture(); f.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    f.account.start(); await f.account.refresh();
    let finish!: () => void;
    f.auth.signInAnonymously.mockImplementationOnce(() => new Promise(resolve => { finish = () => { f.identity("guest", true); resolve({ error: null }); }; }));
    const first = f.account.continueAsGuest(); const second = f.account.continueAsGuest();
    await Promise.resolve(); finish(); await Promise.all([first, second]);
    expect(f.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(f.account.getSnapshot()).toMatchObject({ status: "guest", userId: "guest" });
  });
  it("passes credentials unchanged except trimming the email, and hides raw errors", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    f.auth.signInWithPassword.mockResolvedValue({ error: { message: "private provider details" } });
    await expect(f.account.signIn(" a@example.test ", " test password ")).rejects.toThrow("Sign-in could not");
    expect(f.auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.test", password: " test password " });
    expect(f.account.getSnapshot().userId).toBe("a");
  });

  it("unsubscribes and ignores unfinished reads when stopped", async () => {
    const f = fixture(); f.account.start(); await f.account.refresh();
    const before = f.account.getSnapshot();
    const pending = deferred<unknown>(); f.auth.getUser.mockReturnValueOnce(pending.promise);
    const reading = f.account.refresh(); await Promise.resolve();
    f.account.stop();
    pending.resolve({ data: { user: { id: "other", is_anonymous: true } }, error: null });
    await reading;
    expect(f.account.getSnapshot()).toBe(before);
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
    expect(f.account.isCurrent(before.generation, "a")).toBe(false);
  });
});
