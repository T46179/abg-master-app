import { useState, type FormEvent } from "react";
import { useRegistration } from "../../app/RegistrationProvider";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import type { RegistrationDestination } from "../../core/registrationCallback";
import { AccountButton, AccountCard, AccountField, type AccountPage } from "./AccountUi.dev";
import { KeyIcon, MailIcon, CheckIcon } from "./AccountIcons.dev";

export function PasswordRecoveryPages({ page, destination, onPage }: { page: AccountPage; destination: RegistrationDestination; onPage: (page: AccountPage) => void }) {
  const { registration: r, registrationState: flow } = useRegistration();
  const { identity } = useSiteAccount();
  const [email, setEmail] = useState(() => flow.email || identity.email || "");
  const [submitted, setSubmitted] = useState(false);
  const invalidEmail = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  function back() { r.resetView(); onPage("signin"); }
  if (flow.phase === "checking") return <AccountCard title="Checking password reset"><p role="status">Please wait…</p></AccountCard>;
  if (flow.phase === "reset_password" || (flow.phase === "error" && r.canResetPassword())) return <ResetPassword />;
  if (flow.phase === "reset_complete") return <AccountCard icon={<CheckIcon />} eyebrow="Password reset" title="Your password has been updated">
    <p>Sign in using your new password. Your progress and history stay with the same account.</p>
    {flow.email && <p className="account-address">{flow.email}</p>}
    {identity.status === "verified" && <p className="account-notice">This browser is still signed in as {identity.email}. Signing in below lets you choose which account to use.</p>}
    <AccountButton onClick={back}>Sign in with new password</AccountButton>
  </AccountCard>;
  if (flow.phase === "awaiting_email") return <AccountCard icon={<MailIcon />} eyebrow="Password reset" title="Check your email">
    <p role="status">If an account exists for this address, you'll receive an email with a link to reset its password.</p>
    <p className="account-address">{flow.email}</p>
    <AccountButton onClick={() => void r.requestResetEmail(flow.email, flow.destination)}>Request another reset email</AccountButton>
    <p className="account-footnote"><button className="account-link" onClick={() => { r.resetView(); onPage("forgot"); }}>Correct email address</button></p>
    <p className="account-footnote"><button className="account-link" onClick={back}>Back to sign in</button></p>
  </AccountCard>;
  function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { document.getElementById("reset-request-email")?.focus(); return; }
    void r.requestResetEmail(email, destination);
  }
  return <AccountCard icon={<KeyIcon />} eyebrow="Password reset" title="Forgot your password?">
    <p>Use your account email to request a password reset.</p>
    {page === "reset" && !flow.error && <p className="account-notice">Open the link in your latest reset email to choose a new password. You can request a new link below.</p>}
    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
      {flow.error && <p role="alert" className="account-field-error">{flow.error}</p>}
      <AccountField id="reset-request-email" label="Email" value={email} onChange={setEmail} error={invalidEmail ? "Enter a valid email address" : undefined} />
      <AccountButton type="submit">Send reset link</AccountButton>
    </form>
    <p className="account-footnote"><button className="account-link" onClick={back}>Back to sign in</button></p>
  </AccountCard>;
}

function ResetPassword() {
  const { registration: r, registrationState: flow } = useRegistration();
  const { identity } = useSiteAccount();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) { setError("Use at least 6 characters."); document.getElementById("reset-password")?.focus(); return; }
    if (password !== confirm) { setError("The passwords don't match."); document.getElementById("reset-confirm-password")?.focus(); return; }
    const value = password; setPassword(""); setConfirm(""); setError(""); void r.completeReset(value);
  }
  return <AccountCard icon={<KeyIcon />} eyebrow="Password reset" title="Set a new password">
    <p>Choose a new password for your account.</p><p className="account-address">{flow.email}</p>
    <p className="account-notice">{identity.email && identity.email.toLowerCase() !== flow.email.toLowerCase()
      ? "This reset applies only to the email above. It will not switch the account currently using this browser."
      : "Resetting your password signs this account out. Saved progress and unfinished work stay with the same account."}</p>
    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
      {(error || flow.error) && <p role="alert" className="account-field-error">{error || flow.error}</p>}
      <AccountField id="reset-password" label="New password" password autoComplete="new-password" value={password} onChange={setPassword} />
      <AccountField id="reset-confirm-password" label="Confirm new password" password autoComplete="new-password" value={confirm} onChange={setConfirm} />
      <p className="account-footnote">Use at least 6 characters. Choose a password different from your previous password.</p>
      <AccountButton type="submit">Save new password</AccountButton>
    </form>
  </AccountCard>;
}
