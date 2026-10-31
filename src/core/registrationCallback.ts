export const REGISTRATION_RETURN_URL = "http://127.0.0.1:5184/dev/exam-pilot";
export const REGISTRATION_DESTINATIONS = ["trial", "exam", "dashboard", "practice", "learn", "insights"] as const;
export type RegistrationDestination = typeof REGISTRATION_DESTINATIONS[number];
export type RegistrationCallback = { kind: "session"; accessToken: string; refreshToken: string; purpose: "verify" | "complete"; destination: RegistrationDestination }
  | { kind: "recovery"; tokenHash: string; purpose: "reset"; destination: RegistrationDestination }
  | { kind: "error"; purpose?: "reset" };
export function registrationDestination(value: unknown): RegistrationDestination {
  return REGISTRATION_DESTINATIONS.includes(value as RegistrationDestination) ? value as RegistrationDestination : "exam";
}
export function registrationReturnUrl(purpose: "verify" | "complete" | "reset", destination: RegistrationDestination) {
  const url = new URL(REGISTRATION_RETURN_URL);
  url.searchParams.set("account_action", purpose);
  url.searchParams.set("return_to", registrationDestination(destination));
  return url.href;
}
export function registrationDestinationPath(destination: RegistrationDestination) {
  return destination === "trial" || destination === "exam" ? "/dev/exam-pilot" : "/" + destination;
}
/** Must run before importing the router, monitoring or analytics. Credentials remain in memory only. */
export function takeRegistrationCallback(location: Pick<Location, "href">, history: Pick<History, "replaceState" | "state">): RegistrationCallback | null {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const secretKeys = ["access_token", "refresh_token", "token", "token_hash", "code", "error", "error_code", "error_description", "expires_in", "expires_at", "token_type", "type", "provider_token", "provider_refresh_token"];
  if (!secretKeys.some(key => fragment.has(key) || url.searchParams.has(key))) return null;
  const purpose = url.searchParams.get("account_action");
  const destination = registrationDestination(url.searchParams.get("return_to"));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  const tokenHash = fragment.get("token_hash") ?? url.searchParams.get("token_hash");
  const type = fragment.get("type") ?? url.searchParams.get("type");
  const validLocation = ["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname.replace(/\/$/, "") === "/dev/exam-pilot";
  const noError = !fragment.has("error") && !url.searchParams.has("error");
  const validSession = validLocation && noError && !!accessToken && !!refreshToken
    && (purpose === "verify" ? type === "email_change" || type === "signup" : purpose === "complete" && (type === "magiclink" || type === "email"));
  // A reset never accepts an already-established login session. Auth must verify its one-time recovery token.
  const validRecovery = validLocation && noError && purpose === "reset" && type === "recovery"
    && !!tokenHash && tokenHash.length <= 2048 && !/\s/.test(tokenHash) && !accessToken && !refreshToken;
  for (const key of secretKeys) { fragment.delete(key); url.searchParams.delete(key); }
  url.hash = fragment.toString();
  url.searchParams.delete("account_action"); url.searchParams.delete("return_to");
  if (purpose === "reset") url.searchParams.set("account", "reset");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  if (validRecovery) return { kind: "recovery", tokenHash, purpose: "reset", destination };
  if (validSession) return { kind: "session", accessToken, refreshToken, purpose: purpose as "verify" | "complete", destination };
  return purpose === "reset" ? { kind: "error", purpose: "reset" } : { kind: "error" };
}
