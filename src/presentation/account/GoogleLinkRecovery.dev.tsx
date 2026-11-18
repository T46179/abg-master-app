import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GoogleCandidate } from "../../core/googleAccount";
import { AccountButton, AccountCard, AccountField } from "./AccountUi.dev";

type VerifyCode = (code: string) => Promise<GoogleCandidate>;

export function GoogleLinkRecovery({ requestCode, onCandidate, onGoogle, onCancel }: {
  requestCode?: (email: string) => Promise<VerifyCode>;
  onCandidate: (candidate: GoogleCandidate) => void;
  onGoogle: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verify, setVerify] = useState<VerifyCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestCode || busy) return;
    setError("");
    setBusy(true);
    try {
      if (verify) {
        const candidate = await verify(code.trim());
        if (active.current) onCandidate(candidate);
        else await candidate.cancel();
      } else {
        const next = await requestCode(email.trim());
        if (active.current) setVerify(() => next);
      }
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "Sign-in couldn’t finish. Try again.");
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return <div className="account-narrow ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
    <AccountCard title="You already have an account" className="account-entry-card account-google-recovery">
      <p className="account-entry-intro">This Google account is already registered with ABG Master. Sign in to continue where you left off.</p>
      {requestCode ? <form className="account-form" onSubmit={event => void submit(event)}>
        {verify
          ? <><p>Enter the sign-in code sent to <strong>{email.trim()}</strong>.</p>
            <label htmlFor="google-existing-code">Sign-in code</label>
            <input id="google-existing-code" autoComplete="one-time-code" inputMode="numeric"
              pattern="[0-9]{6,10}" required value={code} disabled={busy} onChange={event => setCode(event.target.value)} /></>
          : <AccountField id="google-existing-email" label="Email on your existing account"
            value={email} onChange={setEmail} disabled={busy} />}
        {error && <p role="alert">{error}</p>}
        <AccountButton type="submit" busy={busy} disabled={!email.trim()}>{verify ? "Verify sign-in code" : "Send me a sign-in code"}</AccountButton>
        {verify && <button type="button" className="account-link" disabled={busy} onClick={() => {
          setVerify(null); setCode(""); setError("");
        }}>Request a new code</button>}
      </form> : <AccountButton className="account-entry-submit" showArrow={false} onClick={onGoogle}>Sign in with Google</AccountButton>}
      <p className="account-entry-footer"><button type="button" className="account-link" onClick={() => {
        active.current = false;
        onCancel();
      }}>Stay as guest</button></p>
    </AccountCard>
  </div>;
}
