import { useState, type ReactNode } from "react";
import { Surface } from "../primitives/Surface";
import { ArrowIcon, CheckIcon, ChevronLeftIcon, EyeIcon, EyeOffIcon, MailIcon, KeyIcon, CloudOffIcon, ClockIcon } from "./AccountIcons.dev";

export type AccountPage = "exam" | "signin" | "signup" | "checkEmail" | "forgot" | "reset" | "link" | "about" | "setup" | "password" | "completion";
export function AccountCard({ title, eyebrow, children, icon, className = "" }: { title: string; eyebrow?: string; children: ReactNode; icon?: ReactNode; className?: string }) {
  return <Surface className={"account-card " + className}>{icon && <span className="account-card-icon">{icon}</span>}{eyebrow && <p className="account-eyebrow">{eyebrow}</p>}<h1 tabIndex={-1}>{title}</h1>{children}</Surface>;
}
export function AccountButton({ children, onClick, disabled, busy, type = "button", className = "", showArrow = true, spinnerOnly = false, busyLabel }: { spinnerOnly?: boolean; busyLabel?: string; className?: string; showArrow?: boolean; children: ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean; type?: "button" | "submit" }) {
  return <button className={"figma-button account-primary " + className} type={type} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} aria-label={busy && spinnerOnly ? busyLabel ?? "Please wait" : undefined}>{busy ? <><span className="figma-button__spinner" aria-hidden="true" />{!spinnerOnly && (busyLabel ?? "Signing in…")}</> : <>{children}{showArrow && <ArrowIcon />}</>}</button>;
}
export function AccountBack({ onBack }: { onBack: () => void }) { return <button className="account-back" onClick={onBack}><ChevronLeftIcon />Back to Exam Room</button>; }
export function TrialStepper({ step, onStep }: { step: number; onStep?: (step: number) => void }) {
  return <nav className="account-stepper" aria-label="Trial exam progress"><div><strong>Trial exam</strong><span>Step {step + 1} of 3</span></div><ol>{["Account", "About you", "Exam setup"].map((label, i) => {
    const content = <>{i < step ? <CheckIcon size={13} /> : i + 1}<span>{label}</span></>;
    return <li key={label} aria-current={i === step ? "step" : undefined} data-reached={i <= step}><span />{onStep && i > 0 && i !== step ? <button type="button" className="account-stepper-label" aria-label={label} onClick={() => onStep(i)}>{content}</button> : <div className="account-stepper-label">{content}</div>}</li>;
  })}</ol></nav>;
}
export function AccountField({ id, label, password = false, error, disabled = false, value, onChange, aside, autoComplete, placeholder }: { placeholder?: string; autoComplete?: string; id: string; label: string; password?: boolean; error?: string; disabled?: boolean; value: string; onChange: (v: string) => void; aside?: ReactNode }) {
  const [shown, setShown] = useState(false);
  return <div className={"account-field ph-no-capture" + (aside ? " account-field--with-aside" : "")} data-clarity-mask="true" data-sentry-mask="true"><div><label htmlFor={id}>{label}</label></div><div className="account-input" data-invalid={Boolean(error)}>
    <input id={id} name={id} placeholder={placeholder} type={password && !shown ? "password" : password ? "text" : "email"} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} autoComplete={autoComplete ?? (password ? "current-password" : "username")} aria-invalid={Boolean(error)} aria-describedby={error ? id + "-error" : undefined} />
    {password && <button type="button" onClick={() => setShown(v => !v)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} aria-controls={id} disabled={disabled}>{shown ? <EyeOffIcon /> : <EyeIcon />}</button>}
  </div>{aside && <div className="account-field-aside">{aside}</div>}{error && <p id={id + "-error"} className="account-field-error" role="alert">{error}</p>}</div>;
}
export function EmailLinkResult({ variant, onSignIn, onRetry }: { variant: "verified" | "verifyExpired" | "resetExpired" | "failed"; onSignIn: () => void; onRetry: () => void }) {
  const verified = variant === "verified";
  return <AccountCard icon={verified ? <CheckIcon /> : variant === "failed" ? <CloudOffIcon /> : <ClockIcon />} eyebrow={verified ? "Email verified" : "Email link"} title={verified ? "You're all set" : variant === "failed" ? "We couldn't check this link" : "This link has expired or already been used"}>
    <p>{verified ? "Your email is confirmed. Continue to your account." : "Clickable email verification and password recovery are being connected next. No account changes have been made here."}</p><AccountButton onClick={verified ? onSignIn : onRetry}>{verified ? "Continue" : "Back to sign in"}</AccountButton>
  </AccountCard>;
}
export function UnconnectedAccountPage({ page, email, onPage }: { page: "signup" | "checkEmail" | "forgot" | "reset"; email: string; onPage: (page: AccountPage) => void }) {
  const [address, setAddress] = useState(email);
  const titles = { signup: "Create your account", checkEmail: "Check your email", forgot: "Forgot your password?", reset: "Set a new password" };
  return <AccountCard icon={page === "signup" ? undefined : page === "checkEmail" ? <MailIcon /> : <KeyIcon />} eyebrow={page === "signup" ? "Free account" : page === "checkEmail" ? "Verify your email" : "Password reset"} title={titles[page]}>
    <p>{page === "signup" ? "Creating an account saves your progress across devices, so you can pick up wherever you are." : page === "checkEmail" ? "Confirm your email before starting an exam." : page === "forgot" ? "Use your account email to request a password reset." : "Choose a new password for your account."}</p>
    <div className="account-notice" role="status">{page === "signup" ? "Registration" : page === "checkEmail" ? "Email verification" : "Password recovery"} is being connected next. This page does not send emails or change your account. Existing accounts can sign in now.</div>
    {page !== "checkEmail" ? <form onSubmit={event => event.preventDefault()} className="account-form">
      {page !== "reset" && <AccountField id="account-new-email" label="Email" value={address} onChange={setAddress} />}
      {(page === "signup" || page === "reset") && <AccountField id="account-new-password" label={page === "signup" ? "Password" : "New password"} password value="" onChange={() => undefined} disabled />}
      {page === "reset" && <AccountField id="account-confirm-password" label="Confirm new password" password value="" onChange={() => undefined} disabled />}
      <AccountButton disabled>{page === "signup" ? "Create account" : page === "forgot" ? "Send reset link" : "Save new password"}</AccountButton>
    </form> : <><p className="account-address">{email}</p><AccountButton disabled>Resend email</AccountButton></>}
    <p className="account-footnote"><button className="account-link" onClick={() => onPage("signin")}>Back to sign in</button>{page === "checkEmail" && <> · <button className="account-link" onClick={() => onPage("signup")}>Correct email address</button></>}</p>
  </AccountCard>;
}

/** Put both inputs before their visibility buttons in DOM order so Tab follows the form fields. */
export function AccountPasswordPair({ passwordId, confirmId, password, confirm, onPassword, onConfirm, label = "Password", confirmLabel = "Confirm password", disabled = false }: {
  passwordId: string; confirmId: string; password: string; confirm: string; disabled?: boolean;
  onPassword: (value: string) => void; onConfirm: (value: string) => void; label?: string; confirmLabel?: string;
}) {
  const [shown, setShown] = useState(false);
  const [confirmShown, setConfirmShown] = useState(false);
  return <div className="account-password-pair ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
    <label htmlFor={passwordId}>{label}</label>
    <div className="account-input"><input id={passwordId} name={passwordId} disabled={disabled} type={shown ? "text" : "password"} autoComplete="new-password" value={password} onChange={event => onPassword(event.target.value)} /></div>
    <label htmlFor={confirmId}>{confirmLabel}</label>
    <div className="account-input"><input id={confirmId} name={confirmId} disabled={disabled} type={confirmShown ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={event => onConfirm(event.target.value)} /></div>
    <button className="account-password-pair__toggle" type="button" disabled={disabled} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} aria-controls={passwordId} onClick={() => setShown(value => !value)}>{shown ? <EyeOffIcon /> : <EyeIcon />}</button>
    <button className="account-password-pair__toggle" type="button" disabled={disabled} aria-label={confirmShown ? "Hide confirm password" : "Show confirm password"} aria-pressed={confirmShown} aria-controls={confirmId} onClick={() => setConfirmShown(value => !value)}>{confirmShown ? <EyeOffIcon /> : <EyeIcon />}</button>
  </div>;
}
