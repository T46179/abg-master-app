import { PasswordRequirements } from "./PasswordRequirements.dev";
import { passwordRequirementError } from "../../core/passwordPolicy";
import { useRef, useState, type FormEvent } from "react";
import { useRegistration } from "../../app/RegistrationProvider";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import type { RegistrationDestination } from "../../core/registrationCallback";
import { AccountButton, AccountCard, AccountField, AccountPasswordPair, type AccountPage } from "./AccountUi.dev";

export function PasswordRecoveryPages({ page, destination, onPage }: { page: AccountPage; destination: RegistrationDestination; onPage: (page: AccountPage) => void }) {
  const { registration: r, registrationState: flow } = useRegistration();
  const busy = r.isBusy();
  const { identity } = useSiteAccount();
  const [email, setEmail] = useState(() => flow.email || identity.email || "");
  const [requestingEmail, setRequestingEmail] = useState(false);
  const resetFormShown = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [invalidAttempts, setInvalidAttempts] = useState(0);
  const resetLinkError = flow.error.startsWith("This reset link has expired or already been used.") ? flow.error : undefined;
  const invalidEmail = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  function back() { r.resetView(); onPage("signin"); }
  function requestEmail() {
    if (busy) return;
    setRequestingEmail(true);
    void r.requestResetEmail(email, destination).finally(() => setRequestingEmail(false));
  }
  if (flow.phase === "reset_password" || (flow.phase === "error" && r.canResetPassword()) || (flow.phase === "checking" && (r.canResetPassword() || resetFormShown.current))) {
    resetFormShown.current = true; return <ResetPassword />;
  }
  if (flow.phase === "checking" && !requestingEmail) return <div className="account-setup-loading" role="status" aria-label="Checking password reset"><span className="loading-chip__spinner" aria-hidden="true" /></div>;
  if (flow.phase === "reset_complete") return <AccountCard className="account-entry-card account-recovery-card" title="Password updated">
    <p className="account-entry-intro">You can now sign in using your new password.</p>
    <div className="account-verification-actions"><AccountButton className="account-entry-submit" showArrow={false} onClick={back}>Sign in</AccountButton></div>
  </AccountCard>;
  if (flow.phase === "awaiting_email") return <AccountCard className="account-entry-card account-recovery-card" eyebrow="Reset password" title="Check your email">
    <p className="account-entry-intro" role="status">If an account exists for this address, you'll receive an email with a link to reset its password.</p>
    <p className="account-footnote account-entry-footer"><button className="account-link" onClick={back}>Back to sign in</button></p>
  </AccountCard>;
  function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setSubmitted(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setInvalidAttempts(count => count + 1); document.getElementById("reset-request-email")?.focus(); return; }
    requestEmail();
  }
  return <AccountCard className="account-entry-card account-recovery-card" eyebrow="Reset password" title="Forgot your password?">
    <p className="account-entry-intro">Enter your email address and we'll send you a link to reset your password.</p>

    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
      {flow.error && !resetLinkError && <p role="alert" className="account-field-error">{flow.error}</p>}
      <AccountField id="reset-request-email" label="Email" disabled={busy} value={email} onChange={setEmail} error={invalidEmail ? "Enter a valid email address" : resetLinkError} />
      <AccountButton key={invalidAttempts} type="submit" className={"account-entry-submit" + (invalidAttempts > 0 ? " account-submit-rejected" : "")} showArrow={false} busy={busy} spinnerOnly busyLabel="Sending reset email">Send reset link</AccountButton>
    </form>
    <p className="account-footnote account-entry-footer"><button className="account-link" onClick={back}>Back to sign in</button></p>
  </AccountCard>;
}

function ResetPassword() {
  const { registration: r, registrationState: flow } = useRegistration();
  const busy = r.isBusy();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const requirementError = passwordRequirementError(password);
    if (requirementError) { setError(requirementError); document.getElementById("reset-password")?.focus(); return; }
    if (password !== confirm) { setError("The passwords don't match."); document.getElementById("reset-confirm-password")?.focus(); return; }
    const value = password; setPassword(""); setConfirm(""); setError(""); void r.completeReset(value);
  }
  return <AccountCard className="account-entry-card account-recovery-card" eyebrow="Reset password" title="Set a new password">
    <p className="account-entry-intro">Choose a new password for your account.</p>
    <PasswordRequirements password={password} />
    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
      {(error || flow.error) && <p role="alert" className="account-field-error">{error || flow.error}</p>}
      <AccountPasswordPair passwordId="reset-password" confirmId="reset-confirm-password" label="New password" confirmLabel="Confirm new password" password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} disabled={busy} />
      <AccountButton type="submit" className="account-entry-submit" showArrow={false} busy={busy} spinnerOnly busyLabel="Saving new password">Save new password</AccountButton>
    </form>
  </AccountCard>;
}
