import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import { AccountBrowserStorageProvider } from "../../app/AccountWorkspace";
import { useAppContext } from "../../app/AppProvider";
import { createAccountDataClient } from "../../core/accountDataClient";
import { readExamAccess, type ExamAccess } from "../../core/examAuth";
import { loadExamOnboarding, saveExamOnboarding, type ExamOnboarding } from "../../core/examOnboarding";
import type { BrowserStorageLike } from "../../core/storage";
import { initialPrototypeState } from "../exam/mockData";
import { ExamOverview, ExamPageHeading } from "../exam/ExamDashboard";
import ExamPilotRuntime, { type ExamDashboardControls } from "../exam/ExamPilotRuntime";
import { AboutYou } from "./AboutYou.dev";
import { AccountAside, AccountBack, AccountButton, AccountCard, AccountField, TrialStepper, type AccountPage } from "./AccountUi.dev";
import { CheckIcon, ClipboardIcon, SignOutIcon, UserIcon } from "./AccountIcons.dev";
import "../exam/exam.css";
import "./account.dev.css";
import { RegistrationPages } from "./RegistrationPages.dev";
import { PasswordRecoveryPages } from "./PasswordRecoveryPages.dev";
import { useRegistration } from "../../app/RegistrationProvider";
import { registrationDestination, registrationDestinationPath, type RegistrationDestination } from "../../core/registrationCallback";

const STAGING = "https://clpfecuohwzwrgmqzeos.supabase.co";
type Page = AccountPage | "start";

export default function ExamAccountExperience() {
  const { client } = useSiteAccount();
  return <AccountExperience client={client} />;
}
function AccountExperience({ client }: { client: SupabaseClient }) {
  const { account, identity } = useSiteAccount();
  const { state } = useAppContext();
  const { registration, registrationState: flow, paid, hasPassword, setupError, retrySetup } = useRegistration();
  const navigate = useNavigate(); const location = useLocation();
  const query = new URLSearchParams(location.search);
  const destination = registrationDestination(query.get("return_to"));
  const requested = query.get("account");
  const pages = ["exam", "signin", "signup", "checkEmail", "forgot", "reset", "link", "about", "setup", "start", "password", "completion"];
  const page = pages.includes(requested ?? "") ? requested as Page : "exam";
  const intent = destination === "trial" ? "trial" : "account";
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const inFlight = useRef(false);
  const verified = identity.status === "verified" && Boolean(identity.userId);
  function open(next: Page, entry: "trial" | "account" = intent) {
    setError(""); const params = new URLSearchParams(location.search);
    if (next === "exam") params.delete("account"); else params.set("account", next);
    if (entry === "trial") params.set("return_to", "trial");
    if (next !== "signin") params.delete("reauthenticate");
    void navigate(location.pathname + (params.size ? "?" + params.toString() : ""));
  }
  function setPage(next: Page) { open(next); }
  function finish(target: RegistrationDestination) {
    registration.resetView();
    if (target === "trial") open("start", "trial");
    else if (target === "exam") open("exam", "account");
    else void navigate(registrationDestinationPath(target));
  }
  useEffect(() => {
    if (flow.phase === "complete" && flow.completedUserId === identity.userId && flow.completedGeneration === identity.generation) finish(flow.destination);
    else if (verified && hasPassword === true && flow.phase === "idle" && page === "signin" && query.get("reauthenticate") !== "1") finish(destination);
  }, [flow.phase, verified, hasPassword, page, location.search]);
  useEffect(() => {
    if (verified && hasPassword === false && flow.phase === "idle" && !["forgot", "reset"].includes(page)) void registration.resumeVerified();
  }, [verified, hasPassword, flow.phase, registration, page]);
  function startTrial() {
    if (verified) open("start", "trial");
    else if (registration.pending()) { open("checkEmail", "trial"); void registration.resume(); }
    else open("signup", "trial");
  }
  async function signIn(email: string, password: string) {
    if (inFlight.current) return;
    if (identity.status === "guest" && (state.userState.xp > 0 || state.userState.casesCompleted > 0 || state.userState.calibrationCompleted || state.practiceState.currentCase || state.practiceState.pendingSubmission)
      && !window.confirm("Signing into an existing account loads its own progress. Your guest progress will not be merged and may no longer be accessible. Continue?")) return;
    if (identity.status === "verified" && identity.email?.toLowerCase() !== email.trim().toLowerCase()
      && !window.confirm("Signing in will switch from " + identity.email + ". Saved work stays with its original account. Continue?")) return;
    inFlight.current = true; setBusy(true); setError("");
    try { registration.resetView(); await account.signIn(email, password); registration.confirmPasswordSignIn(email, destination); }
    catch { setError("Sign-in could not be completed. Check your details or finish setting up your account."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  let body: ReactNode;
  const registrationActive = !["idle", "complete"].includes(flow.phase);
  const recoveryPage = ["forgot", "reset"].includes(page) || (registration.emailPurpose() === "reset" && registrationActive);
  const registrationPage = ["signup", "checkEmail", "password", "completion", "link"].includes(page);
  if (identity.status === "checking" || (identity.status === "unavailable" && !registrationActive && !["signin", "completion", "forgot", "reset"].includes(page))) {
    body = <div className="account-narrow"><AccountCard title="We couldn't check your account"><p>Your saved account has not been replaced.</p><AccountButton onClick={() => void account.refresh()}>Try again</AccountButton></AccountCard></div>;
  } else if (recoveryPage) {
    body = <div className="account-narrow ph-no-capture" data-clarity-mask="true" data-sentry-mask="true"><AccountBack onBack={() => { registration.resetView(); setPage("exam"); }} /><PasswordRecoveryPages page={page as AccountPage} destination={destination} onPage={next => {
      if (next !== "signin") { setPage(next); return; }
      const params = new URLSearchParams(location.search); params.set("account", "signin"); params.set("reauthenticate", "1");
      void navigate(location.pathname + "?" + params.toString());
    }} /></div>;
  } else if (registrationActive || registrationPage || identity.status === "unverified") {
    body = <div className="account-narrow"><AccountBack onBack={() => { registration.resetView(); setPage("exam"); }} />{intent === "trial" && <TrialStepper step={0} />}
      <RegistrationPages page={registrationPage ? page as AccountPage : "link"} destination={destination} onPage={setPage} />
      <p className="account-footnote"><button className="account-link" onClick={() => void navigate("/practice")}>Continue to Practice</button></p>
    </div>;
  } else if (page === "signin") {
    body = <div className="account-auth-layout"><div><AccountBack onBack={() => setPage("exam")} />{intent === "trial" && <TrialStepper step={0} />}<SignInForm busy={busy} error={error} onSubmit={signIn} onPage={p => { registration.resetView(); open(p); }} /></div><AccountAside trial={intent === "trial"} /></div>;
  } else if (verified && identity.userId) {
    body = hasPassword !== true ? <div className="account-narrow"><AccountCard title={setupError ? "We couldn't check account setup" : "Checking account setup"}><p role="status">{setupError ? "Your account has not been replaced. Please retry." : "Please wait while we check your account."}</p>{setupError && <AccountButton onClick={retrySetup}>Retry account check</AccountButton>}</AccountCard></div>
      : <RuntimeOwner key={identity.generation} client={client} userId={identity.userId} generation={identity.generation} paid={paid} page={page} onPage={setPage} />;
  } else {
    body = <><ExamPageHeading /><div className="exam-workspace exam-mock-workspace"><ExamOverview state={{ ...initialPrototypeState, mode: "mock", examKind: "mock", caseCount: 3 }} pressureUnit={state.sessionState?.pressureUnit ?? "mmHg"} /><TrialIntroduction signedIn={false} complete={false} onStart={startTrial} onSignIn={() => open("signin", "trial")} /></div></>;
  }
  return <main className="app-shell__page exam-screen abg-account">{body}</main>;
}

function SignInForm({ busy, error, onSubmit, onPage }: { busy: boolean; error: string; onSubmit: (email: string, password: string) => Promise<void>; onPage: (page: AccountPage) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [submitted, setSubmitted] = useState(false);
  const emailError = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address" : undefined;
  function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { document.getElementById("exam-signin-email")?.focus(); return; }
    if (!password) { document.getElementById("exam-signin-password")?.focus(); return; }
    const value = password; setPassword(""); void onSubmit(email, value);
  }
  return <AccountCard eyebrow="Welcome back" title="Sign in"><p>Sign in to pick up where you left off, on any device.</p>
    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
      {error && <div role="alert" className="account-notice account-field-error">{error}</div>}
      <AccountField id="exam-signin-email" label="Email" value={email} onChange={setEmail} error={emailError} disabled={busy} />
      <AccountField id="exam-signin-password" label="Password" password value={password} onChange={setPassword} error={submitted && !password && !busy ? "Enter your password" : undefined} disabled={busy} aside={<button type="button" className="account-link" onClick={() => onPage("forgot")}>Forgot password?</button>} />
      <AccountButton type="submit" busy={busy}>Sign in</AccountButton>
    </form><p className="account-footnote">New to ABG Master? <button className="account-link" onClick={() => onPage("signup")}>Create account</button></p>
    <p className="account-footnote"><button className="account-link" onClick={() => onPage("completion")}>Verified your email but need a password? Finish account setup</button></p>
  </AccountCard>;
}

export function ProfileControl({ email, busy, paid, active, onPage, onSignOut, onPaid }: { email: string | null; busy: boolean; paid: boolean; active: boolean; onPage: (page: AccountPage) => void; onSignOut: () => void; onPaid: () => void }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [email]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLButtonElement>(".exam-account-menu button")?.focus();
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  function go(page: AccountPage) { setOpen(false); onPage(page); }
  return <div className="exam-account-control ph-no-capture" data-clarity-mask="true" data-sentry-mask="true" ref={ref}>
    <button ref={trigger} type="button" className="exam-account-trigger" aria-label={email ? `Account: ${email}` : "Sign in or create an account"} aria-expanded={open} aria-controls="exam-account-menu" onClick={() => setOpen(v => !v)}>{email ? <span className="exam-account-avatar">{email.slice(0, 1).toUpperCase()}</span> : <><UserIcon /><span>Sign in</span></>}</button>
    {open && <section className="exam-account-menu" id="exam-account-menu" aria-label="Account">
      {email ? <><strong className="account-private ph-no-capture" data-clarity-mask="true">{email}</strong><p>{paid ? "Paid account" : "Free account"}</p>
        <button type="button" className="account-menu-action" disabled={busy} onClick={() => { setOpen(false); onSignOut(); }}><SignOutIcon />Sign out</button>
        <div className="account-paid-control"><span>Local development</span><label><input type="checkbox" role="switch" checked={paid} disabled={active || busy} onChange={onPaid} />Paid account</label><small>Interface only. Existing pilot permissions still apply.</small></div></>
        : <><strong>Your ABG Master account</strong><button className="account-menu-action" disabled={busy} onClick={() => go("signin")}>Sign in</button><button className="account-menu-action" disabled={busy} onClick={() => go("signup")}>Create account</button></>}
    </section>}
  </div>;
}

function TrialIntroduction({ signedIn, complete, onStart, onSignIn }: { signedIn: boolean; complete: boolean; onStart: () => void; onSignIn?: () => void }) {
  return <aside className="account-trial-panel surface"><span className="account-eyebrow">Free trial</span><div className="account-panel-heading"><span><ClipboardIcon /></span><div><h3>How your trial works</h3><p>A couple of minutes, then you're in.</p></div></div>
    <ol className="account-trial-steps">{[[signedIn ? "Signed in" : "Create a free account", signedIn ? "Your account is ready." : "Or sign in. Your progress stays with your account."], ["Tell us a little about yourself", "A few quick questions about your background."], ["Set up your sitting", "Pick your settings, then begin."]].map(([title, body], i) => <li key={title}><span>{(i === 0 && signedIn) || (i === 1 && complete) ? <CheckIcon size={13} /> : i + 1}</span><div><strong>{title}</strong><p>{body}</p></div></li>)}</ol>
    <AccountButton onClick={onStart}>Start trial exam</AccountButton>
    {!signedIn && <p className="account-footnote">Already have an account? <button className="account-link" onClick={onSignIn}>Sign in</button></p>}
    {signedIn && <p className="account-footnote">Local trial presentation uses ordinary pilot attempts. Trial limits are not active yet.</p>}
  </aside>;
}

function RuntimeOwner({ client, userId, generation, paid, page, onPage }: { client: SupabaseClient; userId: string; generation: number; paid: boolean; page: Page; onPage: (page: Page) => void }) {
  const { account } = useSiteAccount();
  const config = useMemo(() => ({ SUPABASE_URL: STAGING, SUPABASE_ANON_KEY: import.meta.env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY }), []);
  const isCurrent = useCallback(() => account.isCurrent(generation, userId), [account, generation, userId]);
  const ownedClient = useMemo(() => createAccountDataClient(config, client, userId, isCurrent, fetch, () => { void account.refresh(); }), [config, client, userId, isCurrent]);
  const storage = useMemo<BrowserStorageLike>(() => ({
    getItem: key => isCurrent() ? localStorage.getItem(key) : null,
    setItem: (key, value) => { if (isCurrent()) localStorage.setItem(key, value); },
    removeItem: key => { if (isCurrent()) localStorage.removeItem(key); }
  }), [isCurrent]);
  const [access, setAccess] = useState<ExamAccess | null>(null); const [accessError, setAccessError] = useState(false); const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(() => loadExamOnboarding(storage, STAGING, userId)); const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let cancelled = false; setAccessError(false);
    void readExamAccess(ownedClient).then(next => { if (!cancelled && isCurrent()) setAccess(next); }).catch(() => { if (!cancelled && isCurrent()) setAccessError(true); });
    return () => { cancelled = true; };
  }, [ownedClient, isCurrent, revision]);
  useEffect(() => {
    const refresh = () => { void account.refresh(); setRevision(n => n + 1); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [account]);
  function save(value: ExamOnboarding) {
    if (!isCurrent()) return false;
    setDraft(value); const saved = saveExamOnboarding(storage, STAGING, userId, value); setStorageError(!saved); return saved;
  }
  function renderDashboard(controls: ExamDashboardControls) {
    if (paid || controls.canRecover) return controls.fullSetup;
    const next = page === "start" ? draft.complete ? "setup" : "about" : page;
    if (next === "about") return <div className="account-onboarding"><AccountBack onBack={() => onPage("exam")} /><TrialStepper step={1} /><AboutYou value={draft} onChange={value => { save(value); }} storageError={storageError} onDone={value => { if (save(value)) onPage("setup"); }} /></div>;
    if (next === "setup") return <><AccountBack onBack={() => onPage("exam")} /><div className="account-narrow-step"><TrialStepper step={2} /></div>{controls.withSetup(<aside className="account-trial-panel surface"><span className="account-eyebrow">Trial exam · free account</span><h3>Your trial sitting</h3><p>Choose your timer and reference ranges, then begin when you're ready.</p><p className="account-trial-count"><strong>3</strong> cases · server-assigned pilot paper</p><label className="account-setting">Show timer<input type="checkbox" role="switch" checked={controls.timed} onChange={event => controls.setTimed(event.target.checked)} disabled={controls.busy} /></label><label className="account-setting">Reference ranges<input type="checkbox" role="switch" checked={controls.showRanges} onChange={event => controls.setShowRanges(event.target.checked)} disabled={controls.busy} /></label><AccountButton disabled={!controls.canBegin} onClick={controls.begin}>Begin trial exam</AccountButton><p className="account-footnote">This uses the current pilot runtime. No trial allowance is consumed.</p></aside>)}</>;
    return controls.withSetup(<TrialIntroduction signedIn complete={draft.complete} onStart={() => onPage("start")} />);
  }
  if (accessError) return <div className="account-narrow"><AccountCard title="We couldn't check Exam access"><p role="alert">Your account has not been changed. Reconnect and retry.</p><AccountButton onClick={() => setRevision(n => n + 1)}>Retry access check</AccountButton></AccountCard></div>;
  if (!access) return <p role="status">Checking Exam access…</p>;
  return <AccountBrowserStorageProvider value={storage}>
    {access.status !== "allowed" && <p role="status" className="account-notice">{access.status === "closed" ? "You're signed in. The Exam pilot is not open yet." : "You're signed in, but this account does not have pilot access."}</p>}
    {access.status === "allowed" && !paid && !access.allowedUnitCounts.includes(3) && <p role="status" className="account-notice">The three-case trial is unavailable for this pilot account. Existing saved attempts remain accessible.</p>}
    <ExamPilotRuntime client={ownedClient} userId={userId} canStart={access.status === "allowed"} allowedUnitCounts={paid ? access.allowedUnitCounts : access.allowedUnitCounts.filter(n => n === 3)} customisationCategories={paid ? access.customisationCategories : []} renderDashboard={renderDashboard} />
  </AccountBrowserStorageProvider>;
}
