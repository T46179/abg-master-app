import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertProbeEnvironment, createProbeGuest, readProbeProof, readProbeProgress, registerProbeGuest, verificationRequest, createProbeRecovery, STAGING_URL } from "./accountStagingProbe";

function fixture() {
  const row = { user_id: "guest-1", xp: 0, calibration_completed: true };
  const result = { data: [row], error: null };
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
  };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "guest-1", is_anonymous: true } }, error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: { id: "guest-1" } }, error: null }),
    signUp: vi.fn(), signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: "guest-1" } }, error: null })
  };
  const from = vi.fn().mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
  const client = { auth, from, rpc } as unknown as SupabaseClient;
  return { client, auth, from, rpc, query, result };
}

describe("isolated staging account proof", () => {
  it("requires a local development page and the exact staging project", () => {
    expect(() => assertProbeEnvironment(true, "127.0.0.1", STAGING_URL, "sb_publishable_test")).not.toThrow();
    for (const args of [
      [false, "127.0.0.1", STAGING_URL, "sb_publishable_test"],
      [true, "www.abgmaster.com", STAGING_URL, "sb_publishable_test"],
      [true, "localhost.evil.test", STAGING_URL, "sb_publishable_test"],
      [true, "localhost", "https://production.supabase.co", "sb_publishable_test"],
      [true, "localhost", STAGING_URL, "sb_secret_test"],
      [true, "localhost", STAGING_URL, ""]
    ] as const) expect(() => assertProbeEnvironment(args[0], args[1], args[2], args[3])).toThrow();
  });

  it("rejects a service-role JWT and accepts the existing public key format", () => {
    const token = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`;
    expect(() => assertProbeEnvironment(true, "localhost", STAGING_URL, token("anon"))).not.toThrow();
    expect(() => assertProbeEnvironment(true, "localhost", STAGING_URL, token("service_role"))).toThrow();
  });

  it("does not create a guest over an existing test session", async () => {
    const { client, auth, rpc } = fixture();
    await expect(createProbeGuest(client)).rejects.toThrow("Sign out");
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates a guest with genuine saved, labelled calibration progress", async () => {
    const { client, auth, rpc, query } = fixture();
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const baseline = await createProbeGuest(client);
    expect(baseline.userId).toBe("guest-1");
    expect(JSON.parse(baseline.progress)).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("complete_calibration", expect.objectContaining({
      p_progression_version: "v2", p_beta_release_number: 2,
      p_attempt_payload: expect.objectContaining({ purpose: "account_registration_staging_probe" }),
      p_progression_config: {}
    }));
    expect(query.eq).toHaveBeenCalledWith("user_id", "guest-1");
  });

  it("stops if fixture persistence fails", async () => {
    const { client, auth, rpc } = fixture();
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    rpc.mockResolvedValue({ data: null, error: {} });
    await expect(createProbeGuest(client)).rejects.toThrow("progress could not be saved");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("sends email and password together, without creating a replacement account", async () => {
    const { client, auth } = fixture();
    await registerProbeGuest(client, { userId: "guest-1", progress: "[]" }, " test@example.test ", " test password ");
    expect(auth.updateUser).toHaveBeenCalledWith({ email: "test@example.test", password: " test password " });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it.each(["different-user", "guest-1"])("does not upgrade a different or permanent identity (%s)", async id => {
    const { client, auth } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: { id, is_anonymous: id !== "guest-1" } }, error: null });
    await expect(registerProbeGuest(client, { userId: "guest-1", progress: "[]" }, "test@example.test", "test password")).rejects.toThrow("original test guest");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("does not erase the session or expose provider diagnostics on failure", async () => {
    const { client, auth } = fixture();
    auth.updateUser.mockResolvedValue({ error: { code: "unexpected", message: "private provider detail" } });
    await expect(registerProbeGuest(client, { userId: "guest-1", progress: "[]" }, "test@example.test", "test password")).rejects.toThrow("no automatic retry");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it("will not start registration if user verification is unavailable", async () => {
    const { client, auth } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(registerProbeGuest(client, { userId: "guest-1", progress: "[]" }, "test@example.test", "test password")).rejects.toThrow("could not finish");
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("proves both identity and saved progress after verification", async () => {
    const { client, auth, result } = fixture();
    const baseline = { userId: "guest-1", progress: await readProbeProgress(client, "guest-1") };
    auth.getUser.mockResolvedValue({ data: { user: { id: "guest-1", is_anonymous: false, email_confirmed_at: "confirmed" } }, error: null });
    expect(await readProbeProof(client, baseline)).toEqual({ signedIn: true, verified: true, sameIdentity: true, progressPreserved: true });
    result.data[0].xp = 1;
    expect((await readProbeProof(client, baseline)).progressPreserved).toBe(false);
  });

  it("does not read or compare a different account's progress", async () => {
    const { client, auth, from } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: { id: "different", is_anonymous: false, email_confirmed_at: "confirmed" } }, error: null });
    expect(await readProbeProof(client, { userId: "guest-1", progress: "[]" })).toEqual({ signedIn: true, verified: true, sameIdentity: false, progressPreserved: false });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("verification stays inside the isolated staging page", () => {
  it("extracts only the expected staging email-change token without following redirects", () => {
    const token = "a".repeat(64);
    expect(verificationRequest(`${STAGING_URL}/auth/v1/verify?token=${token}&type=email_change&redirect_to=https://other.test`, ""))
      .toEqual({ token_hash: token, type: "email_change" });
    expect(verificationRequest("123456", " test@example.test "))
      .toEqual({ token: "123456", email: "test@example.test", type: "email_change" });
  });
  it.each([
    "https://production.supabase.co/auth/v1/verify?token=aaaaaaaaaaaaaaaaaaaa&type=email_change",
    `${STAGING_URL}/auth/v1/verify?token=aaaaaaaaaaaaaaaaaaaa&type=recovery`,
    `${STAGING_URL}/auth/v1/verify?type=email_change`,
    "https://example.test/"
  ])("rejects unrelated links without navigating: %s", value => {
    expect(() => verificationRequest(value, "test@example.test")).toThrow();
  });
});

describe("separate recovery proof", () => {
  it("only requests mail when the user asks, without changing the password", async () => {
    const { client, auth } = fixture();
    const recovery = createProbeRecovery(client, { userId: "guest-1", progress: "[]" });
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    await recovery.request(" test@example.test ");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("test@example.test");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("requires explicit recovery verification before any password change", async () => {
    const { client, auth } = fixture();
    const recovery = createProbeRecovery(client, { userId: "guest-1", progress: "[]" });
    await expect(recovery.setPassword("test password")).rejects.toThrow("Verify the recovery link");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects a registration link in the recovery form", async () => {
    const { client, auth } = fixture();
    const recovery = createProbeRecovery(client, { userId: "guest-1", progress: "[]" });
    await expect(recovery.verify(`${STAGING_URL}/auth/v1/verify?token=${"a".repeat(64)}&type=email_change`, "test@example.test")).rejects.toThrow("expected staging");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("does not change a different account's password", async () => {
    const { client, auth } = fixture();
    auth.verifyOtp.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
    const recovery = createProbeRecovery(client, { userId: "guest-1", progress: "[]" });
    await expect(recovery.verify("123456", "test@example.test")).rejects.toThrow("different account");
    await expect(recovery.setPassword("test password")).rejects.toThrow("Verify the recovery link");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("allows one password update on the original verified recovery account", async () => {
    const { client, auth } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: { id: "guest-1", is_anonymous: false, email_confirmed_at: "confirmed" } }, error: null });
    const recovery = createProbeRecovery(client, { userId: "guest-1", progress: "[]" });
    await recovery.verify("123456", "test@example.test");
    await recovery.setPassword("new test password");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new test password" });
    await expect(recovery.setPassword("another password")).rejects.toThrow("Verify the recovery link");
  });
  it("does not carry recovery permission across account changes", async () => {
    const { client, auth } = fixture();
    const recovery = createProbeRecovery(client, { userId: "guest-1", progress: "[]" });
    await recovery.verify("123456", "test@example.test");
    auth.getUser.mockResolvedValue({ data: { user: { id: "other", is_anonymous: false, email_confirmed_at: "confirmed" } }, error: null });
    await expect(recovery.setPassword("new test password")).rejects.toThrow("original test account");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
