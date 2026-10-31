import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
import { createRuntimeSupabaseClient, ensureAnonymousSession, type SupabaseRuntime } from "./supabase";

function fixture(anonymous: boolean | undefined = true) {
  const auth = {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: "token", user: { id: "user-1", is_anonymous: anonymous } } }, error: null
    }),
    signInAnonymously: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", is_anonymous: anonymous } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null })
  };
  const runtime: SupabaseRuntime = {
    supabaseEnabled: true, userId: null,
    supabase: { auth } as unknown as SupabaseRuntime["supabase"]
  };
  return { auth, runtime };
}

function failedUser(status?: number) {
  return { data: { user: null }, error: { status, message: "verification failed" } };
}

describe("ensureAnonymousSession", () => {
  beforeEach(() => createClientMock.mockReset());

  it("reuses the same client for the same runtime config", () => {
    const client = { auth: {} };
    createClientMock.mockReturnValue(client);
    const config = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" };
    expect(createRuntimeSupabaseClient(config).supabase).toBe(client);
    expect(createRuntimeSupabaseClient(config).supabase).toBe(client);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("retains an existing identity (anonymous=%s)", async anonymous => {
    const { auth, runtime } = fixture(anonymous);
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: "user-1", syncUnavailable: false });
    expect(runtime.userId).toBe("user-1");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates and verifies a guest when there is no session", async () => {
    const { auth, runtime } = fixture();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: "user-1", syncUnavailable: false });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(auth.getUser).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])("recovers an explicitly anonymous invalid session (%s)", async status => {
    const { auth, runtime } = fixture();
    auth.getUser.mockResolvedValueOnce(failedUser(status));
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: "user-1", syncUnavailable: false });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 429, 500, 503])("preserves a guest during temporary or unknown failure (%s)", async status => {
    const { auth, runtime } = fixture();
    auth.getUser.mockResolvedValue(failedUser(status));
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it.each([401, 403, 503])("never replaces a permanent account after verification failure (%s)", async status => {
    const { auth, runtime } = fixture(false);
    auth.getUser.mockResolvedValue(failedUser(status));
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("does not replace a session whose anonymous status is unknown", async () => {
    const { auth, runtime } = fixture();
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "user-1" } } }, error: null });
    auth.getUser.mockResolvedValue(failedUser(401));
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("does not treat an unsuccessful session read as signed out", async () => {
    const { auth, runtime } = fixture();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { status: 503 } });
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("does not replace an identity on an empty verification response", async () => {
    const { auth, runtime } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("preserves the session if verification throws", async () => {
    const { auth, runtime } = fixture(false);
    auth.getUser.mockRejectedValue(new TypeError("fetch failed"));
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("does not create a replacement if local sign-out fails", async () => {
    const { auth, runtime } = fixture();
    auth.getUser.mockResolvedValue(failedUser(401));
    auth.signOut.mockResolvedValue({ error: { message: "storage unavailable" } });
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("reports unavailable if guest creation fails", async () => {
    const { auth, runtime } = fixture();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.signInAnonymously.mockResolvedValue({ error: { message: "unavailable" } });
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("does not loop if the replacement guest cannot be verified", async () => {
    const { auth, runtime } = fixture();
    auth.getUser.mockResolvedValue(failedUser(401));
    expect(await ensureAnonymousSession(runtime)).toEqual({ userId: null, syncUnavailable: true });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
