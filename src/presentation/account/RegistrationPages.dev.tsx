import { useState, type FormEvent } from "react";
import { useAppContext } from "../../app/AppProvider";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import { useRegistration } from "../../app/RegistrationProvider";
import { meaningfulRegistrationProgress } from "../../core/registrationProgress";
import type { RegistrationDestination } from "../../core/registrationCallback";
import { AccountButton, AccountCard, AccountField, type AccountPage } from "./AccountUi.dev";
import { CheckIcon, ClipboardIcon, SyncIcon } from "./AccountIcons.dev";
import { History } from "lucide-react";
export function RegistrationPages({ page, destination, onPage }: { page: AccountPage; destination: RegistrationDestination; onPage: (page: AccountPage) => void }) {
  const { identity } = useSiteAccount(); const { state } = useAppContext();
  const { registration: r, registrationState: flow } = useRegistration();
  const [email, setEmail] = useState(() => flow.email || r.pending()?.email || "");
  const [invalidAttempts, setInvalidAttempts] = useState(0);
  const [keep, setKeep] = useState(true); const [editing, setEditing] = useState(false); const [submitted, setSubmitted] = useState(false);
  const progress = meaningfulRegistrationProgress({ user: state.userState, seen: state.storage?.loadSeenCaseState() ?? {},
    unfinished: Boolean(state.practiceState.currentCase || state.practiceState.pendingSubmission),
    checked: state.status === "ready" && !state.syncUnavailable && ["loaded", "absent"].includes(state.calibrationState.remoteStatus) });
  const invalidEmail = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  function submit(event: FormEvent, work: () => void) { event.preventDefault(); setSubmitted(true); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setInvalidAttempts(count => count + 1); document.getElementById("registration-email")?.focus(); return; } work(); }
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
  return <div className="account-signup-layout">
    <AccountCard className="account-entry-card" eyebrow="Get started" title={editing ? "Correct your email address" : "Create your account"}>
      <p className="account-entry-intro">Creating an account saves your progress across devices so you can pick up where you left off.</p>
      <div className="account-signup-benefit"><CheckIcon size={18} /><span>Access to a free trial exam</span></div>
      <form className="account-form ph-no-capture" noValidate onSubmit={e => submit(e, () => void (editing && r.pending() ? r.resend(email) : r.begin(email, keep, destination)))}>
        {flow.error && <p role="alert" className="account-field-error">{flow.error}</p>}
        <AccountField id="registration-email" label="Email" placeholder="you@example.com" value={email} onChange={setEmail} error={invalidEmail ? "Enter a valid email address" : undefined} />
        {!editing && (identity.status === "guest" || identity.status === "signed_out") && <div><label className="account-keep-progress"><input type="checkbox" checked={keep} disabled={identity.status === "guest" && progress === null} onChange={event => setKeep(event.target.checked)} />Keep my current progress</label>
          {identity.status === "guest" && progress === null && <p role="status">We're checking your saved progress. It will be kept by default.</p>}
          {!keep && <p className="account-notice">Creates a fresh account. Your previous progress as a guest will be lost.</p>}
        </div>}
        <button key={invalidAttempts} type="submit" className={"figma-button account-primary account-entry-submit" + (invalidAttempts > 0 ? " account-submit-rejected" : "")}>{editing ? "Send verification email" : "Create Account"}</button>
      </form>
      <p className="account-footnote account-entry-footer">Already have an account? <button type="button" className="account-link" onClick={() => { r.resetView(); onPage("signin"); }}>Sign in</button></p>
    </AccountCard>
    <FreeAccountBenefits />
  </div>;
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

function FreeAccountBenefits() {
  return <aside className="account-free-benefits" aria-labelledby="account-free-benefits-title">
    <h2 id="account-free-benefits-title">With a free account</h2>
    <ul>
      <li><span className="account-free-benefits-icon"><SyncIcon size={22} /></span><div><h3>Progress on every device</h3><p>Pick up Practice wherever you sign in.</p></div></li>
      <li><span className="account-free-benefits-icon"><History size={22} strokeWidth={1.6} aria-hidden="true" /></span><div><h3>Your results, kept</h3><p>Look back at past cases and scores any time.</p></div></li>
      <li><span className="account-free-benefits-icon"><ClipboardIcon /></span><div><h3>A free trial exam</h3><p>Try a full exam-grade sitting, marked in detail.</p></div></li>
    </ul>
  </aside>;
}
