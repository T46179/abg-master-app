import { passwordRequirementError } from "./passwordPolicy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SiteAccount } from "./siteAccount";
import type { BrowserStorageLike } from "./storage";
import { checkPasswordRecoverySession, verifyPasswordRecoveryLink } from "./passwordRecovery";
import { registrationDestination, registrationReturnUrl, type RegistrationCallback, type RegistrationDestination } from "./registrationCallback";

export type RegistrationPhase = "idle" | "awaiting_email" | "checking" | "password" | "switch" | "complete" | "signin" | "error" | "reset_password" | "reset_complete";
export type PendingRegistration = { version: 1; ownerId: string | null; targetId: string; email: string; keepProgress: boolean; destination: RegistrationDestination };
export type RegistrationSnapshot = Readonly<{ phase: RegistrationPhase; email: string; error: string; destination: RegistrationDestination; completedUserId: string | null; completedGeneration: number | null }>;
export async function readAccountSetupStatus(client: SupabaseClient): Promise<boolean> {
  const result = await client.rpc("get_account_setup_status");
  if (result.error || !result.data || typeof result.data.hasPassword !== "boolean") throw new Error("We couldn't check account setup. Please try again.");
  return result.data.hasPassword;
}
export const REGISTRATION_PENDING_KEY = "abgm-registration-v1:clpfecuohwzwrgmqzeos";
export const REGISTRATION_CODE_KEY = "abgm-registration-code-v1:clpfecuohwzwrgmqzeos";
export const REGISTRATION_RESEND_DELAY_MS = 60_000;
export type RegistrationCodeRequest = { version: 1; ownerId: string | null; email: string; purpose: "verify" | "complete"; destination: RegistrationDestination; sentAt: number; resendAvailableAt: number };

export const REGISTRATION_AUTH_KEY = "abgm-registration-auth-clpfecuohwzwrgmqzeos";

function loadPending(storage: BrowserStorageLike): PendingRegistration | null {
  try {
    const p = JSON.parse(storage.getItem(REGISTRATION_PENDING_KEY) ?? "null");
    if (p?.version !== 1 || typeof p.targetId !== "string" || !p.targetId || typeof p.email !== "string"
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) || typeof p.keepProgress !== "boolean"
      || !(p.ownerId === null || typeof p.ownerId === "string")) return null;
    return { version: 1, ownerId: p.ownerId, targetId: p.targetId, email: p.email, keepProgress: p.keepProgress, destination: registrationDestination(p.destination) };
  } catch { return null; }
}
function loadCodeRequest(storage: BrowserStorageLike): RegistrationCodeRequest | null {
  try {
    const value = JSON.parse(storage.getItem(REGISTRATION_CODE_KEY) ?? "null");
    if (value?.version !== 1 || !(value.ownerId === null || typeof value.ownerId === "string")
      || typeof value.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)
      || !["verify", "complete"].includes(value.purpose) || !Number.isFinite(value.sentAt)
      || !Number.isFinite(value.resendAvailableAt)) return null;
    return { ...value, destination: registrationDestination(value.destination) };
  } catch { return null; }
}
async function checkedUser(client: SupabaseClient) {
  const result = await client.auth.getUser();
  if (result.error || !result.data.user || typeof result.data.user.is_anonymous !== "boolean") throw new Error("Your account could not be checked. Please try again.");
  return result.data.user;
}
export function createAccountRegistration(account: SiteAccount, canonical: SupabaseClient,
  temporary: (kind: "pending" | "callback", credentials?: { access_token: string; refresh_token: string }) => SupabaseClient, storage: BrowserStorageLike) {
  let pending = loadPending(storage);
  let codeRequest = loadCodeRequest(storage);
  let snapshot: RegistrationSnapshot = Object.freeze({ phase: "idle", email: "", error: "", destination: "exam", completedUserId: null, completedGeneration: null });
  let candidate: SupabaseClient | null = null;
  let candidateId: string | null = null;
  let candidatePurpose: "setup" | "reset" = "setup";
  let candidateOwner: ReturnType<SiteAccount["getSnapshot"]> | null = null;
  let confirmedSwitch = false;
  let revision = 0;
  let running = false;
  let runningTicket = 0;
  let emailPurpose: "verify" | "complete" | "reset" = codeRequest?.purpose ?? "verify";
  const listeners = new Set<() => void>();
  function publish(phase: RegistrationPhase, error = "", email = visibleCodeRequest()?.email ?? (pending?.ownerId === account.getSnapshot().userId ? pending.email : snapshot.email), destination = visibleCodeRequest()?.destination ?? (pending?.ownerId === account.getSnapshot().userId ? pending.destination : snapshot.destination)) {
    const current = account.getSnapshot();
    const completedUserId = ["complete", "reset_complete"].includes(phase) ? ["complete", "reset_complete"].includes(snapshot.phase) ? snapshot.completedUserId : current.userId : null;
    const completedGeneration = ["complete", "reset_complete"].includes(phase) ? ["complete", "reset_complete"].includes(snapshot.phase) ? snapshot.completedGeneration : current.generation : null;
    snapshot = Object.freeze({ phase, error, email, destination, completedUserId, completedGeneration }); listeners.forEach(fn => fn());
  }
  function assertOwner(owner: ReturnType<SiteAccount["getSnapshot"]>, ticket: number) {
    const now = account.getSnapshot();
    if (ticket !== revision || now.userId !== owner.userId || now.generation !== owner.generation || (now.status === "checking" || (now.status === "unavailable" && owner.status !== "unavailable")))
      throw new Error("The account changed. Reopen registration for the current account.");
  }
  function visibleCodeRequest() {
    return codeRequest?.ownerId === account.getSnapshot().userId ? codeRequest : null;
  }
  function assertCurrentCodeRequest(request: RegistrationCodeRequest) {
    const stored = loadCodeRequest(storage);
    if (codeRequest !== request || !stored || stored.ownerId !== request.ownerId || stored.email !== request.email
      || stored.purpose !== request.purpose || stored.sentAt !== request.sentAt || stored.destination !== request.destination)
      throw new Error("Your registration changed. Request a new code.");
  }
  function saveCodeRequest(ownerId: string | null, email: string, purpose: "verify" | "complete", destination: RegistrationDestination) {
    const sentAt = Date.now();
    const value: RegistrationCodeRequest = { version: 1, ownerId, email, purpose, destination, sentAt, resendAvailableAt: sentAt + REGISTRATION_RESEND_DELAY_MS };
    storage.setItem(REGISTRATION_CODE_KEY, JSON.stringify(value)); codeRequest = value;
  }
  function checkResend(email: string, purpose: "verify" | "complete") {
    const request = visibleCodeRequest();
    if (request?.purpose === purpose && request.email.toLowerCase() === email.toLowerCase() && Date.now() < request.resendAvailableAt)
      throw new Error("Please wait before requesting another code.");
  }
  function savePending(value: PendingRegistration) {
    storage.setItem(REGISTRATION_PENDING_KEY, JSON.stringify(value)); pending = value;
  }
  function clearPending() {
    storage.removeItem(REGISTRATION_CODE_KEY); codeRequest = null;
    storage.removeItem(REGISTRATION_PENDING_KEY); storage.removeItem(REGISTRATION_AUTH_KEY); pending = null;
  }
  async function operation(work: (owner: ReturnType<SiteAccount["getSnapshot"]>, ticket: number) => Promise<void>) {
    if (running) return;
    running = true; const owner = { ...account.getSnapshot() }; const ticket = ++revision; runningTicket = ticket;
    if (candidateOwner && (candidateOwner.userId !== owner.userId || candidateOwner.generation !== owner.generation)) {
      candidate = null; candidateId = null; candidateOwner = null; running = false;
      publish("error", "The account changed. Reopen registration for the current account.", "", "exam"); return;
    }
    publish("checking");
    try { await work(owner, ticket); }
    catch (error) {
      if (ticket === revision) {
        const now = account.getSnapshot();
        if (now.userId !== owner.userId || now.generation !== owner.generation) {
          candidate = null; candidateId = null; candidateOwner = null;
          publish("error", "The account changed. Reopen registration for the current account.", "", "exam");
        } else publish("error", error instanceof Error ? error.message : "Account setup could not be completed. Please try again.", snapshot.email, snapshot.destination);
      }
    }
    finally { if (runningTicket === ticket) { running = false; publish(snapshot.phase, snapshot.error, snapshot.email, snapshot.destination); } }
  }
  async function ownedAuth(source: SupabaseClient, owner: ReturnType<SiteAccount["getSnapshot"]>, ticket: number) {
    const session = await source.auth.getSession();
    assertOwner(owner, ticket);
    if (session.error || !session.data.session) throw new Error("The registration session could not be checked.");
    const credentials = { access_token: session.data.session.access_token, refresh_token: session.data.session.refresh_token };
    const bound = temporary("callback", credentials);
    const installed = await bound.auth.setSession(credentials);
    assertOwner(owner, ticket);
    if (installed.error || (await checkedUser(bound)).id !== session.data.session.user.id) throw new Error("The registration owner could not be checked.");
    assertOwner(owner, ticket);
    return bound;
  }
  async function stage(client: SupabaseClient, destination: RegistrationDestination, owner: ReturnType<SiteAccount["getSnapshot"]>, ticket: number, purpose: "verify" | "complete" | "reset") {
    if (client === canonical) client = await ownedAuth(client, owner, ticket);
    const user = await checkedUser(client);
    if (user.is_anonymous !== false || !user.email || !user.email_confirmed_at) throw new Error("This email has not been verified. Request another verification email.");
    assertOwner(owner, ticket);
    if (purpose === "verify" && pending && pending.targetId !== user.id) throw new Error("This link belongs to another registration. Your current account has not changed.");
    if (purpose === "reset") {
      const recovered = await checkPasswordRecoverySession(client);
      assertOwner(owner, ticket);
      candidate = client; candidateId = recovered.id; candidateOwner = owner; candidatePurpose = "reset";
      publish("reset_password", "", recovered.email, destination); return;
    }
    const hasPassword = await readAccountSetupStatus(client);
    assertOwner(owner, ticket);
    if (hasPassword) {
      candidate = null; candidateId = null;
      if (owner.status === "verified" && owner.userId === user.id) { clearPending(); publish("complete", "", user.email, destination); }
      else publish("signin", "", user.email, destination);
      return;
    }
    candidate = client; candidateId = user.id; candidateOwner = owner; candidatePurpose = "setup"; confirmedSwitch = false;
    publish(owner.status === "unavailable" || (owner.userId && owner.userId !== user.id) ? "switch" : "password", "", user.email, destination);
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    isBusy: () => running,
    canSetPassword: () => Boolean(candidate && candidateId && candidatePurpose === "setup"),
    canResetPassword: () => Boolean(candidate && candidateId && candidatePurpose === "reset"),
    emailPurpose: () => emailPurpose,
    codeRequest: visibleCodeRequest,
    pending: () => pending?.ownerId === account.getSnapshot().userId ? pending : null,
    begin(email: string, keepProgress: boolean, destination: RegistrationDestination) {
      return operation(async (owner, ticket) => {
        const address = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter a valid email address.");
        publish("checking", "", address, destination);
        if (owner.status !== "guest" && owner.status !== "signed_out") throw new Error("Sign out before creating another account.");
        const session = await canonical.auth.getSession();
        if (session.error) throw new Error("Your existing sign-in could not be checked.");
        assertOwner(owner, ticket);
        let client = canonical;
        let user = session.data.session ? await checkedUser(canonical) : null;
        assertOwner(owner, ticket);
        if (user && (user.id !== owner.userId || user.is_anonymous !== true)) throw new Error("This is not the current guest account.");
        if (keepProgress && !user) {
          await account.continueAsGuest();
          const now = account.getSnapshot();
          if (now.status !== "guest" || !now.userId) throw new Error("The guest account could not be prepared. Please retry.");
          Object.assign(owner, now);
          user = await checkedUser(canonical);
          assertOwner(owner, ticket);
          if (user.id !== owner.userId || !user.is_anonymous) throw new Error("The registration owner changed.");
        }
        if (!keepProgress || !user) {
          client = temporary("pending");
          const existing = await client.auth.getSession();
          if (existing.error) throw new Error("Pending registration could not be checked.");
          if (existing.data.session && pending?.ownerId === owner.userId && pending.targetId === existing.data.session.user.id) {
            user = await checkedUser(client);
            if (!user.is_anonymous) throw new Error("Finish your pending registration or use a completion email.");
          } else {
            const created = await client.auth.signInAnonymously();
            if (created.error || !created.data.user?.is_anonymous) throw new Error("The new account could not be prepared. Please try again.");
            user = created.data.user;
          }
        }
        assertOwner(owner, ticket);
        if (!user) throw new Error("The guest account could not be checked.");
        const writer = await ownedAuth(client, owner, ticket);
        const result = await writer.auth.updateUser({ email: address }, { emailRedirectTo: registrationReturnUrl("verify", destination) });
        assertOwner(owner, ticket);
        if (result.error) {
          if (result.error.code === "email_exists") throw new Error("An account with this email already exists. Please try a different email.");
          if (/rate_limit|too_many/.test(result.error.code ?? "")) throw new Error("Please wait before requesting another email.");
          throw new Error("The verification email could not be requested. Check the address and try again.");
        }
        if (result.data.user?.id !== user.id) throw new Error("The registration identity could not be confirmed.");
        emailPurpose = "verify";
        saveCodeRequest(owner.userId, address, "verify", destination);
        savePending({ version: 1, ownerId: owner.userId, targetId: user.id, email: address, keepProgress: client === canonical, destination });
        publish("awaiting_email");
      });
    },
    resend(email?: string) {
      return operation(async (owner, ticket) => {
        if (!pending || pending.ownerId !== owner.userId) throw new Error("Reopen registration for the current account.");
        const client = pending.keepProgress ? canonical : temporary("pending");
        const user = await checkedUser(client);
        assertOwner(owner, ticket);
        if (user.id !== pending.targetId) throw new Error("The registration session has changed.");
        if (user.email_confirmed_at && !user.is_anonymous) { await stage(client, pending.destination, owner, ticket, "verify"); return; }
        const address = (email ?? pending.email).trim();
        checkResend(address, "verify");
        const writer = await ownedAuth(client, owner, ticket);
        const result = await writer.auth.updateUser({ email: address }, { emailRedirectTo: registrationReturnUrl("verify", pending.destination) });
        assertOwner(owner, ticket);
        if (result.error) throw new Error("The email could not be requested. Check the address or wait before retrying.");
        savePending({ ...pending, email: address });
        emailPurpose = "verify"; saveCodeRequest(owner.userId, address, "verify", pending.destination); publish("awaiting_email");
      });
    },
    completionEmail(email: string, destination: RegistrationDestination = "exam") {
      return operation(async (owner, ticket) => {
        const address = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter a valid email address.");
        checkResend(address, "complete");
        const client = temporary("pending");
        const result = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: registrationReturnUrl("complete", destination) } });
        assertOwner(owner, ticket);
        if (result.error && !["otp_disabled", "user_not_found", "signup_disabled"].includes(result.error.code ?? "")) throw new Error("The completion email could not be requested. Wait and try again.");
        emailPurpose = "complete"; saveCodeRequest(owner.userId, address, "complete", destination); publish("awaiting_email", "", address, destination);
      });
    },
    verifyCode(value: string) {
      return operation(async (owner, ticket) => {
        const request = visibleCodeRequest();
        if (!request || emailPurpose === "reset") throw new Error("Request a verification code before continuing.");
        assertCurrentCodeRequest(request);
        emailPurpose = request.purpose;
        publish("checking", "", request.email, request.destination);
        const token = value.replace(/\s/g, "");
        if (!/^[0-9]{6,10}$/.test(token)) throw new Error("Enter the verification code from your email.");
        let verifier: SupabaseClient;
        if (request.purpose === "verify") {
          if (!pending || pending.ownerId !== owner.userId || pending.email.toLowerCase() !== request.email.toLowerCase())
            throw new Error("Your registration changed. Request a new code.");
          const source = pending.keepProgress ? canonical : temporary("pending");
          verifier = await ownedAuth(source, owner, ticket);
        } else {
          verifier = temporary("pending");
        }
        const result = await verifier.auth.verifyOtp({ email: request.email, token, type: request.purpose === "verify" ? "email_change" : "email" });
        assertOwner(owner, ticket);
        assertCurrentCodeRequest(request);
        if (result.error) {
          const code = result.error.code ?? "";
          if (/rate_limit|too_many/.test(code)) throw new Error("Too many attempts. Please wait before trying again.");
          if (["otp_expired", "otp_disabled", "validation_failed"].includes(code)) throw new Error("This code is incorrect or has expired. Try again or request a new code.");
          throw new Error("The code could not be verified. Try again or request a new code.");
        }
        const user = await checkedUser(verifier);
        assertOwner(owner, ticket);
        if (user.is_anonymous !== false || !user.email_confirmed_at || user.email?.toLowerCase() !== request.email.toLowerCase()
          || (request.purpose === "verify" && user.id !== pending?.targetId))
          throw new Error("The code does not match this registration. Request a new code.");
        assertCurrentCodeRequest(request);
        if (request.purpose === "verify" && pending && !pending.keepProgress) {
          // Keep the verified session in the isolated setup store until password completion.
          const session = await verifier.auth.getSession();
          assertOwner(owner, ticket); assertCurrentCodeRequest(request);
          if (session.error || !session.data.session || session.data.session.user.id !== user.id)
            throw new Error("Your verified setup session could not be checked. Request another code.");
          const saved = await temporary("pending").auth.setSession({
            access_token: session.data.session.access_token, refresh_token: session.data.session.refresh_token
          });
          assertOwner(owner, ticket); assertCurrentCodeRequest(request);
          if (saved.error) throw new Error("Your verified setup session could not be saved. Request another code.");
        }
        await stage(verifier, request.destination, owner, ticket, request.purpose);
      });
    },
    confirmPasswordSignIn(email: string, destination: RegistrationDestination) {
      const current = account.getSnapshot();
      if (current.status !== "verified" || current.email?.toLowerCase() !== email.trim().toLowerCase()) return;
      ++revision; candidate = null; candidateId = null; candidateOwner = null;
      storage.removeItem(REGISTRATION_CODE_KEY); codeRequest = null;
      publish("idle", "", current.email, destination); publish("complete", "", current.email, destination);
    },
    requestResetEmail(email: string, destination: RegistrationDestination = "exam") {
      return operation(async (owner, ticket) => {
        emailPurpose = "reset"; candidate = null; candidateId = null; candidateOwner = null;
        const address = email.trim(); publish("checking", "", address, destination);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter a valid email address.");
        const result = await temporary("callback").auth.resetPasswordForEmail(address, { redirectTo: registrationReturnUrl("reset", destination) });
        assertOwner(owner, ticket);
        if (result.error && !["user_not_found", "email_not_found"].includes(result.error.code ?? ""))
          throw new Error("The reset email could not be requested. Please wait and try again.");
        publish("awaiting_email", "", address, destination);
      });
    },
    callback(value: RegistrationCallback) {
      return operation(async (owner, ticket) => {
        emailPurpose = value.purpose ?? "verify";
        if (emailPurpose === "reset") publish("checking", "", "", value.kind !== "error" ? value.destination : "exam");
        if (value.kind === "error") throw new Error(emailPurpose === "reset" ? "This reset link has expired or already been used." : "This registration link could not be used. It may have expired or already been used.");
        const client = temporary("callback");
        if (value.kind === "recovery") {
          await verifyPasswordRecoveryLink(client, value.tokenHash);
          assertOwner(owner, ticket);
          await stage(client, value.destination, owner, ticket, "reset"); return;
        }
        if (value.purpose !== "verify" && value.purpose !== "complete") throw new Error("Request a new password-reset email.");
        const result = await client.auth.setSession({ access_token: value.accessToken, refresh_token: value.refreshToken });
        assertOwner(owner, ticket);
        if (result.error) throw new Error(emailPurpose === "reset" ? "This reset link could not be used. Request a new reset email." : "This registration link could not be used. Request another email.");
        await stage(client, value.destination, owner, ticket, value.purpose);
      });
    },
    resume() {
      return operation(async (owner, ticket) => {
        const request = visibleCodeRequest();
        if (request?.purpose === "complete") {
          emailPurpose = "complete";
          const client = temporary("pending");
          const session = await client.auth.getSession();
          assertOwner(owner, ticket);
          if (session.error) throw new Error("Your setup session could not be checked. Please retry.");
          if (session.data.session) {
            const user = await checkedUser(client);
            assertOwner(owner, ticket);
            if (!user.is_anonymous && user.email_confirmed_at && user.email?.toLowerCase() === request.email.toLowerCase()) {
              await stage(client, request.destination, owner, ticket, "complete"); return;
            }
          }
          publish("awaiting_email", "", request.email, request.destination); return;
        }
        if (!pending || pending.ownerId !== owner.userId) { publish("idle"); return; }
        emailPurpose = "verify";
        const client = pending.keepProgress ? canonical : temporary("pending");
        const user = await checkedUser(client);
        assertOwner(owner, ticket);
        if (user.id !== pending.targetId) throw new Error("The pending registration session has changed.");
        if (!user.is_anonymous && user.email_confirmed_at) await stage(client, pending.destination, owner, ticket, "verify");
        else publish("awaiting_email");
      });
    },
    resumeVerified() {
      return operation(async (owner, ticket) => {
        await stage(canonical, pending?.destination ?? "exam", owner, ticket, "complete");
      });
    },
    confirmSwitch() {
      if (!candidate || !candidateOwner) return;
      const now = account.getSnapshot();
      if (now.userId !== candidateOwner.userId || now.generation !== candidateOwner.generation) { candidate = null; publish("error", "Your active account changed. Reopen account setup."); return; }
      confirmedSwitch = true; publish("password");
    },
    completePassword(password: string) {
      return operation(async (owner, ticket) => {
        if (!candidate || !candidateId || !candidateOwner || candidatePurpose !== "setup") throw new Error("Verify your email before creating a password.");
        if (owner.userId !== candidateOwner.userId || owner.generation !== candidateOwner.generation) throw new Error("Your active account changed. Reopen account setup.");
        if (owner.userId && owner.userId !== candidateId && !confirmedSwitch) throw new Error("Confirm the account switch first.");
        const user = await checkedUser(candidate);
        assertOwner(owner, ticket);
        if (user.id !== candidateId || user.is_anonymous || !user.email_confirmed_at) throw new Error("The verified registration session changed.");
        if (await readAccountSetupStatus(candidate)) { candidate = null; candidateId = null; publish("signin", "", user.email ?? ""); return; }
        assertOwner(owner, ticket);
        const requirementError = passwordRequirementError(password);
        if (requirementError) throw new Error(requirementError);
        const result = await candidate.auth.updateUser({ password });
        assertOwner(owner, ticket);
        if (result.error) throw new Error(result.error.code === "weak_password" ? "Choose a password that meets the displayed requirements." : "The password could not be saved. Your session may need a new verification code.");
        if (result.data.user?.id !== candidateId || !await readAccountSetupStatus(candidate)) throw new Error("Password setup could not be confirmed.");
        const session = await candidate.auth.getSession();
        assertOwner(owner, ticket);
        if (session.error || !session.data.session || session.data.session.user.id !== candidateId) throw new Error("Your setup session could not be checked. Sign in using your new password.");
        const adopted = await canonical.auth.setSession({ access_token: session.data.session.access_token, refresh_token: session.data.session.refresh_token });
        if (adopted.error) throw new Error("Your password was saved. Sign in to continue.");
        await account.refresh();
        if (account.getSnapshot().userId !== candidateId || account.getSnapshot().status !== "verified") throw new Error("Your password was saved. Sign in to continue.");
        candidate.auth.stopAutoRefresh(); candidate = null; candidateId = null; candidateOwner = null;
        clearPending(); publish("complete", "", user.email ?? "", snapshot.destination);
      });
    },
    completeReset(password: string) {
      return operation(async (owner, ticket) => {
        const proof = candidate; const targetId = candidateId;
        if (!proof || !targetId || !candidateOwner || candidatePurpose !== "reset") throw new Error("Open a password-reset email before choosing a new password.");
        if (owner.userId !== candidateOwner.userId || owner.generation !== candidateOwner.generation) throw new Error("Your active account changed. Reopen the reset link.");
        const recovered = await checkPasswordRecoverySession(proof);
        assertOwner(owner, ticket);
        if (recovered.id !== targetId) throw new Error("The reset account changed. Request a new reset email.");
        const requirementError = passwordRequirementError(password);
        if (requirementError) throw new Error(requirementError);
        const result = await proof.auth.updateUser({ password });
        assertOwner(owner, ticket);
        if (result.error) {
          if (result.error.code === "same_password") throw new Error("Choose a password different from your current password.");
          if (result.error.code === "weak_password") throw new Error("Choose a password that meets the displayed requirements.");
          candidate = null; candidateId = null;
          throw new Error("The password could not be saved. Request a new reset email.");
        }
        candidate = null; candidateId = null; candidateOwner = null;
        if (result.data.user?.id !== targetId) throw new Error("Password reset could not be confirmed. Try signing in or request another reset email.");
        // Auth revokes this user's other sessions on password update. Close the isolated
        // reset session too; never adopt it as the account currently using the site.
        await proof.auth.signOut({ scope: "local" }).catch(() => undefined);
        proof.auth.stopAutoRefresh(); assertOwner(owner, ticket);
        if (owner.userId === targetId) {
          await account.signOut();
          if (account.getSnapshot().status !== "signed_out") throw new Error("Your password was saved. Sign out, then sign in with the new password.");
        }
        publish("reset_complete", "", recovered.email, snapshot.destination);
      });
    },
    resetView() { ++revision; candidate = null; candidateId = null; candidateOwner = null; emailPurpose = "verify"; publish("idle", "", ""); },
    accountChanged() { if (codeRequest && codeRequest.ownerId !== account.getSnapshot().userId) { storage.removeItem(REGISTRATION_CODE_KEY); codeRequest = null; } ++revision; candidate = null; candidateId = null; candidateOwner = null; running = false; runningTicket = 0; emailPurpose = "verify"; publish("idle", "", ""); },
  };
}
export type AccountRegistration = ReturnType<typeof createAccountRegistration>;
