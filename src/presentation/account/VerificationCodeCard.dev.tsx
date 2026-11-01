import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRegistration } from "../../app/RegistrationProvider";
import { AccountButton, AccountCard } from "./AccountUi.dev";

export function VerificationCodeCard({ onChangeEmail, onStart }: { onChangeEmail: () => void; onStart: () => void }) {
  const { registration: r, registrationState: flow } = useRegistration();
  const request = r.codeRequest();
  const [code, setCode] = useState("");
  const [validation, setValidation] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [now, setNow] = useState(Date.now);
  const input = useRef<HTMLInputElement>(null);
  const busy = r.isBusy();
  const cooldown = Math.max(0, Math.ceil(((request?.resendAvailableAt ?? 0) - now) / 1000));
  useEffect(() => {
    setCode(""); setValidation(""); setNow(Date.now());
  }, [request?.email, request?.sentAt]);
  useEffect(() => {
    if (!request || Date.now() >= request.resendAvailableAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [request?.resendAvailableAt]);
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setValidation("");
    if (!/^[0-9]{6,10}$/.test(code)) {
      setValidation("Enter the verification code from your email.");
      setAttempts(value => value + 1); input.current?.focus(); return;
    }
    await r.verifyCode(code);
    if (r.getSnapshot().phase === "error") { setAttempts(value => value + 1); input.current?.focus(); input.current?.select(); }
  }
  const error = validation || flow.error;
  return <AccountCard className="account-entry-card account-verification-card" eyebrow="Check your inbox" title={request?.purpose === "complete" ? "Finish creating your account" : "Verify your email"}>
    {!request ? <><p className="account-entry-intro">Enter your email address to request a verification code.</p><AccountButton className="account-entry-submit" showArrow={false} onClick={onStart}>Create your account</AccountButton></> : <>
      <p className="account-entry-intro">{request.purpose === "complete" ? "If this account can continue registration, we'll send a verification code to " : "We have sent a verification code to "}<span className="account-address ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">{request.email}</span>.</p>
      <p className="account-entry-intro">Enter the code below to continue. You may need to check your spam folder. The code will expire in 1 hour.</p>
      <form noValidate onSubmit={verify} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
        <div className="account-field">
          <label htmlFor="registration-code">Verification code</label>
          <div className="account-input" data-invalid={Boolean(error)}><input ref={input} id="registration-code" name="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, "")); setValidation(""); }} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? "registration-code-error" : undefined} /></div>
          {error && <p id="registration-code-error" className="account-field-error" role="alert">{error}</p>}
        </div>
        <AccountButton key={attempts} className={"account-entry-submit" + (attempts ? " account-submit-rejected" : "")} showArrow={false} disabled={busy} type="submit">{busy ? "Please wait…" : "Verify email"}</AccountButton>
      </form>
      <div className="account-code-links"><button type="button" className="account-link" disabled={busy || cooldown > 0} onClick={() => void (request.purpose === "complete" ? r.completionEmail(request.email, request.destination) : r.resend())}>{cooldown > 0 ? "Resend code (" + cooldown + "s)" : "Resend code"}</button>
        <button type="button" className="account-link" disabled={busy} onClick={onChangeEmail}>Change email</button></div>
    </>}
  </AccountCard>;
}
