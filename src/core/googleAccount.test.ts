import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleAccount, hasGoogleSignIn, takeGoogleReturn } from "./googleAccount";
import { REGISTRATION_RETURN_URL, takeRegistrationCallback } from "./registrationCallback";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const url = "https://clpfecuohwzwrgmqzeos.supabase.co";
const guest = { id: "guest", is_anonymous: true } as User;
const googleUser = { id: "learner", is_anonymous: false, email: "learner@example.com",
  email_confirmed_at: "verified", identities: [{ provider: "google" }] } as User;

function session(user: User, id: string): Session {
  return { user, access_token: "a." + btoa(JSON.stringify({ session_id: id })) + ".z",
    refresh_token: id, token_type: "bearer", expires_in: 3600 };
}

function fixture(existing = session(guest, "guest-session"), candidate = session(googleUser, "temporary")) {
  const tab = new Map<string, string>();
  const storage = {
    getItem: (key: string) => tab.get(key) ?? null,
    setItem: (key: string, value: string) => { tab.set(key, value); },
    removeItem: (key: string) => { tab.delete(key); },
  } as Storage;
  const serverSessions = new Set([existing.refresh_token, candidate.refresh_token, "other-device"]);
  const readback = { session: existing };
  const active = {
    getSession: vi.fn(async () => ({ data: { session: readback.session } })),
    getUser: vi.fn(async () => ({ data: { user: readback.session.user } })),
    signOut: vi.fn(),
    setSession: vi.fn(async () => { readback.session = candidate; return { data: { session: candidate } }; }),
  };
  const temporary = {
    getSession: vi.fn(async () => ({ data: { session: candidate } })),
    getUser: vi.fn(async () => ({ data: { user: candidate.user } })),
    signInWithOAuth: vi.fn(async () => ({ data: { url: "https://accounts.google.com/" } })),
    linkIdentity: vi.fn(async () => ({ data: { url: "https://accounts.google.com/" } })),
    exchangeCodeForSession: vi.fn(async () => ({ data: { session: candidate } })),
    stopAutoRefresh: vi.fn(async () => {}),
    signOut: vi.fn(async ({ scope }: { scope: string }) => {
      if (scope === "local") serverSessions.delete(candidate.refresh_token);
      else serverSessions.clear();
    }),
  };
  createClient.mockReturnValue({ auth: temporary });
  const google = createGoogleAccount({ auth: active } as unknown as SupabaseClient, url, "public-key", storage);

  async function receive(action: "link" | "signup" | "signin", query = "code=single-use") {
    await google.begin(action, "trial");
    return takeGoogleReturn({ href: REGISTRATION_RETURN_URL + "?" + query }, storage)!;
  }
  return { google, active, temporary, receive, readback, serverSessions, tab, existing };
}

describe("Google account flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks verified Google identities instead of trusting provider metadata", () => {
    expect(hasGoogleSignIn(googleUser)).toBe(true);
    expect(hasGoogleSignIn({ ...googleUser, identities: [], app_metadata: { provider: "google" } })).toBe(false);
    expect(hasGoogleSignIn({ ...googleUser, email_confirmed_at: undefined })).toBe(false);
    expect(hasGoogleSignIn(guest)).toBe(false);
  });

  it("keeps Google tokens in memory and strips the callback before routing", async () => {
    const f = fixture();
    const callback = await f.receive("signin");
    const auth = createClient.mock.calls[0][2].auth;
    expect(auth.flowType).toBe("pkce");
    expect(auth.detectSessionInUrl).toBe(false);
    auth.storage.setItem(auth.storageKey, "session-token");
    auth.storage.setItem(auth.storageKey + "-code-verifier", "pkce-verifier");
    expect([...f.tab.values()]).not.toContain("session-token");
    expect([...f.tab.values()]).toContain("pkce-verifier");
    const replaceState = vi.fn();
    takeRegistrationCallback({ href: REGISTRATION_RETURN_URL + "?code=single-use" }, { state: null, replaceState });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/dev/exam-pilot");
    expect(callback.attempt.destination).toBe("trial");
  });

  it("cancels a switch using session-local sign-out and keeps the other device able to refresh", async () => {
    const f = fixture();
    const result = await f.google.complete(await f.receive("signin"));
    expect(result.requiresConfirmation).toBe(true);
    expect(f.active.setSession).not.toHaveBeenCalled();
    await result.cancel();
    expect(f.temporary.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(f.active.signOut).not.toHaveBeenCalled();
    expect(f.serverSessions.has("temporary")).toBe(false);
    expect(f.serverSessions.has("other-device")).toBe(true);
    expect(f.readback.session).toBe(f.existing);
    expect(f.tab.size).toBe(0);
  });

  it("confirms a switch and clears temporary credentials without revoking the adopted session", async () => {
    const f = fixture();
    const result = await f.google.complete(await f.receive("signup"));
    expect(result.requiresConfirmation).toBe(true);
    expect(result.email).toBe(googleUser.email);
    expect(await result.adopt()).toBe(googleUser.id);
    await result.cancel();
    expect(f.temporary.signOut).not.toHaveBeenCalled();
    expect(f.serverSessions.has("temporary")).toBe(true);
    expect(f.tab.size).toBe(0);
  });

  it("keeps the active session when Google resolves to the same existing account", async () => {
    const f = fixture(session(googleUser, "existing"));
    const result = await f.google.complete(await f.receive("signin"));
    expect(result.requiresConfirmation).toBe(false);
    expect(await result.adopt()).toBe(googleUser.id);
    expect(f.active.setSession).not.toHaveBeenCalled();
    expect(f.temporary.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(f.serverSessions.has("existing")).toBe(true);
  });

  it("preserves an adopted session even when adoption reports an uncertain result", async () => {
    const f = fixture();
    const successfulAdoption = f.active.setSession.getMockImplementation()!;
    f.active.setSession.mockImplementation(async () => {
      await successfulAdoption();
      throw new Error("Connection lost");
    });
    const result = await f.google.complete(await f.receive("signin"));
    await expect(result.adopt()).rejects.toThrow("Connection lost");
    expect(f.temporary.signOut).not.toHaveBeenCalled();
    expect(f.tab.size).toBe(0);
  });

  it("links a guest in place and rejects a link that resolves to a different owner", async () => {
    const sameOwner = fixture(session(guest, "guest-session"), session({ ...googleUser, id: guest.id }, "linked"));
    const linked = await sameOwner.google.complete(await sameOwner.receive("link"));
    expect(sameOwner.temporary.linkIdentity).toHaveBeenCalledOnce();
    expect(linked.requiresConfirmation).toBe(false);
    expect(await linked.adopt()).toBe(guest.id);
    expect(sameOwner.temporary.signOut).not.toHaveBeenCalled();

    const mismatch = fixture();
    await expect(mismatch.google.complete(await mismatch.receive("link"))).rejects.toThrow("could not be verified");
    expect(mismatch.active.setSession).not.toHaveBeenCalled();
    expect(mismatch.temporary.signOut).not.toHaveBeenCalled();
  });

  it("preserves the guest on an identity conflict or a cancelled OAuth return", async () => {
    for (const query of ["error=server_error&error_code=identity_already_exists", "error=access_denied"]) {
      const f = fixture();
      await expect(f.google.complete(await f.receive("link", query))).rejects.toThrow();
      expect(f.active.setSession).not.toHaveBeenCalled();
      expect(f.temporary.exchangeCodeForSession).not.toHaveBeenCalled();
      expect(f.temporary.signOut).not.toHaveBeenCalled();
      expect(f.tab.size).toBe(0);
    }
  });

  it("rejects adoption after another tab changes the active session", async () => {
    const f = fixture();
    const result = await f.google.complete(await f.receive("signin"));
    f.readback.session = session(guest, "replacement");
    await expect(result.adopt()).rejects.toThrow("active account changed");
    expect(f.active.setSession).not.toHaveBeenCalled();
    expect(f.temporary.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });
});
