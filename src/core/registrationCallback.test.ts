import { describe, expect, it, vi } from "vitest";
import { registrationReturnUrl, takeRegistrationCallback } from "./registrationCallback";
describe("registration callback intake", () => {
  it("removes credentials before returning the in-memory session", () => {
    const history = { state: { safe: true }, replaceState: vi.fn() };
    const result = takeRegistrationCallback({ href: registrationReturnUrl("verify", "trial") + "#access_token=test-access&refresh_token=test-refresh&type=email_change&expires_in=3600" }, history);
    expect(result).toMatchObject({ kind: "session", purpose: "verify", destination: "trial" });
    expect(history.replaceState).toHaveBeenCalledWith({ safe: true }, "", "/dev/exam-pilot");
    expect(JSON.stringify(history.replaceState.mock.calls)).not.toContain("test-access");
  });
  it.each(["recovery", "invite", "unknown"])("rejects and scrubs unrelated %s sessions", type => {
    const history = { state: null, replaceState: vi.fn() };
    expect(takeRegistrationCallback({ href: registrationReturnUrl("complete", "exam") + "#access_token=a&refresh_token=b&type=" + type }, history)).toEqual({ kind: "error" });
    expect(history.replaceState.mock.calls[0][2]).toBe("/dev/exam-pilot");
  });
  it("scrubs provider errors without returning their sensitive description", () => {
    const history = { state: null, replaceState: vi.fn() };
    expect(takeRegistrationCallback({ href: registrationReturnUrl("verify", "exam") + "&error=denied&error_description=private-detail" }, history)).toEqual({ kind: "error" });
    expect(history.replaceState.mock.calls[0][2]).not.toContain("private-detail");
  });
  it("does not alter normal navigation and defaults invalid destinations", () => {
    const history = { state: null, replaceState: vi.fn() };
    expect(takeRegistrationCallback({ href: "http://127.0.0.1:5184/dev/exam-pilot?account=signup" }, history)).toBeNull();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(registrationReturnUrl("verify", "https://outside.test" as any)).toContain("return_to=exam");
  });
});

describe("password-reset callback intake", () => {
  it("accepts only an explicit recovery purpose and scrubs all credentials", () => {
    const history = { state: null, replaceState: vi.fn() };
    expect(takeRegistrationCallback({ href: registrationReturnUrl("reset", "practice") + "#token_hash=test-reset-hash&type=recovery" }, history))
      .toMatchObject({ kind: "recovery", tokenHash: "test-reset-hash", purpose: "reset", destination: "practice" });
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/dev/exam-pilot?account=reset");
    expect(JSON.stringify(history.replaceState.mock.calls)).not.toContain("test-reset-hash");
  });
  it("routes expired reset emails to a reset retry without exposing provider details", () => {
    const history = { state: null, replaceState: vi.fn() };
    expect(takeRegistrationCallback({ href: registrationReturnUrl("reset", "exam") + "#error=access_denied&error_description=private-detail&type=recovery" }, history))
      .toEqual({ kind: "error", purpose: "reset" });
    expect(JSON.stringify(history.replaceState.mock.calls)).not.toContain("private-detail");
  });
  it("rejects registration or ordinary sign-in sessions presented as recovery", () => {
    const history = { state: null, replaceState: vi.fn() };
    expect(takeRegistrationCallback({ href: registrationReturnUrl("reset", "exam") + "#access_token=a&refresh_token=b&type=magiclink" }, history))
      .toEqual({ kind: "error", purpose: "reset" });
  });
});

describe("reset grants cannot be replaced by access-token callbacks", () => {
  it("rejects an existing login session even when its URL type is relabelled recovery", () => {
    const history = { state: null, replaceState: vi.fn() };
    expect(takeRegistrationCallback({ href: registrationReturnUrl("reset", "exam") + "#access_token=ordinary-otp&refresh_token=r&type=recovery" }, history))
      .toEqual({ kind: "error", purpose: "reset" });
    expect(JSON.stringify(history.replaceState.mock.calls)).not.toContain("ordinary-otp");
  });
});
