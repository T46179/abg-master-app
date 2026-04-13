import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", async () => {
  const actual = await vi.importActual("@supabase/supabase-js");
  return {
    ...actual,
    createClient: (...args: unknown[]) => createClientMock(...args)
  };
});

import { createRuntimeSupabaseClient, ensureAnonymousSession, type SupabaseRuntime } from "./supabase";

function createRuntime(overrides?: {
  getSession?: () => Promise<{ data: { session: { access_token: string } | null } }>;
  signInAnonymously?: () => Promise<{ error: unknown }>;
  getUser?: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  signOut?: () => Promise<unknown>;
}): SupabaseRuntime {
  return {
    supabaseEnabled: true,
    userId: null,
    supabase: {
      auth: {
        getSession: overrides?.getSession ?? vi.fn(async () => ({ data: { session: { access_token: "token" } } })),
        signInAnonymously: overrides?.signInAnonymously ?? vi.fn(async () => ({ error: null })),
        getUser: overrides?.getUser ?? vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
        signOut: overrides?.signOut ?? vi.fn(async () => undefined)
      }
    } as unknown as SupabaseRuntime["supabase"]
  };
}

describe("ensureAnonymousSession", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("reuses the same Supabase client for the same runtime config", () => {
    const client = { auth: {} };
    createClientMock.mockReturnValue(client);

    const runtimeA = createRuntimeSupabaseClient({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      ENABLE_PROTECTED_CASE_DELIVERY: true
    });
    const runtimeB = createRuntimeSupabaseClient({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      ENABLE_PROTECTED_CASE_DELIVERY: true
    });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(runtimeA.supabase).toBe(client);
    expect(runtimeB.supabase).toBe(client);
  });

  it("reuses a valid existing session", async () => {
    const runtime = createRuntime();

    const result = await ensureAnonymousSession(runtime);

    expect(result).toEqual({ userId: "user-1", syncUnavailable: false });
    expect(runtime.userId).toBe("user-1");
  });

  it("recovers from a stale stored session by signing out and re-authenticating", async () => {
    const signInAnonymously = vi.fn(async () => ({ error: null }));
    const signOut = vi.fn(async () => undefined);
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid token") })
      .mockResolvedValueOnce({ data: { user: { id: "user-2" } }, error: null });

    const runtime = createRuntime({
      signInAnonymously,
      signOut,
      getUser
    });

    const result = await ensureAnonymousSession(runtime);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ userId: "user-2", syncUnavailable: false });
  });

  it("marks sync unavailable when re-authentication cannot recover the session", async () => {
    const signInAnonymously = vi.fn(async () => ({ error: new Error("boom") }));
    const signOut = vi.fn(async () => undefined);
    const getUser = vi.fn(async () => ({ data: { user: null }, error: new Error("invalid token") }));

    const runtime = createRuntime({
      signInAnonymously,
      signOut,
      getUser
    });

    const result = await ensureAnonymousSession(runtime);

    expect(result).toEqual({ userId: null, syncUnavailable: true });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
