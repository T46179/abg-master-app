import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const createClientMock = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
import { createExamAuthClient, readExamIdentity, requestExamCode, verifyExamCode, readExamAccess } from "./examAuth";

function fixture() {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner", is_anonymous: false, email_confirmed_at: "confirmed" } }, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    signInAnonymously: vi.fn(), signOut: vi.fn(),
  };
  const functions = { invoke: vi.fn().mockResolvedValue({ data: { status: "allowed", allowedUnitCounts: [3] }, error: null }) };
  return { auth, functions, client: { auth, functions } as unknown as SupabaseClient };
}

describe("Exam permanent authentication", () => {
  beforeEach(() => createClientMock.mockReset());
  it("uses isolated, environment-specific storage and caches its client", () => {
    createClientMock.mockReturnValue({});
    const a = createExamAuthClient("https://staging.example.test", "public");
    expect(createExamAuthClient("https://staging.example.test", "public")).toBe(a);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock.mock.calls[0][2].auth).toEqual({ storageKey: "abgm-exam-auth-staging.example.test", detectSessionInUrl: false });
    createExamAuthClient("https://production.example.test", "public");
    expect(createClientMock.mock.calls[1][2].auth.storageKey).not.toBe(createClientMock.mock.calls[0][2].auth.storageKey);
  });
  it("requires a server-verified permanent account", async () => {
    const { client, auth } = fixture();
    expect(await readExamIdentity(client)).toEqual({ status: "signed_in", userId: "owner" });
    auth.getUser.mockResolvedValue({ data: { user: { id: "owner", is_anonymous: true } }, error: null });
    expect(await readExamIdentity(client)).toEqual({ status: "signed_out" });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("does not create a session when signed out", async () => {
    const { client, auth } = fixture();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await readExamIdentity(client)).toEqual({ status: "signed_out" });
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("preserves the session during verification failure", async () => {
    const { client, auth } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(readExamIdentity(client)).rejects.toThrow("couldn’t check");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("treats an expired or revoked session as signed out", async () => {
    const { client, auth } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect(await readExamIdentity(client)).toEqual({ status: "signed_out" });
  });
  it("requests codes only for pre-provisioned accounts", async () => {
    const { client, auth } = fixture();
    await requestExamCode(client, " tester@example.test ");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: "tester@example.test", options: { shouldCreateUser: false } });
    await verifyExamCode(client, "tester@example.test", " 012345 ");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "tester@example.test", token: "012345", type: "email" });
  });
  it("does not expose raw provider diagnostics", async () => {
    const { client, auth } = fixture();
    auth.signInWithOtp.mockResolvedValue({ error: { message: "private provider detail" } });
    await expect(requestExamCode(client, "tester@example.test")).rejects.toThrow("couldn’t send");
    auth.verifyOtp.mockResolvedValue({ error: { message: "private provider detail" } });
    await expect(verifyExamCode(client, "tester@example.test", "123456")).rejects.toThrow("couldn’t be verified");
  });
  it("gets authorization from the endpoint without supplying an account ID", async () => {
    const { client, functions } = fixture();
    expect(await readExamAccess(client)).toEqual({ status: "allowed", allowedUnitCounts: [3] });
    expect(functions.invoke).toHaveBeenCalledWith("exam-access", { body: {} });
  });
  it("validates category support and retains catalogue labels", async () => {
    const { client, functions } = fixture();
    const categories = [{ category_id: "mechanical_ventilation", label: "Mechanical ventilation" }];
    functions.invoke.mockResolvedValue({ data: { status: "allowed", allowedUnitCounts: [3], customisationCategories: categories }, error: null });
    expect((await readExamAccess(client)).customisationCategories).toEqual(categories);
    for (const registry of [null, [null], [...categories, ...categories], [{ category_id: "bad id", label: "Bad" }], [{ category_id: "ok", label: "" }]]) {
      functions.invoke.mockResolvedValue({ data: { status: "allowed", allowedUnitCounts: [3], customisationCategories: registry }, error: null });
      await expect(readExamAccess(client)).rejects.toThrow("could not be checked");
    }
  });
  it.each([null, { status: "allowed", allowedUnitCounts: [] }, { status: "allowed", allowedUnitCounts: [6] }, { status: "not_invited", allowedUnitCounts: [3] }])("fails closed for invalid access payload %j", async data => {
    const { client, functions } = fixture();
    functions.invoke.mockResolvedValue({ data, error: null });
    await expect(readExamAccess(client)).rejects.toThrow("could not be checked");
  });
});
