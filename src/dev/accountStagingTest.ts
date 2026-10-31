import { createClient } from "@supabase/supabase-js";
import { assertProbeEnvironment, createProbeGuest, readProbeProof, registerProbeGuest, verifyProbeEmail, createProbeRecovery, PROBE_STORAGE_KEY, type ProbeBaseline } from "./accountStagingProbe";

const root = document.querySelector<HTMLElement>("#account-test")!;
try {
  const url = import.meta.env.VITE_EXAM_PILOT_SUPABASE_URL ?? "";
  const key = import.meta.env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY ?? "";
  assertProbeEnvironment(import.meta.env.DEV, location.hostname, url, key);
  // This standalone page imports no app bootstrap, analytics, replay or monitoring.
  const client = createClient(url, key, { auth: {
    storageKey: "abgm-account-staging-test-clpfecuohwzwrgmqzeos", detectSessionInUrl: false
  } });
  const style = document.createElement("style");
  style.textContent = "body{font:17px system-ui;background:#f4f6f7;color:#152d38;margin:0}main{max-width:680px;margin:36px auto;padding:24px;background:white;border-radius:12px}section{border-top:1px solid #ddd;margin-top:24px;padding-top:16px}label{display:block;margin-top:12px}input,button{font:inherit;padding:10px;margin:6px 6px 6px 0;max-width:95%}input{display:block;width:340px}button{cursor:pointer}button:disabled{cursor:wait}#message{white-space:pre-wrap;background:#eef3f5;padding:16px}small{display:block;color:#50616a}";
  document.head.append(style);
  root.innerHTML = `<h1>Staging account test</h1>
    <p>Temporary forms for testing account behaviour. Your usual Practice and Exam sign-ins are separate.</p>
    <p id="message" role="status" aria-live="polite">Ready. Start with step 1.</p>
    <section><h2>1. Create a test guest</h2><p>This saves a small Beginner calibration record with zero XP so we can check that real progress survives registration.</p><button id="guest">Create test guest</button></section>
    <section><h2>2. Register that guest</h2><form id="register"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Test password<input name="password" type="password" autocomplete="new-password" required></label><button>Send verification email</button></form><small>Use the agreed Hotmail address and a new test password. The password is sent directly to staging and cleared from this form; it is never saved by this page.</small></section>
    <section><h2>3. Verify your email</h2><p>Open the email, copy its verification link (without following it), and paste it below. If it contains a verification code instead, paste that code. This keeps verification inside this temporary test.</p><form id="verify"><label>Verification link or code<input name="verification" type="password" autocomplete="off" required></label><button>Verify email and check progress</button></form><button id="check">Check verification and saved progress</button></section>
    <section><h2>4. Sign out, then sign back in</h2><button id="signout">Sign out of this test</button><form id="signin"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Test password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in and check progress</button></form></section>
    <section><h2>5. Recover this test account</h2><p>This is a separate recovery test. It keeps the same account and progress; it does not prove that the original registration password worked.</p>
    <form id="recover-request"><label>Account email<input name="email" type="email" autocomplete="email" required></label><button>Request recovery email</button></form>
    <form id="recover-verify"><label>Recovery link or code<input name="verification" type="password" autocomplete="off" required></label><button>Verify recovery link</button></form>
    <form id="recover-password"><label>New test password<input name="password" type="password" autocomplete="new-password" required></label><label>Repeat new test password<input name="confirmation" type="password" autocomplete="new-password" required></label><button>Save new test password</button></form></section>`;
  const message = root.querySelector<HTMLElement>("#message")!;
  let busy = false;
  function baseline(): ProbeBaseline {
    const data = JSON.parse(localStorage.getItem(PROBE_STORAGE_KEY) ?? "null");
    if (!data || typeof data.userId !== "string" || typeof data.progress !== "string") throw new Error("Create a test guest first.");
    return data;
  }
  async function run(action: () => Promise<string>) {
    if (busy) return;
    busy = true;
    root.querySelectorAll<HTMLButtonElement>("button").forEach(button => { button.disabled = true; });
    message.textContent = "Checking staging...";
    try { message.textContent = await action(); }
    catch (error) { message.textContent = error instanceof Error ? error.message : "The test could not finish. Stop here and tell Codex."; }
    finally {
      busy = false;
      root.querySelectorAll<HTMLButtonElement>("button").forEach(button => { button.disabled = false; });
    }
  }
  async function proof() {
    const result = await readProbeProof(client, baseline());
    if (!result.signedIn) return "Signed out of this test. Sign in using the email and password from step 2.";
    return `Server marks email confirmed: ${result.verified ? "yes" : "not yet"}\nSame account identity: ${result.sameIdentity ? "yes" : "NO"}\nSaved progress unchanged: ${result.progressPreserved ? "yes" : "NO"}`;
  }
  root.querySelector("#guest")!.addEventListener("click", () => { void run(async () => {
    const data = await createProbeGuest(client);
    localStorage.setItem(PROBE_STORAGE_KEY, JSON.stringify(data));
    return "Test guest and saved progress are ready. Continue to step 2.";
  }); });
  root.querySelector<HTMLFormElement>("#register")!.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const field = form.elements.namedItem("password") as HTMLInputElement;
    const password = field.value; field.value = "";
    void run(async () => {
      await registerProbeGuest(client, baseline(), email.value, password);
      return "Staging accepted email and password together. Check your inbox (and spam), copy its verification link or code, then use step 3. Do not paste the link or code into chat.";
    });
  });
  root.querySelector<HTMLFormElement>("#verify")!.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const field = form.elements.namedItem("verification") as HTMLInputElement;
    const value = field.value; field.value = "";
    const email = (root.querySelector<HTMLFormElement>("#register")!.elements.namedItem("email") as HTMLInputElement).value;
    void run(async () => {
      await verifyProbeEmail(client, baseline(), value, email);
      return proof();
    });
  });
  root.querySelector("#check")!.addEventListener("click", () => { void run(async () => {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw new Error("The test session could not be refreshed. Stop here and tell Codex.");
    return proof();
  }); });
  root.querySelector("#signout")!.addEventListener("click", () => { void run(async () => {
    const result = await client.auth.signOut({ scope: "local" });
    if (result.error) throw new Error("The test could not sign out. Please retry.");
    return "Signed out of this test. Continue with the sign-in form below.";
  }); });
  root.querySelector<HTMLFormElement>("#signin")!.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const field = form.elements.namedItem("password") as HTMLInputElement;
    const password = field.value; field.value = "";
    void run(async () => {
      baseline();
      const existing = await client.auth.getSession();
      if (existing.error || existing.data.session) throw new Error("Sign out of this test before signing in again.");
      const result = await client.auth.signInWithPassword({ email: email.value.trim(), password });
      if (result.error) throw new Error("Staging rejected password sign-in. Please stop retrying and tell Codex. Your existing test account and progress have not been replaced.");
      return proof();
    });
  });
  let recovery: ReturnType<typeof createProbeRecovery> | null = null;
  root.querySelector<HTMLFormElement>("#recover-request")!.addEventListener("submit", event => {
    event.preventDefault();
    const email = ((event.currentTarget as HTMLFormElement).elements.namedItem("email") as HTMLInputElement).value;
    void run(async () => {
      recovery = createProbeRecovery(client, baseline());
      await recovery.request(email);
      return "If this account can receive recovery emails, one has been requested. Copy its recovery link or code into step 5; do not paste it into chat.";
    });
  });
  root.querySelector<HTMLFormElement>("#recover-verify")!.addEventListener("submit", event => {
    event.preventDefault();
    const field = (event.currentTarget as HTMLFormElement).elements.namedItem("verification") as HTMLInputElement;
    const value = field.value; field.value = "";
    const email = (root.querySelector<HTMLFormElement>("#recover-request")!.elements.namedItem("email") as HTMLInputElement).value;
    void run(async () => {
      recovery ??= createProbeRecovery(client, baseline());
      await recovery.verify(value, email);
      return "Recovery verified for the original test account. You can now choose a new test password in step 5.";
    });
  });
  root.querySelector<HTMLFormElement>("#recover-password")!.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const field = form.elements.namedItem("password") as HTMLInputElement;
    const confirmation = form.elements.namedItem("confirmation") as HTMLInputElement;
    const password = field.value, matches = password === confirmation.value;
    field.value = ""; confirmation.value = "";
    void run(async () => {
      if (!matches) throw new Error("The two new passwords did not match. No request was sent.");
      if (!recovery) throw new Error("Verify the recovery link in step 5 first.");
      await recovery.setPassword(password);
      return "New test password saved. Use step 4 to sign out, then sign in with this new password and check progress.";
    });
  });
  if (localStorage.getItem(PROBE_STORAGE_KEY)) void run(proof);
} catch {
  root.textContent = "This temporary test requires the local development server and staging public credentials. It cannot run against production.";
}
