import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAccountDataClient } from "./accountDataClient";
import { invokeProtectedFunction } from "./protectedPractice";

const config = { SUPABASE_URL: "https://staging.supabase.co", SUPABASE_ANON_KEY: "public-key" };
function fixture(onAuthUnavailable?: () => void) {
  let current = true;
  const canonical = { auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "a" }, access_token: "token-a" } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "a" } }, error: null })
  } };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "allowed" }), { headers: { "Content-Type": "application/json" } }));
  const data = createAccountDataClient(config, canonical as unknown as SupabaseClient, "a", () => current, fetcher, onAuthUnavailable);
  return { data, canonical, fetcher, retire() { current = false; } };
}

describe("account-bound requests", () => {
  it("uses the captured account for functions, database reads and RPCs", async () => {
    const f = fixture();
    await f.data.functions.invoke("exam-access", { body: {} });
    await f.data.from("user_progress").select("xp").eq("user_id", "a");
    await f.data.rpc("complete_calibration", {});
    expect(f.fetcher).toHaveBeenCalledTimes(3);
    for (const [, init] of f.fetcher.mock.calls as unknown as [unknown, RequestInit][]) {
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-a");
    }
  });
  it("cannot reuse a retired client to read, submit or reset under another login", async () => {
    const f = fixture(); f.retire();
    f.canonical.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "b" }, access_token: "token-b" } }, error: null });
    await expect(f.data.auth.getSession()).rejects.toThrow("no longer active");
    const result = await f.data.functions.invoke("exam-runtime", { body: { operation: "submit" } });
    expect(result.error).toBeTruthy();
    expect((await f.data.rpc("reset_progress", {})).error).toBeTruthy();
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.canonical.auth.getSession).not.toHaveBeenCalled();
  });
  it("rejects a session that changed while its token was being read", async () => {
    const f = fixture();
    let finish!: (value: unknown) => void;
    f.canonical.auth.getSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const reading = f.data.auth.getSession();
    f.retire(); finish({ data: { session: { user: { id: "b" }, access_token: "token-b" } }, error: null });
    await expect(reading).rejects.toThrow("no longer active");
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("checks the actual session owner even before the auth event arrives", async () => {
    const f = fixture();
    f.canonical.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "b" }, access_token: "token-b" } }, error: null });
    await expect(f.data.auth.getSession()).rejects.toThrow("could not be checked");
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("requests an account recheck after the current session is rejected", async () => {
    const recheck = vi.fn(); const f = fixture(recheck);
    f.fetcher.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await f.data.functions.invoke("exam-access", { body: {} });
    expect(recheck).toHaveBeenCalledTimes(1);
  });
  it("discards a response that finishes after the account retires", async () => {
    const recheck = vi.fn(); const f = fixture(recheck);
    let finish!: (value: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const request = f.data.functions.invoke("exam-runtime", { body: {} });
    await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalledTimes(1));
    f.retire(); finish(new Response('{}', { status: 401 }));
    expect((await request).error).toBeTruthy();
    expect(recheck).not.toHaveBeenCalled();
  });
  it("keeps protected Practice's direct requests bound to the same account", async () => {
    const f = fixture();
    const directFetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal("fetch", directFetch);
    try {
      await invokeProtectedFunction(config, f.data, "submit-practice-result", {});
      expect(new Headers(directFetch.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer token-a");
      f.retire();
      await expect(invokeProtectedFunction(config, f.data, "submit-practice-result", {})).rejects.toThrow();
      expect(directFetch).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
