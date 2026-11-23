import { ExamRuntimeError, type ExamRuntimeSession } from "../../core/examRuntime";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSiteAccount } from "../../app/SiteAccountProvider";
import { AccountWaiting } from "../shared/AccountWaiting";
import { AccountBrowserStorageProvider, useAccountBrowserStorage } from "../../app/AccountWorkspace";
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
import { clearGoogleAttempt, type GoogleCandidate, type GoogleReturn } from "../../core/googleAccount";
import { GoogleButton } from "./GoogleButton.dev";
import { hasUnfinishedPracticeAnswers, readLocalGuestProgress } from "../../core/registrationProgress";
import { loadPendingPracticeSubmission } from "../../core/protectedPracticeCache";
import { GoogleLinkRecovery } from "./GoogleLinkRecovery.dev";

import { accountPageFromPath, accountPageUrl } from "../../core/accountRoutes";
import { isLocalDrillPreview, loadLocalDrill } from "../../dev/examDrillsPreviewClient";

const STAGING = "https://clpfecuohwzwrgmqzeos.supabase.co";
type Page = AccountPage | "start";

export default function ExamAccountExperience() {
  const { client } = useSiteAccount();
  return <AccountExperience client={client} />;
}
function AccountExperience({ client }: { client: SupabaseClient }) {
  const { account, identity } = useSiteAccount();
  const { state, syncBeforeAccountSwitch, checkGuestProgress, hasPendingAccountSwitchWork, retryAccountBootstrap } = useAppContext();
  const browserStorage = useAccountBrowserStorage();
  const latestState = useRef(state);
  latestState.current = state;
  const { registration, registrationState: flow, paid, accountReady, setupError, retrySetup, google, takeGoogleCompletion } = useRegistration();
  const navigate = useNavigate(); const location = useLocation();
  const query = new URLSearchParams(location.search);
  const destination = registrationDestination(query.get("return_to"));
  const requested = accountPageFromPath(location.pathname) ?? query.get("account");
  const pages = ["exam", "signin", "signup", "checkEmail", "forgot", "reset", "link", "about", "setup", "start", "password", "completion"];
  const page = pages.includes(requested ?? "") ? requested as Page : "exam";
  const intent = destination === "trial" ? "trial" : "account";
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const inFlight = useRef(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleInFlight = useRef(false);
  const mounted = useRef(false);
  const pendingGoogle = useRef<GoogleCandidate | null>(null);
  const [candidate, setCandidate] = useState<GoogleCandidate | null>(null);
  const [linkConflict, setLinkConflict] = useState<GoogleReturn | null>(null);
  const [googleNotice, setGoogleNotice] = useState("");
  const [switchPhase, setSwitchPhase] = useState<"checking" | "confirm" | "progress" | "practice" | "exam">("checking");
  const switchConfirmed = useRef(false);
  const hadGuestProgress = useRef(false);
  const [verifiedGuestProgress, setVerifiedGuestProgress] = useState<{ userId: string; meaningful: boolean } | null>(null);
  const [waitingAttempt, setWaitingAttempt] = useState(0);
  const resumedCodeEntry = useRef(false);
  const verified = identity.status === "verified" && Boolean(identity.userId);
  const guest = identity.status === "guest";
  const localGuestProgress = guest && state.userId === identity.userId && state.status === "ready"
    ? readLocalGuestProgress(browserStorage, state.userState, Boolean(hasUnfinishedPracticeAnswers(state.practiceState, state.sessionState) ||
      state.practiceState.pendingSubmission || state.calibrationState.localCompletion || readExamWork(identity.userId)))
    : null;
  const guestProgress = localGuestProgress === false
    ? verifiedGuestProgress?.userId === identity.userId ? verifiedGuestProgress?.meaningful ?? null : null
    : localGuestProgress;
  useEffect(() => {
    if ((page !== "signin" && page !== "signup") || candidate || localGuestProgress !== false ||
        !identity.userId || !checkGuestProgress) return;
    let cancelled = false;
    const userId = identity.userId;
    setVerifiedGuestProgress(null);
    void checkGuestProgress(userId).then(meaningful => {
      if (!cancelled && meaningful !== null) setVerifiedGuestProgress({ userId, meaningful });
    });
    return () => { cancelled = true; };
  }, [page, candidate, localGuestProgress, identity.userId, checkGuestProgress, state.calibrationState.remoteStatus]);
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
  function finish(target: RegistrationDestination, savedGuestProgressFor?: string) {
    registration.resetView();
    if (target === "trial") open("start", "trial");
    else if (target === "exam") open("exam", "account");
    else void navigate(registrationDestinationPath(target), { state: savedGuestProgressFor ? { savedGuestProgressFor } : undefined });
  }
  useEffect(() => {
    if (flow.phase === "complete" && flow.completedUserId === identity.userId && flow.completedGeneration === identity.generation) finish(flow.destination);
    else if (!googleBusy && !candidate && verified && accountReady === true && flow.phase === "idle" && page === "signin" && query.get("reauthenticate") !== "1") finish(destination);
  }, [flow.phase, verified, accountReady, page, location.search, googleBusy, candidate]);
  useEffect(() => {
    if (!googleBusy && !candidate && verified && accountReady === false && flow.phase === "idle" && !["forgot", "reset"].includes(page)) void registration.resumeVerified();
  }, [verified, accountReady, flow.phase, registration, page, googleBusy, candidate]);

  function googleFailure(message: string, callback?: GoogleReturn) {
    setGoogleNotice(message);
    if (!callback) return;
    registration.resetView();
    const params = new URLSearchParams({ return_to: callback.attempt.destination });
    if (callback.attempt.action === "signin") params.set("reauthenticate", "1");
    void navigate(accountPageUrl(callback.attempt.action === "signin" ? "signin" : "signup", params.toString()), { replace: true });
  }

  async function adoptGoogle(result: GoogleCandidate, beforeCommit?: () => boolean, notice?: string) {
    const returnLocation = window.location.href;
    // Changing owner remounts the Exam shell. Finish from the committed result,
    // including when the old owner's screen has already unmounted.
    const adopted = await result.adopt(beforeCommit);
    if (!adopted) return;
    pendingGoogle.current = null;
    if (notice) setGoogleNotice(notice);
    await account.refresh();
    if (window.location.href !== returnLocation) return;
    retrySetup();
    finish(result.destination, notice ? adopted : undefined);
  }

  function holdCandidate(result: GoogleCandidate, hadProgress = false) {
    pendingGoogle.current = result;
    switchConfirmed.current = false;
    hadGuestProgress.current = hadProgress;
    setLinkConflict(null);
    setSwitchPhase(guest ? "checking" : "confirm");
    setCandidate(result);
  }

  useEffect(() => {
    mounted.current = true;
    function restored(event: PageTransitionEvent) {
      if (!event.persisted || !googleInFlight.current || pendingGoogle.current) return;
      clearGoogleAttempt(window.sessionStorage);
      googleInFlight.current = false;
      setGoogleBusy(false);
      setGoogleNotice("Google sign-in was cancelled. You can try again.");
    }
    window.addEventListener("pageshow", restored);
    return () => {
      mounted.current = false;
      window.removeEventListener("pageshow", restored);
      // Strict Mode replays effects on mount. Keep the candidate through
      // that replay and dispose it only when the screen actually goes away.
      queueMicrotask(() => {
        if (mounted.current) return;
        const abandoned = pendingGoogle.current;
        pendingGoogle.current = null;
        void abandoned?.cancel().catch(() => undefined);
      });
    };
  }, []);
  useEffect(() => {
    if (!google || identity.status === "checking") return;
    const completion = takeGoogleCompletion();
    if (!completion) return;
    const { callback, result } = completion;
    if ("error" in result) { googleFailure(result.error, callback); return; }
    if ("linkConflict" in result) {
      if (guest && callback.attempt.owner === identity.userId) setLinkConflict(callback);
      else googleFailure("Your active account changed. Start Google sign-in again.", callback);
      return;
    }
    if (result.candidate.requiresConfirmation) {
      if (identity.userId === callback.attempt.owner) {
        holdCandidate(result.candidate, callback.attempt.hadProgress);
      } else {
        void result.candidate.cancel();
        googleFailure("Your active account changed. Start Google sign-in again.", callback);
      }
      return;
    }
    googleInFlight.current = true;
    setGoogleBusy(true);
    void (async () => {
      try {
        const preserveNotice = callback.attempt.action === "link" && (callback.attempt.hadProgress || guestProgress === true);
        await adoptGoogle(result.candidate, undefined, preserveNotice ? "Your progress is now saved to your account." : undefined);
      } catch (cause) {
        if (mounted.current) googleFailure(cause instanceof Error ? cause.message : "Google sign-in could not finish. Please retry.", callback);
      } finally {
        googleInFlight.current = false;
        if (mounted.current) setGoogleBusy(false);
      }
    })();
  }, [google, identity.status, takeGoogleCompletion]);

  async function startGoogle(action: "link" | "signup" | "signin", target = destination) {
    if (!google || googleInFlight.current || inFlight.current || registration.isBusy()) return;
    const practice = latestState.current.practiceState;
    const hasAnswers = hasUnfinishedPracticeAnswers(practice, latestState.current.sessionState);
    const pending = hasAnswers || practice.pendingSubmission
      ? loadPendingPracticeSubmission(browserStorage) : null;
    if (guest && (practice.syncState === "submitting" ||
      (hasAnswers && (!pending || pending.caseToken !== practice.currentCaseToken)) ||
      (practice.pendingSubmission && pending?.caseToken !== practice.pendingSubmission.caseToken))) {
      setGoogleNotice("Finish or save your current Practice case before continuing with Google.");
      return;
    }
    googleInFlight.current = true;
    setGoogleBusy(true);
    setGoogleNotice("");
    try {
      const url = await google.begin(action, target, { expectedOwner: identity.userId, hadProgress: guestProgress === true });
      window.location.assign(url);
    }
    catch (cause) {
      googleInFlight.current = false;
      setGoogleBusy(false);
      googleFailure(cause instanceof Error ? cause.message : "Google sign-in could not start. Please retry.");
    }
  }

  async function switchGoogle(result: GoogleCandidate, confirmed: boolean) {
    if (googleInFlight.current) return;
    switchConfirmed.current = confirmed;
    googleInFlight.current = true;
    setGoogleBusy(true);
    try {
      async function canSwitch() {
        const exam = readExamWork(identity.userId);
        if (exam === null && guest) { setSwitchPhase("progress"); return false; }
        if (exam === null || exam?.pending) { setSwitchPhase("exam"); return false; }
        if (!guest) return true;

        const progress = identity.userId ? await checkGuestProgress?.(identity.userId) : null;
        if (!mounted.current || pendingGoogle.current !== result) return false;
        if (progress == null) { setSwitchPhase("progress"); return false; }
        if (!confirmed && (progress || exam?.exists || hadGuestProgress.current)) { setSwitchPhase("confirm"); return false; }
        return true;
      }
      if (!await canSwitch()) return;
      if (!await syncBeforeAccountSwitch?.()) {
        setSwitchPhase("practice");
        return;
      }
      if (guest && !await canSwitch()) return;
      await adoptGoogle(result, () => {
        if (!mounted.current || pendingGoogle.current !== result) return false;
        const exam = readExamWork(identity.userId);
        if (exam === null && guest) { setSwitchPhase("progress"); return false; }
        if (exam === null || exam?.pending) { setSwitchPhase("exam"); return false; }
        if (hasPendingAccountSwitchWork?.()) { setSwitchPhase("practice"); return false; }
        if (guest) {
          const latest = latestState.current;
          const local = latest.status === "ready" && latest.userId === identity.userId
            ? readLocalGuestProgress(browserStorage, latest.userState, hasUnfinishedPracticeAnswers(latest.practiceState, latest.sessionState))
            : null;
          if (local === null) { setSwitchPhase("progress"); return false; }
          if (!confirmed && (local || exam?.exists)) { setSwitchPhase("confirm"); return false; }
        }
        pendingGoogle.current = null;
        return true;
      });
      if (!pendingGoogle.current && mounted.current) setCandidate(null);
    } catch (cause) {
      await result.cancel();
      pendingGoogle.current = null;
      setCandidate(null);
      googleFailure(cause instanceof Error ? cause.message : "Sign-in could not finish. You can try again.");
    } finally {
      googleInFlight.current = false;
      setGoogleBusy(false);
    }
  }

  useEffect(() => {
    if (!candidate || switchPhase !== "checking") return;
    if (state.status === "ready") void switchGoogle(candidate, false);
    else if (state.status === "error") setSwitchPhase("progress");
  }, [candidate, switchPhase, state.status]);

  async function cancelGoogle(result: GoogleCandidate) {
    if (googleInFlight.current) return;
    googleInFlight.current = true;
    setGoogleBusy(true);
    try { await result.cancel(); }
    finally {
      pendingGoogle.current = null;
      setCandidate(null);
      setSwitchPhase("checking");
      setGoogleBusy(false);
      googleInFlight.current = false;
    }
  }
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
  if (candidate) {
    const googleConfirmation = switchPhase === "confirm" && guest && candidate.method === "google";
    const title = switchPhase === "checking" ? "Checking your progress"
      : switchPhase === "progress" ? "We couldn’t verify your progress"
      : switchPhase === "exam" ? "Your Exam has pending work"
      : !guest ? "Switch accounts?"
      : candidate.method === "email" ? "Continue to your account?" : "Continue with Google?";
    const continueLabel = !guest ? "Switch account" : candidate.method === "email" ? "Continue to account" : "Continue with Google";
    body = <div className="account-narrow ph-no-capture" data-sentry-mask="true">
      <AccountCard title={title} className={googleConfirmation ? "account-entry-card account-google-confirmation" : undefined}>
        {switchPhase === "checking" && <p role="status">Checking saved progress and pending work.</p>}
        {switchPhase === "progress" && <p role="alert">We couldn’t check all of your saved progress. Retry before switching accounts.</p>}
        {switchPhase === "exam" && <p role="alert">Recover your sitting in the Exam Room before switching accounts.</p>}
        {switchPhase === "practice" && <p role="alert">Your pending work could not sync. Stay with your current account or retry syncing.</p>}
        {switchPhase === "confirm" && <>
          <p>You’re signing in as <strong>{candidate.email}</strong>.</p>
          {googleConfirmation ? <p><strong>You'll lose access to your current progress as a guest if you continue</strong></p>
            : guest ? <><p><strong>Your guest progress won’t transfer.</strong></p>
            <p>Your current practice progress belongs to your guest account. You may not be able to access it again after switching.</p></>
            : <p>Your current progress stays with its original account.</p>}
        </>}
        {switchPhase === "progress" && <AccountButton busy={googleBusy} onClick={() => {
          if (state.status === "error" && retryAccountBootstrap) {
            retryAccountBootstrap();
            setSwitchPhase("checking");
          } else void switchGoogle(candidate, switchConfirmed.current);
        }}>Retry progress check</AccountButton>}
        {switchPhase === "confirm" && <AccountButton busy={googleBusy} className={googleConfirmation ? "account-entry-submit" : undefined}
          showArrow={!googleConfirmation} onClick={() => void switchGoogle(candidate, true)}>{continueLabel}</AccountButton>}
        {switchPhase === "practice" && <AccountButton busy={googleBusy} onClick={() => void switchGoogle(candidate, switchConfirmed.current)}>Retry sync and switch</AccountButton>}
        <p className={googleConfirmation ? "account-entry-footer" : undefined}><button type="button" className="account-link" disabled={googleBusy} onClick={() => void cancelGoogle(candidate)}>{guest ? "Stay as guest" : "Keep current account"}</button></p>
      </AccountCard>
    </div>;
  } else if (linkConflict && guest && linkConflict.attempt.owner === identity.userId && !googleBusy) {
    const request = google?.requestExistingCode;
    body = <GoogleLinkRecovery
      requestCode={request ? email => request(linkConflict, email) : undefined}
      onCandidate={result => holdCandidate(result, linkConflict.attempt.hadProgress)}
      onGoogle={() => void startGoogle("signin", linkConflict.attempt.destination)}
      onCancel={() => {
        setLinkConflict(null);
        setGoogleNotice("Your guest account is still active.");
      }} />;
  } else if (googleBusy || identity.status === "checking") {
    body = <AccountWaiting attempt={waitingAttempt} retry={() => { setWaitingAttempt(n => n + 1); void account.retryVerification(); }} />;
  } else if (identity.status === "unavailable" && !registrationActive && !["signin", "completion", "forgot", "reset"].includes(page)) {
    body = <div className="account-narrow"><AccountCard title="We couldn't check your account"><p>Your saved account has not been replaced.</p><AccountButton onClick={() => void account.refresh()}>Try again</AccountButton></AccountCard></div>;
  } else if (recoveryPage) {
    body = <div className="account-narrow ph-no-capture" data-sentry-mask="true"><PasswordRecoveryPages page={page as AccountPage} destination={destination} onPage={next => {
      if (next !== "signin") { setPage(next); return; }
      const params = new URLSearchParams(location.search); params.set("account", "signin"); params.set("reauthenticate", "1");
      void navigate(accountPageUrl("signin", params.toString()));
    }} /></div>;
  } else if (registrationActive || registrationPage || identity.status === "unverified") {
    body = <div className="account-registration">{intent === "trial" && <TrialStepper step={0} />}
      <RegistrationPages page={registrationPage ? page as AccountPage : "link"} destination={destination} onPage={setPage}
        guestProgress={guestProgress} onGoogle={google ? () => void startGoogle(guest ? "link" : "signup") : undefined} />
    </div>;
  } else if (page === "signin") {
    body = <div className="account-signin-layout">{intent === "trial" && <TrialStepper step={0} />}<SignInForm
      busy={busy} error={error} onSubmit={signIn} onPage={p => { registration.resetView(); open(p); }}
      onGoogle={google ? () => void startGoogle("signin") : undefined} /></div>;
  } else if (verified && identity.userId) {
    body = accountReady !== true ? setupError
      ? <div className="account-narrow"><AccountCard title="We couldn't check account setup"><p role="status">Your account has not been replaced. Please retry.</p><AccountButton onClick={retrySetup}>Retry account check</AccountButton></AccountCard></div>
      : <div className="account-narrow account-setup-loading"><AccountWaiting attempt={waitingAttempt} retry={() => { setWaitingAttempt(n => n + 1); retrySetup(); }} /></div>
      : <RuntimeOwner key={identity.generation} client={client} userId={identity.userId} generation={identity.generation} paid={paid} page={page} onPage={setPage} />;
  } else {
    body = <><ExamPageHeading guest /><div className="exam-workspace exam-mock-workspace exam-guest-workspace"><ExamOverview guest state={{ ...initialPrototypeState, mode: "mock", examKind: "mock", caseCount: 3 }} pressureUnit={state.sessionState?.pressureUnit ?? "mmHg"} /><TrialIntroduction signedIn={false} complete={false} onStart={startTrial} onSignIn={() => open("signin", "trial")} /></div></>;
  }
  return <main className="app-shell__page exam-screen abg-account">{googleNotice && <p role="status" className="account-notice">{googleNotice}</p>}{body}</main>;
}

function readExamWork(userId: string | null): { exists: true; pending: boolean } | undefined | null {
  if (!userId) return undefined;
  try {
    const raw = localStorage.getItem("abgm-exam-pilot-clpfecuohwzwrgmqzeos-" + userId);
    if (raw === null) return undefined;
    const journal: ExamRuntimeSession["journal"] = JSON.parse(raw);
    if (!journal || typeof journal !== "object" || Array.isArray(journal)) return null;
    return { exists: true, pending: Boolean(!journal.attemptId || journal.dirty || journal.submission || journal.pendingPresentedUnitIds?.length) };
  } catch {
    return null;
  }
}

function SignInForm({ busy, error, onSubmit, onPage, onGoogle }: { busy: boolean; error: string; onSubmit: (email: string, password: string) => Promise<void>; onPage: (page: AccountPage) => void; onGoogle?: () => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [submitted, setSubmitted] = useState(false);
  const emailError = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address" : undefined;
  function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { document.getElementById("exam-signin-email")?.focus(); return; }
    if (!password) { document.getElementById("exam-signin-password")?.focus(); return; }
    const value = password; setPassword(""); void onSubmit(email, value);
  }
  return <AccountCard className="account-entry-card" title="Welcome Back">
    <form noValidate onSubmit={submit} className="account-form ph-no-capture" data-sentry-mask="true">
      {onGoogle && <GoogleButton disabled={busy} onClick={onGoogle} />}
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
  return <div className="exam-account-control ph-no-capture" data-sentry-mask="true" ref={ref}>
    <button ref={trigger} type="button" className="exam-account-trigger" aria-label={email ? `Account: ${email}` : "Sign in"} aria-expanded={email ? open : undefined} aria-controls={email ? "exam-account-menu" : undefined} disabled={!email && busy} onClick={() => { if (email) setOpen(v => !v); else onPage("signin"); }}>{email ? <span className="exam-account-avatar">{email.slice(0, 1).toUpperCase()}</span> : <><UserIcon /><span>Sign in</span></>}</button>
    {email && open && <section className="exam-account-menu" id="exam-account-menu" aria-label="Account">
      <strong className="account-private ph-no-capture">{email}</strong><p>{paid ? "Paid account" : "Free account"}</p>
        <button type="button" className="account-menu-action" disabled={busy} onClick={() => { setOpen(false); onSignOut(); }}><SignOutIcon />Sign out</button>
        <div className="account-paid-control"><span>Local development</span><label><input type="checkbox" role="switch" checked={paid} disabled={active || busy} onChange={onPaid} />Paid account</label><small>{isLocalDrillPreview() ? "Includes a local Focused Drills preview. Exam starts still require pilot access." : "Interface only. Existing pilot permissions still apply."}</small></div>
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
  const [accessWarning, setAccessWarning] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const retryAccess = useRef<() => void>(() => {});
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
    let cancelled = false;
    let inFlight = false;
    let loaded = false;
    let warningTimer: ReturnType<typeof setTimeout> | undefined;
    const current = () => !cancelled && isCurrent();
    const verify = async () => {
      if (inFlight || !current()) return;
      inFlight = true;
      setAccessBusy(true);
      setAccessError(false);
      setRevision(n => n + 1);
      try {
        const next = await readExamAccess(ownedClient);
        if (!current()) return;
        loaded = true;
        setAccess(next);
        setAccessWarning(false);
        if (warningTimer !== undefined) clearTimeout(warningTimer);
        warningTimer = undefined;
      } catch {
        if (!current()) return;
        if (!loaded) setAccessError(true);
        else if (warningTimer === undefined) {
          // One grace period per unresolved failure; this never retries the request.
          warningTimer = setTimeout(() => { if (current()) setAccessWarning(true); }, 15000);
        }
      } finally {
        inFlight = false;
        if (current()) setAccessBusy(false);
      }
    };
    const retry = () => { void verify(); };
    retryAccess.current = retry;
    const refresh = () => { void account.refresh(); retry(); };
    retry();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      if (warningTimer !== undefined) clearTimeout(warningTimer);
      if (retryAccess.current === retry) retryAccess.current = () => {};
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [account, ownedClient, isCurrent]);
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
  const canStartDrills = access?.canStartDrills === true;
  const loadPreviewDrill = paid && isLocalDrillPreview() ? loadLocalDrill : undefined;
  const showFullDashboard = canStartDrills || !!loadPreviewDrill || (paid && access?.canStartStandard === true);
  function renderDashboard(controls: ExamDashboardControls) {
    if (showFullDashboard || controls.canRecover) return controls.fullSetup;
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
        {profileError ? <><p role="alert">Try again to continue to trial setup.</p><AccountButton onClick={reloadProfile}>Retry</AccountButton></> : <AccountWaiting attempt={profileRevision} retry={reloadProfile} />}
      </AccountCard>;
      return page === "exam" ? controls.withSetup(status) : <div className="account-onboarding"><AccountBack onBack={() => onPage("exam")} />{status}</div>;
    }
    const complete = profile.completedAt !== null;
    const next = page === "start" || (page === "setup" && !complete) ? (complete ? "setup" : "about") : page;
    if (next === "about") return <div className="account-onboarding"><AccountBack onBack={() => onPage("exam")} /><TrialStepper step={1} onStep={() => { document.querySelector<HTMLFormElement>(".account-onboarding form")?.requestSubmit(); }} /><AboutYou value={draft} onChange={updateDraft} storageError={storageError} saving={savingProfile} saveError={saveError} onReloadSaved={profileConflict ? reloadProfile : undefined} onDone={value => void completeProfile(value)} /></div>;
    if (next === "setup") return <div className="account-onboarding account-trial-onboarding"><AccountBack onBack={() => onPage("exam")} /><TrialStepper step={2} onStep={() => onPage("about")} />{controls.trialSetup}<p className="account-footnote account-trial-later"><button type="button" className="account-link" onClick={() => onPage("exam")}>Do this later</button></p></div>;
    return controls.withSetup(<TrialIntroduction signedIn complete={complete} onStart={() => onPage("start")} />);
  }
  if (!access && accessError) return <div className="account-narrow"><AccountCard title="We couldn't check Exam access"><p role="alert">Your account has not been changed. Reconnect and retry.</p><AccountButton onClick={() => retryAccess.current()}>Retry access check</AccountButton></AccountCard></div>;
  if (!access) return <AccountWaiting attempt={revision} retry={() => retryAccess.current()} />;
  return <AccountBrowserStorageProvider value={storage}>
    {access.status === "closed" && <p role="status" className="account-notice">{canStartDrills ? "New Exams are currently unavailable." : "You're signed in. The Exam pilot is not open yet."}</p>}
    <ExamPilotRuntime enableOwnerUnitPicker={paid} accessNotice={{ visible: accessWarning, busy: accessBusy, onRetry: () => retryAccess.current() }} onReturnToDashboard={() => onPage("exam")} trialAccessMessage={access.status === "closed" ? "The Exam pilot is currently closed. New exams aren't available at the moment." : undefined} trialAvailability={access.trialAvailability ?? "error"} onRetryTrial={() => retryAccess.current()} client={ownedClient} userId={userId} canStartStandard={access.canStartStandard === true} canStartDrills={canStartDrills} loadPreviewDrill={loadPreviewDrill} limitedDashboard={!showFullDashboard} canStart={access.status === "allowed"} allowedUnitCounts={paid || canStartDrills ? access.allowedUnitCounts : access.allowedUnitCounts.filter(n => n === 3)} customisationCategories={paid || canStartDrills ? access.customisationCategories : []} renderDashboard={renderDashboard} />
  </AccountBrowserStorageProvider>;
}
