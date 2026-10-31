import { useState, type FormEvent } from "react";
import { useAppContext } from "../../app/AppProvider";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import { useRegistration } from "../../app/RegistrationProvider";
import { meaningfulRegistrationProgress } from "../../core/registrationProgress";
import type { RegistrationDestination } from "../../core/registrationCallback";
import { AccountButton, AccountCard, AccountField, type AccountPage } from "./AccountUi.dev";
export function RegistrationPages({ page, destination, onPage }: { page: AccountPage; destination: RegistrationDestination; onPage: (page: AccountPage) => void }) {
  const { identity } = useSiteAccount(); const { state } = useAppContext();
  const { registration: r, registrationState: flow } = useRegistration();
  const [email, setEmail] = useState(() => flow.email || r.pending()?.email || "");
  const [keep, setKeep] = useState(true); const [editing, setEditing] = useState(false); const [submitted, setSubmitted] = useState(false);
  const progress = meaningfulRegistrationProgress({ user: state.userState, seen: state.storage?.loadSeenCaseState() ?? {},
    unfinished: Boolean(state.practiceState.currentCase || state.practiceState.pendingSubmission),
    checked: state.status === "ready" && !state.syncUnavailable && ["loaded", "absent"].includes(state.calibrationState.remoteStatus) });
  const invalidEmail = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  function submit(event: FormEvent, work: () => void) { event.preventDefault(); setSubmitted(true); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { document.getElementById("registration-email")?.focus(); return; } work(); }
  if (flow.phase === "checking") return <AccountCard title="Checking account setup"><p role="status">Please wait while we check your registration.</p></AccountCard>;
  if (flow.phase === "switch") return <AccountCard title="Continue account setup?"><p>This link verifies <strong>{flow.email}</strong>. Continuing will switch from the account currently in this browser after you create a password.</p><p>Your current account's saved work stays with its original owner. Guest progress may no longer be accessible after switching.</p><AccountButton onClick={() => r.confirmSwitch()}>Continue with verified account</AccountButton><p><button className="account-link" onClick={() => { r.resetView(); onPage("exam"); }}>Keep current account</button></p></AccountCard>;
  if (flow.phase === "signin") return <AccountCard title="Your account already has a password"><p>Password setup has already been completed for this account. Sign in using your existing email and password.</p><AccountButton onClick={() => { r.resetView(); onPage("signin"); }}>Sign in</AccountButton></AccountCard>;
  if (flow.phase === "password" || (flow.phase === "error" && r.canSetPassword())) return <CreatePassword />;
  if (flow.phase === "awaiting_email" || page === "checkEmail") return <AccountCard eyebrow="Check your inbox" title={r.emailPurpose() === "complete" ? "Finish creating your account" : "Verify your email"}>
    <p>{r.emailPurpose() === "complete" ? "If this account can continue registration, you'll receive a one-time link to finish setting up your password." : "Open the verification email, then click its link to create your password."}</p>
    <p className="account-address">{flow.email || r.pending()?.email}</p>
    {flow.error && <p role="alert" className="account-field-error">{flow.error}</p>}
    <AccountButton onClick={() => void (r.emailPurpose() === "complete" ? r.completionEmail(flow.email, flow.destination) : r.resend())}>Request another email</AccountButton>
    <p className="account-footnote"><button className="account-link" onClick={() => { setEmail(flow.email || r.pending()?.email || ""); setEditing(true); r.resetView(); onPage("signup"); }}>Correct email address</button></p>
    <p className="account-footnote"><button className="account-link" onClick={() => { r.resetView(); onPage("completion"); }}>Already verified? Finish account setup</button></p>
  </AccountCard>;
  if (page === "completion" || page === "link" || page === "password") return <AccountCard title="Finish creating your account"><p>Verified your email but haven't created a password? Request a new completion link.</p>
    <form className="account-form ph-no-capture" noValidate onSubmit={e => submit(e, () => void r.completionEmail(email, destination))}>
      {flow.error && <p role="alert" className="account-field-error">{flow.error}</p>}
      <AccountField id="registration-email" label="Email" value={email} onChange={setEmail} error={invalidEmail ? "Enter a valid email address" : undefined} />
      <AccountButton type="submit">Send completion link</AccountButton>
    </form><p className="account-footnote"><button className="account-link" onClick={() => { r.resetView(); onPage("signin"); }}>Already have a password? Sign in</button></p>
  </AccountCard>;
  return <AccountCard eyebrow="Free account" title={editing ? "Correct your email address" : "Create your account"}><p>Verify your email first, then create your password. Your account saves your progress across devices.</p>
    <form className="account-form ph-no-capture" noValidate onSubmit={e => submit(e, () => void (editing && r.pending() ? r.resend(email) : r.begin(email, keep, destination)))}>
      {flow.error && <p role="alert" className="account-field-error">{flow.error}</p>}
      <AccountField id="registration-email" label="Email" value={email} onChange={setEmail} error={invalidEmail ? "Enter a valid email address" : undefined} />
      {!editing && identity.status === "guest" && progress !== false && <div><label className="account-keep-progress"><input type="checkbox" checked={keep} disabled={progress === null} onChange={event => setKeep(event.target.checked)} />Keep my current progress</label>
        {progress === null && <p role="status">We're checking your saved progress. It will be kept by default.</p>}
        {!keep && <p className="account-notice">Starting fresh won't transfer your Practice progress. Your previous guest progress may no longer be accessible after switching accounts.</p>}
      </div>}
      <AccountButton type="submit">{editing ? "Send verification email" : "Verify email to continue"}</AccountButton>
    </form><p className="account-footnote"><button className="account-link" onClick={() => { r.resetView(); onPage("signin"); }}>Already have an account? Sign in</button></p>
    <p className="account-footnote"><button className="account-link" onClick={() => { r.resetView(); onPage("completion"); }}>Already verified your email? Finish account setup</button></p>
  </AccountCard>;
}
function CreatePassword() {
  const { registration: r, registrationState: flow } = useRegistration();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) { setError("Use at least 6 characters."); document.getElementById("registration-password")?.focus(); return; }
    if (password !== confirm) { setError("The passwords don't match."); document.getElementById("registration-confirm")?.focus(); return; }
    const value = password; setPassword(""); setConfirm(""); setError(""); void r.completePassword(value);
  }
  return <AccountCard eyebrow="Email verified" title="Create your password"><p>Create a password to finish setting up your account.</p><p className="account-address">{flow.email}</p>
    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
      {(error || flow.error) && <p role="alert" className="account-field-error">{error || flow.error}</p>}
      <AccountField id="registration-password" label="Password" password autoComplete="new-password" value={password} onChange={setPassword} />
      <AccountField id="registration-confirm" label="Confirm password" password autoComplete="new-password" value={confirm} onChange={setConfirm} />
      <p className="account-footnote">Use at least 6 characters. The account service will check any additional password requirements.</p>
      <AccountButton type="submit">Create password and continue</AccountButton>
    </form>
  </AccountCard>;
}
