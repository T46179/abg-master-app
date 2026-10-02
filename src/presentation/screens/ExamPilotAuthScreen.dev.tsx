import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createExamAuthClient, readExamAccess, readExamIdentity, requestExamCode, verifyExamCode, type ExamAccess } from "../../core/examAuth";
import ExamPilotRuntime from "../exam/ExamPilotRuntime.dev";
import "../exam/exam.css";
import "../exam/pilotAuth.css";

// Development-only harness. It deliberately cannot fall back to the app's
// production/Practice project when separate staging credentials are missing.
export default function ExamPilotAuthScreen() {
  const client = useMemo(() => {
    const url = import.meta.env.VITE_EXAM_PILOT_SUPABASE_URL;
    const key = import.meta.env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY;
    if (url !== "https://clpfecuohwzwrgmqzeos.supabase.co" || !key) return null;
    return createExamAuthClient(url, key);
  }, []);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [access, setAccess] = useState<ExamAccess | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange(() => { setRevision(n => n + 1); });
    return () => data.subscription.unsubscribe();
  }, [client]);
  useEffect(() => {
    if (!client) { setChecking(false); return; }
    let cancelled = false;
    setChecking(true);
    setAccess(null);
    setError("");
    void (async () => {
      try {
        const identity = await readExamIdentity(client);
        if (cancelled) return;
        setSignedIn(identity.status === "signed_in");
        setUserId(identity.status === "signed_in" ? identity.userId : "");
        if (identity.status === "signed_in") {
          setCode("");
          setSentTo("");
          const next = await readExamAccess(client);
          if (!cancelled) setAccess(next);
        }
      } catch {
        if (!cancelled) setError("We couldn’t check your sign-in or pilot access. Please try again.");
      } finally { if (!cancelled) setChecking(false); }
    })();
    return () => { cancelled = true; };
  }, [client, revision]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  function send(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    const recipient = email.trim();
    void run(async () => {
      await requestExamCode(client, recipient);
      if (mounted.current) { setSentTo(recipient); setCode(""); }
    });
  }
  function verify(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    void run(async () => {
      await verifyExamCode(client, sentTo, code);
      if (mounted.current) setRevision(n => n + 1);
    });
  }
  return <main className="app-shell__page exam-screen">
    {(!signedIn || access?.status !== "allowed" || error) && <section className="exam-pilot-auth surface">
      <h1>Exam pilot sign-in</h1>
      {!client ? <p>Staging sign-in is not configured for this local preview.</p> : <>
        {checking ? <p role="status">Checking sign-in…</p> : signedIn ? <>
          <p role="status">{access?.status === "allowed" ? "Your account has pilot access." : access?.status === "closed" ? "You’re signed in. The Exam pilot is not open yet." : access?.status === "not_invited" ? "You’re signed in, but this account does not have pilot access." : "You’re signed in. Pilot access has not been verified."}</p>
        </> : <>
          <p>Use the email address registered for your pilot invitation.</p>
          {!sentTo ? <form onSubmit={send}>
            <label htmlFor="exam-email">Email address</label>
            <input id="exam-email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
            <button className="exam-pilot-button exam-primary" disabled={busy}>{busy ? "Sending…" : "Send sign-in code"}</button>
          </form> : <form onSubmit={verify}>
            <p role="status">If this email is registered, a code has been sent to {sentTo}.</p>
            <label htmlFor="exam-code">Sign-in code</label>
            <input id="exam-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required value={code} disabled={busy} onChange={event => setCode(event.target.value)} />
            <button className="exam-pilot-button exam-primary" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
            <button className="exam-pilot-button" type="button" disabled={busy} onClick={() => { setSentTo(""); setCode(""); setError(""); }}>Change email or request another code</button>
          </form>}
        </>}
        {error && <div role="alert"><p>{error}</p><button className="exam-pilot-button" disabled={busy || checking} onClick={() => setRevision(n => n + 1)}>Retry access check</button></div>}
      </>}
    </section>}
    {client && signedIn && userId && <ExamPilotRuntime key={userId} client={client} userId={userId} canStart={access?.status === "allowed"} />}
  </main>;
}
