import { ExamRuntimeError } from "../../core/examRuntime";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import { AccountBrowserStorageProvider } from "../../app/AccountWorkspace";
import { useAppContext } from "../../app/AppProvider";
import { createAccountDataClient } from "../../core/accountDataClient";
import { readExamAccess, type ExamAccess } from "../../core/examAuth";
import { examOnboardingKey, loadExamOnboarding, readExamOnboardingProfile, saveExamOnboarding, saveExamOnboardingProfile, type ExamOnboarding, type ExamOnboardingProfile } from "../../core/examOnboarding";
import type { BrowserStorageLike } from "../../core/storage";
import { initialPrototypeState } from "../exam/mockData";
import { ExamOverview, ExamPageHeading } from "../exam/ExamDashboard";
import ExamPilotRuntime, { type ExamDashboardControls } from "../exam/ExamPilotRuntime";
import { AboutYou } from "./AboutYou.dev";
import { TrialProCard, TrialResultHero } from "./TrialComplete.dev";
import { AccountBack, AccountButton, AccountCard, AccountField, TrialStepper, type AccountPage } from "./AccountUi.dev";
import { CheckIcon, ClipboardIcon, SignOutIcon, UserIcon } from "./AccountIcons.dev";
import "../exam/exam.css";
import "./account.dev.css";
import { RegistrationPages } from "./RegistrationPages.dev";
import { PasswordRecoveryPages } from "./PasswordRecoveryPages.dev";
import { useRegistration } from "../../app/RegistrationProvider";
import { registrationDestination, registrationDestinationPath, type RegistrationDestination } from "../../core/registrationCallback";

import { accountPageFromPath, accountPageUrl } from "../../core/accountRoutes";

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
  const requested = accountPageFromPath(location.pathname) ?? query.get("account");
  const pages = ["exam", "signin", "signup", "checkEmail", "forgot", "reset", "link", "about", "setup", "start", "password", "completion"];
  const page = pages.includes(requested ?? "") ? requested as Page : "exam";
  const intent = destination === "trial" ? "trial" : "account";
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const inFlight = useRef(false);
  const resumedCodeEntry = useRef(false);
  const verified = identity.status === "verified" && Boolean(identity.userId);
  function open(next: Page, entry: "trial" | "account" = intent) {
    setError(""); const params = new URLSearchParams(location.search);
    if (entry === "trial") params.set("return_to", "trial");
    if (next !== "signin") params.delete("reauthenticate");
    void navigate(accountPageUrl(next, params.toString()));
  }
  // Keep saved links working while giving account pages their own canonical route.
  useEffect(() => {
    if (query.has("account") && accountPageFromPath(accountPageUrl(page).split("?")[0])) {
      void navigate(accountPageUrl(page, location.search), { replace: true });
    }
  }, [location.pathname, location.search, page, navigate]);
  useEffect(() => {
    if (page !== "checkEmail") { resumedCodeEntry.current = false; return; }
    if (resumedCodeEntry.current) return;
    resumedCodeEntry.current = true;
    if (flow.phase === "idle" && (registration.codeRequest() || registration.pending())) void registration.resume();
  }, [page, flow.phase, registration]);
  useEffect(() => {
    if (registration.emailPurpose() === "reset") return;
    const next = flow.phase === "awaiting_email" ? "checkEmail" : flow.phase === "password" ? "password" : null;
    if (next && (page !== next || query.get("return_to") !== flow.destination)) {
      const params = new URLSearchParams(location.search); params.set("return_to", flow.destination);
      void navigate(accountPageUrl(next, params.toString()), { replace: true });
    }
  }, [flow.phase, flow.destination, page, location.search, registration, navigate]);
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
    if (identity.status === "verified" && identity.email?.toLowerCase() !== email.trim().toLowerCase()
      && !window.confirm("Signing in will switch from " + identity.email + ". Saved work stays with its original account. Continue?")) return;
    inFlight.current = true; setBusy(true); setError("");
    try { registration.resetView(); await account.signIn(email, password); registration.confirmPasswordSignIn(email, destination); }
    catch { setError("Incorrect email or password"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  let body: ReactNode;
  const registrationActive = !["idle", "complete"].includes(flow.phase);
  const recoveryPage = ["forgot", "reset"].includes(page) || (registration.emailPurpose() === "reset" && registrationActive);
  const registrationPage = ["signup", "checkEmail", "password", "completion", "link"].includes(page);
  if (identity.status === "checking" || (identity.status === "unavailable" && !registrationActive && !["signin", "completion", "forgot", "reset"].includes(page))) {
    body = <div className="account-narrow"><AccountCard title="We couldn't check your account"><p>Your saved account has not been replaced.</p><AccountButton onClick={() => void account.refresh()}>Try again</AccountButton></AccountCard></div>;
  } else if (recoveryPage) {
    body = <div className="account-narrow ph-no-capture" data-clarity-mask="true" data-sentry-mask="true"><PasswordRecoveryPages page={page as AccountPage} destination={destination} onPage={next => {
      if (next !== "signin") { setPage(next); return; }
      const params = new URLSearchParams(location.search); params.set("account", "signin"); params.set("reauthenticate", "1");
      void navigate(accountPageUrl("signin", params.toString()));
    }} /></div>;
  } else if (registrationActive || registrationPage || identity.status === "unverified") {
    body = <div className="account-registration">{intent === "trial" && <TrialStepper step={0} />}
      <RegistrationPages page={registrationPage ? page as AccountPage : "link"} destination={destination} onPage={setPage} />
    </div>;
  } else if (page === "signin") {
    body = <div className="account-signin-layout">{intent === "trial" && <TrialStepper step={0} />}<SignInForm busy={busy} error={error} onSubmit={signIn} onPage={p => { registration.resetView(); open(p); }} /></div>;
  } else if (verified && identity.userId) {
    body = hasPassword !== true ? setupError
      ? <div className="account-narrow"><AccountCard title="We couldn't check account setup"><p role="status">Your account has not been replaced. Please retry.</p><AccountButton onClick={retrySetup}>Retry account check</AccountButton></AccountCard></div>
      : <div className="account-narrow account-setup-loading" role="status" aria-label="Checking account setup"><span className="loading-chip__spinner" aria-hidden="true" /></div>
      : <RuntimeOwner key={identity.generation} client={client} userId={identity.userId} generation={identity.generation} paid={paid} page={page} onPage={setPage} />;
  } else {
    body = <><ExamPageHeading guest /><div className="exam-workspace exam-mock-workspace exam-guest-workspace"><ExamOverview guest state={{ ...initialPrototypeState, mode: "mock", examKind: "mock", caseCount: 3 }} pressureUnit={state.sessionState?.pressureUnit ?? "mmHg"} /><TrialIntroduction signedIn={false} complete={false} onStart={startTrial} onSignIn={() => open("signin", "trial")} /></div></>;
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
  return <AccountCard className="account-entry-card" eyebrow="Welcome back" title="Sign in">
    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-clarity-mask="true" data-sentry-mask="true">
      <AccountField id="exam-signin-email" label="Email" placeholder="you@example.com" value={email} onChange={setEmail} error={emailError} disabled={busy} />
      <AccountField id="exam-signin-password" label="Password" password value={password} onChange={setPassword} error={error || (submitted && !password && !busy ? "Enter your password" : undefined)} disabled={busy} aside={<button type="button" className="account-link account-forgot-link" onClick={() => onPage("forgot")}>Forgot password?</button>} />
      <AccountButton className={"account-entry-submit" + (error ? " account-submit-rejected" : "")} showArrow={false} type="submit" busy={busy}>Sign In</AccountButton>
    </form><p className="account-footnote account-entry-footer">New to ABG Master? <button className="account-link" onClick={() => onPage("signup")}>Create account</button></p>
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
  return <div className="exam-account-control ph-no-capture" data-clarity-mask="true" data-sentry-mask="true" ref={ref}>
    <button ref={trigger} type="button" className="exam-account-trigger" aria-label={email ? `Account: ${email}` : "Sign in"} aria-expanded={email ? open : undefined} aria-controls={email ? "exam-account-menu" : undefined} disabled={!email && busy} onClick={() => { if (email) setOpen(v => !v); else onPage("signin"); }}>{email ? <span className="exam-account-avatar">{email.slice(0, 1).toUpperCase()}</span> : <><UserIcon /><span>Sign in</span></>}</button>
    {email && open && <section className="exam-account-menu" id="exam-account-menu" aria-label="Account">
      <strong className="account-private ph-no-capture" data-clarity-mask="true">{email}</strong><p>{paid ? "Paid account" : "Free account"}</p>
        <button type="button" className="account-menu-action" disabled={busy} onClick={() => { setOpen(false); onSignOut(); }}><SignOutIcon />Sign out</button>
        <div className="account-paid-control"><span>Local development</span><label><input type="checkbox" role="switch" checked={paid} disabled={active || busy} onChange={onPaid} />Paid account</label><small>Interface only. Existing pilot permissions still apply.</small></div>
    </section>}
  </div>;
}

function TrialIntroduction({ signedIn, complete, onStart, onSignIn }: { signedIn: boolean; complete: boolean; onStart: () => void; onSignIn?: () => void }) {
  const heading = !signedIn ? "Your first exam starts here" : complete ? "Your trial exam is almost ready" : "Let's make this yours";
  const cta = !signedIn ? "Create your free account" : complete ? "Setup my trial exam" : "Complete your profile";
  return <aside className="account-trial-panel surface"><span className="account-eyebrow">Trial Exam</span><div className="account-panel-heading"><span><ClipboardIcon /></span><div><h3>{heading}</h3><p>Just a few details first</p></div></div>
    <ol className="account-trial-steps">{[[signedIn ? "Signed in" : "Create your free account", signedIn ? "Your account is ready." : "Or sign in to continue where you left off"], ["Tell us a little about yourself", "Personalise your experience"], ["Prepare your trial exam", "Review your settings before you begin"]].map(([title, body], i) => {
      const completed = (i === 0 && signedIn) || (i === 1 && complete);
      return <li key={title} data-complete={completed}><span>{completed ? <CheckIcon size={13} /> : i + 1}</span><div><strong>{title}</strong><p>{body}</p></div></li>;
    })}</ol>
    <AccountButton onClick={onStart}>{cta}</AccountButton>
    {!signedIn && <p className="account-footnote account-trial-signin">Already have an account? <button className="account-link" onClick={onSignIn}>Sign in</button></p>}
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
  const [draft, setDraft] = useState(() => loadExamOnboarding(storage, STAGING, userId));
  const [storageError, setStorageError] = useState(false);
  const [profile, setProfile] = useState<ExamOnboardingProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [profileRevision, setProfileRevision] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [profileConflict, setProfileConflict] = useState(false);
  const profileSaveInFlight = useRef(false);
  const currentPage = useRef(page);
  currentPage.current = page;

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setProfileError(false);
    void readExamOnboardingProfile(ownedClient).then(saved => {
      if (cancelled || !isCurrent()) return;
      setProfile(saved);
      if (saved.answers) {
        setDraft(saved.answers);
        try { storage.removeItem(examOnboardingKey(STAGING, userId)); } catch { /* The saved profile remains authoritative. */ }
        setStorageError(false);
      }
      setProfileConflict(false);
      setSaveError("");
    }).catch(() => { if (!cancelled && isCurrent()) setProfileError(true); });
    return () => { cancelled = true; };
  }, [ownedClient, isCurrent, storage, userId, profileRevision]);
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
  function updateDraft(value: ExamOnboarding) {
    if (!isCurrent()) return;
    const next = { ...value, complete: false };
    setDraft(next);
    setStorageError(!saveExamOnboarding(storage, STAGING, userId, next));
  }
  function reloadProfile() { setProfileRevision(n => n + 1); }
  async function completeProfile(value: ExamOnboarding) {
    if (!profile || profileConflict || profileSaveInFlight.current || !isCurrent()) return;
    profileSaveInFlight.current = true;
    setSavingProfile(true);
    setSaveError("");
    updateDraft(value);
    try {
      const saved = await saveExamOnboardingProfile(ownedClient, profile.revision, value);
      if (!isCurrent()) return;
      setProfile(saved);
      if (saved.answers) setDraft(saved.answers);
      try { storage.removeItem(examOnboardingKey(STAGING, userId)); } catch { /* The profile was saved. */ }
      setStorageError(false);
      if (currentPage.current === page) onPage("setup");
    } catch (cause) {
      if (!isCurrent()) return;
      const conflict = cause instanceof ExamRuntimeError && cause.code === "EXAM_ONBOARDING_CONFLICT";
      setProfileConflict(conflict);
      setSaveError(conflict ? "Your profile was updated elsewhere. Reload your saved answers before editing again." : "We couldn’t save your answers. Please try again.");
    } finally {
      profileSaveInFlight.current = false;
      if (isCurrent()) setSavingProfile(false);
    }
  }
  function renderDashboard(controls: ExamDashboardControls) {
    if ((paid && access?.canStartStandard === true) || controls.canRecover) return controls.fullSetup;
    const lifecycle = controls.trialLifecycle;
    if (lifecycle?.state === "consumed") return controls.withSetup(<TrialProCard />, <TrialResultHero result={controls.completedTrial} />);
    if (!lifecycle || lifecycle.state === "reserved") {
      return controls.withSetup(<aside className="account-trial-panel surface" aria-label="Trial exam status">
        <span className="account-eyebrow">Trial Exam</span>
        <h3>{!lifecycle ? "Checking your trial" : lifecycle.requiresSupport ? "Your marking needs assistance" : lifecycle.gradingStatus === "failed" ? "Your marking needs another try" : "Your exam is being marked"}</h3>
        <p role="status">{!lifecycle ? "We couldn’t confirm your trial status. Please try again." : lifecycle.requiresSupport ? "Your answers are saved. Please contact us so we can review the marking problem." : lifecycle.gradingStatus === "failed" ? "Your answers are saved. Open your result to check marking and retry when available." : "Your answers are saved. You can review your exam while marking finishes."}</p>
        {lifecycle?.attemptId ? <AccountButton onClick={controls.openTrialResult}>Latest result</AccountButton> : <AccountButton onClick={controls.refreshTrial}>Retry</AccountButton>}
      </aside>);
    }
    if (!profile) {
      const status = <AccountCard title={profileError ? "We couldn’t load your profile" : "Checking your profile"}>
        {profileError ? <><p role="alert">Try again to continue to trial setup.</p><AccountButton onClick={reloadProfile}>Retry</AccountButton></> : <p role="status">Checking saved answers…</p>}
      </AccountCard>;
      return page === "exam" ? controls.withSetup(status) : <div className="account-onboarding"><AccountBack onBack={() => onPage("exam")} />{status}</div>;
    }
    const complete = profile.completedAt !== null;
    const next = page === "start" || (page === "setup" && !complete) ? (complete ? "setup" : "about") : page;
    if (next === "about") return <div className="account-onboarding"><AccountBack onBack={() => onPage("exam")} /><TrialStepper step={1} onStep={() => { document.querySelector<HTMLFormElement>(".account-onboarding form")?.requestSubmit(); }} /><AboutYou value={draft} onChange={updateDraft} storageError={storageError} saving={savingProfile} saveError={saveError} onReloadSaved={profileConflict ? reloadProfile : undefined} onDone={value => void completeProfile(value)} /></div>;
    if (next === "setup") return <div className="account-onboarding account-trial-onboarding"><AccountBack onBack={() => onPage("exam")} /><TrialStepper step={2} onStep={() => onPage("about")} />{controls.trialSetup}<p className="account-footnote account-trial-later"><button type="button" className="account-link" onClick={() => onPage("exam")}>Do this later</button></p></div>;
    return controls.withSetup(<TrialIntroduction signedIn complete={complete} onStart={() => onPage("start")} />);
  }
  if (accessError) return <div className="account-narrow"><AccountCard title="We couldn't check Exam access"><p role="alert">Your account has not been changed. Reconnect and retry.</p><AccountButton onClick={() => setRevision(n => n + 1)}>Retry access check</AccountButton></AccountCard></div>;
  if (!access) return <p role="status">Checking Exam access…</p>;
  return <AccountBrowserStorageProvider value={storage}>
    {access.status === "closed" && <p role="status" className="account-notice">You're signed in. The Exam pilot is not open yet.</p>}
    <ExamPilotRuntime onReturnToDashboard={() => onPage("exam")} trialAccessMessage={access.status === "closed" ? "The Exam pilot is currently closed." : undefined} trialAvailability={access.trialAvailability ?? "error"} onRetryTrial={() => setRevision(n => n + 1)} client={ownedClient} userId={userId} canStartStandard={access.canStartStandard === true} limitedDashboard={!paid || access.canStartStandard !== true} canStart={access.status === "allowed"} allowedUnitCounts={paid ? access.allowedUnitCounts : access.allowedUnitCounts.filter(n => n === 3)} customisationCategories={paid ? access.customisationCategories : []} renderDashboard={renderDashboard} />
  </AccountBrowserStorageProvider>;
}
