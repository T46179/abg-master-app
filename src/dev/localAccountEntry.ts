import { REGISTRATION_RETURN_URL, takeRegistrationCallback } from "../core/registrationCallback";
import { createGoogleAccount, GoogleLinkConflict, takeGoogleReturn, type GoogleCompletion } from "../core/googleAccount";
import { createRuntimeSupabaseClient } from "../core/supabase";
import { LOCAL_ACCOUNT_URL } from "../app/RegistrationProvider";

export async function mountLocalAccountApp(container: HTMLElement) {
  // Strip credentials before importing App/routes or any telemetry module.
  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const config = { SUPABASE_URL: LOCAL_ACCOUNT_URL, SUPABASE_ANON_KEY: apiKey };
  if (import.meta.env.VITE_SUPABASE_URL !== LOCAL_ACCOUNT_URL ||
      import.meta.env.VITE_EXAM_PILOT_SUPABASE_URL !== LOCAL_ACCOUNT_URL || !apiKey) {
    throw new Error("Local account testing requires the staging project.");
  }
  let tab: Storage | null = null;
  if (window.location.origin === new URL(REGISTRATION_RETURN_URL).origin) {
    try { tab = window.sessionStorage; } catch { /* Google PKCE needs storage across the redirect. */ }
  }
  const googleReturn = tab ? takeGoogleReturn(window.location, tab) : null;
  const emailCallback = takeRegistrationCallback(window.location, window.history);
  const client = createRuntimeSupabaseClient(config, { manualCallback: true }).supabase!;
  const google = tab ? createGoogleAccount(client, LOCAL_ACCOUNT_URL, apiKey, tab,
    import.meta.env.VITE_ENABLE_LOCAL_GOOGLE_CODE_RECOVERY === "true") : null;
  let googleCompletion: GoogleCompletion | null = null;
  if (google && googleReturn) {
    try {
      googleCompletion = { callback: googleReturn, result: { candidate: await google.complete(googleReturn) } };
    } catch (cause) {
      googleCompletion = { callback: googleReturn, result: cause instanceof GoogleLinkConflict
        ? { linkConflict: true }
        : { error: cause instanceof Error ? cause.message : "Google sign-in could not finish. Please retry." } };
    }
  }
  const { mountLocalAccountRoot } = await import("./localAccountRoot");
  mountLocalAccountRoot(container, { client, config, callback: googleReturn ? null : emailCallback, google, googleCompletion });
}
