import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useOptionalSiteAccount, useSiteAccount } from "../../app/SiteAccountProvider";
import { LOCAL_ACCOUNT_URL, useRegistration } from "../../app/RegistrationProvider";
import { createAccountDataClient } from "../../core/accountDataClient";
import { preferredNameStore, signInMethods } from "../../core/accountProfile";
import { readAccountSetupStatus, REGISTRATION_RESEND_DELAY_MS } from "../../core/accountRegistration";
import { clearGoogleAttempt, hasGoogleSignIn } from "../../core/googleAccount";
import { readExamAccess, type ExamAccess } from "../../core/examAuth";
import { emptyExamOnboarding, readExamOnboardingProfile, saveExamOnboardingProfile, type ExamOnboarding, type ExamOnboardingProfile } from "../../core/examOnboarding";
import { ExamRuntimeError } from "../../core/examRuntime";
import { AboutYou } from "../account/AboutYou.dev";
import { useGuardedSignOut } from "../account/AccountNav.dev";
import { CircleAlert, Check, LockKeyhole, LogOut, Pencil, Trash2 } from "lucide-react";
import { GoogleMark } from "../account/GoogleButton.dev";
import { Surface } from "../primitives/Surface";
import "../exam/exam.css";
import "./profile.dev.css";

function MethodRow({ icon, title, status, connected, action }: {
  icon: ReactNode; title: string; status: string; connected: boolean; action: ReactNode;
}) {
  return <div className="profile-method">
    <span className="profile-method-icon" aria-hidden="true">{icon}</span>
    <div><strong className="exam-option-title">{title}</strong><p className="exam-option-detail">{connected && <Check size={14} aria-hidden="true" />} {status}</p></div>
    {action}
  </div>;
}

export default function ProfileScreen() {
  const site = useOptionalSiteAccount();
  if (!site || site.identity.status === "unavailable") return <p>Account unavailable. {site && <button onClick={() => void site.account.refresh()}>Retry</button>}</p>;
  if (site.identity.status === "checking") return <p role="status">Checking your account…</p>;
  if (site.identity.status !== "verified" || !site.identity.userId) return <Navigate replace to="/sign-in?return_to=profile" />;
  return <ConnectedProfile key={site.identity.generation} userId={site.identity.userId} email={site.identity.email ?? ""} />;
}

function ConnectedProfile({ userId, email }: { userId: string; email: string }) {
  const { client, identity, account } = useSiteAccount();
  const publicKey = import.meta.env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  const owned = useMemo(() => createAccountDataClient({ SUPABASE_URL: LOCAL_ACCOUNT_URL, SUPABASE_ANON_KEY: publicKey }, client, userId,
    () => account.isCurrent(identity.generation, userId)), [account, client, identity.generation, publicKey, userId]);
  const names = useMemo(() => preferredNameStore(LOCAL_ACCOUNT_URL, userId, publicKey, owned, typeof client.auth.updateUser === "function"), [owned, client, publicKey, userId]);
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState<boolean | null>(null);
  const [google, setGoogle] = useState<boolean | null>(null);
  const [access, setAccess] = useState<ExamAccess | null>(null);
  const [attempt, retry] = useState(0);
  const signOut = useGuardedSignOut();
  const { paid: paidPreview, google: googleAccount, registration } = useRegistration();
  const location = useLocation();
  const navigate = useNavigate();
  const [methodNotice, setMethodNotice] = useState("");
  const [methodBusy, setMethodBusy] = useState(false);
  const methodPending = useRef<"google" | "password" | null>(null);
  const profileMounted = useRef(false);
  const [emailSent, setEmailSent] = useState(false);
  useEffect(() => {
    if (!emailSent) return;
    const timer = window.setTimeout(() => setEmailSent(false), REGISTRATION_RESEND_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [emailSent]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get("google_link");
    if (!result) return;
    setMethodNotice(result === "conflict" ? "This Google account is already linked to another profile. Choose another Google account or stay on My profile." : "Google connection was cancelled or could not finish. You can try again.");
    params.delete("google_link");
    void navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);
  useEffect(() => {
    profileMounted.current = true;
    function restored(event: PageTransitionEvent) {
      if (!event.persisted || methodPending.current !== "google" || !googleAccount) return;
      clearGoogleAttempt(window.sessionStorage);
      methodPending.current = null;
      setMethodBusy(false);
    }
    window.addEventListener("pageshow", restored);
    return () => {
      profileMounted.current = false;
      window.removeEventListener("pageshow", restored);
    };
  }, [googleAccount]);
  async function changeMethod(method: "password" | "google") {
    if (methodPending.current || registration.isBusy()) return;
    methodPending.current = method;
    setMethodBusy(true);
    setMethodNotice("");
    let redirecting = false;
    try {
      if (method === "password") {
        const address = await registration.requestProfilePasswordSetup(userId);
        setMethodNotice("Check " + address + " for a link to set your password.");
        setEmailSent(true);
      } else if (googleAccount) {
        const url = await googleAccount.begin("profile-link", "profile", { expectedOwner: userId });
        if (profileMounted.current && account.isCurrent(identity.generation, userId)) {
          window.location.assign(url);
          redirecting = true;
        }
      }
    } catch (cause) {
      setMethodNotice(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      if (!redirecting) { methodPending.current = null; setMethodBusy(false); }
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let current = true;
    void owned.auth.getUser().then(({ data }) => {
      if (!current || !data.user) return;
      setGoogle(data.user.identities ? hasGoogleSignIn(data.user) : null);
      setName(names.read(data.user.user_metadata ?? {}));
      setMessage("");
    }).catch(() => { if (current) setMessage("Could not load profile details."); });
    void readAccountSetupStatus(owned).then(value => { if (current) setPassword(value); }).catch(() => {});
    void readExamAccess(owned).then(value => { if (current) setAccess(value); }).catch(() => {});
    return () => { current = false; };
  }, [owned, names, attempt]);
  const methods = signInMethods(password, google);
  const tier = !access ? "Unknown" : access.canStartStandard ? "Full exam access" : access.status === "allowed" ? "Limited exam access" : access.status === "closed" ? "Exam starts closed" : "No pilot access";
  const trial = access?.trialLifecycle?.state;
  const trialLabel = trial === "available" ? (access?.trialAvailability === "ready" && access.status === "allowed" ? "Available" : "Currently unavailable") :
    trial === "consumed" ? "Completed" : trial === "reserved" ? "Reserved for grading" : trial === "active" ? "In progress" : "Unknown";
  const canReset = password === true && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return <main className="app-shell__page exam-screen exam-panel-typography abg-account local-profile ph-no-capture" data-sentry-mask="true">
    <header className="exam-page-heading">
      <p className="exam-eyebrow">Account</p><h1>My profile</h1>
      <p>Manage how you sign in, update your professional background, and review your exam access.</p>
    </header>
    <Surface aria-label="Profile" className="profile-identity-card">
      <div className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">{(email || "?")[0].toUpperCase()}</span>
        <div><h2 className="exam-panel-title">{name || email}</h2>{name && <p className="exam-panel-description">{email}</p>}
          <div className="profile-badges">
            {access && <span className="profile-tier" data-full={access.canStartStandard}>{tier}</span>}
            <span className="profile-verified"><Check size={14} />Email verified</span>
          </div>
        </div>
      </div>
      <div className="profile-identity-details">
        <div className="profile-field">
          <strong className="exam-field-label">Preferred name</strong>
          <div>{draft === null ? <span className="exam-option-title">{name || "Not set"}</span> :
            <form className="profile-name-editor" onSubmit={async event => {
              event.preventDefault();
              if (saving) return;
              setSaving(true);
              try { setName(await names.save(draft)); setDraft(null); setMessage("Preferred name saved."); }
              catch { setMessage("Could not save your name. Please try again."); }
              finally { setSaving(false); }
            }}>
              <input aria-label="Preferred name" value={draft} maxLength={40} disabled={saving} onChange={event => setDraft(event.target.value)} />
              <button className="profile-action" disabled={saving}>Save name</button>
              <button className="profile-action" type="button" disabled={saving} onClick={() => { setDraft(null); setMessage(""); }}>Cancel</button>
            </form>}
            {names.local && <p className="exam-option-detail">Saved on this device</p>}{message && <p className="exam-option-detail" role="status">{message}</p>}
          </div>
          {draft === null && <button className="profile-action" disabled={name === null} onClick={() => { setDraft(name ?? ""); setMessage(""); }}><Pencil size={14} />Edit</button>}
        </div>
        <div className="profile-field"><strong className="exam-field-label">Email</strong><div><span className="exam-option-title">{email}</span><p className="exam-option-detail">Used to sign in and for account emails.</p></div></div>
      </div>
    </Surface>
    <Surface className="profile-panel">
      <h2 className="exam-panel-title">Sign-in methods</h2><p className="exam-panel-description">How you sign in to your account.</p>
      <div className="profile-group">
        <MethodRow icon={<LockKeyhole size={18} />} title="Email and password" status={methods.password} connected={password === true}
          action={canReset ? <Link className="profile-action" to="/forgot-password?return_to=profile">Reset password</Link> :
            password === false && <button className="profile-action" disabled={methodBusy || emailSent} onClick={() => void changeMethod("password")}>Set password</button>} />
        <MethodRow icon={<GoogleMark />} title="Google" status={methods.google} connected={google === true}
          action={google === false && <button className="profile-action" disabled={methodBusy || !googleAccount} onClick={() => void changeMethod("google")}>Connect Google</button>} />
      </div>
      {methodNotice && <p role="status" className="exam-panel-description">{methodNotice}</p>}
    </Surface>
    <Background client={owned} />
    <Surface className="profile-panel">
      <h2 className="exam-panel-title">Account management</h2><p className="exam-eyebrow profile-plan-heading">Plan</p>
      <dl className="profile-group profile-plan">
        <div><dt className="exam-field-label">Account tier</dt><dd><span className="profile-tier" data-full={access?.canStartStandard}>{tier}</span></dd></div>
        <div><dt className="exam-field-label">Trial exam</dt><dd className="exam-option-title">{trialLabel}</dd></div>
        <div><dt className="exam-field-label">Subscription</dt><dd className="exam-option-title">Unavailable<p className="exam-option-detail">Billing management is unavailable.</p></dd></div>
      </dl>
      <div className="profile-management"><div><strong className="exam-option-title">Sign out</strong><p className="exam-option-detail">Your progress stays saved to your account.</p></div>
        <button className="profile-action" onClick={() => void signOut()}><LogOut size={16} />Sign out</button>
      </div>
      <div className="profile-management profile-danger"><div><strong className="exam-option-title">Delete account</strong><p className="exam-option-detail">Permanently delete your account and its learning data.</p></div>
        <button className="profile-action" onClick={() => dialog.current?.showModal()}><Trash2 size={16} />Delete account</button>
      </div>
    </Surface>
    {(name === null || password === null || google === null || access === null) && <button onClick={() => retry(n => n + 1)}>Refresh account details</button>}
    <dialog ref={dialog} className="profile-delete-dialog" role="alertdialog"
      aria-labelledby="profile-delete-title" aria-describedby="profile-delete-description"
      onClose={() => dialog.current?.querySelector("form")?.reset()}>
      <form method="dialog">
        <span className="profile-delete-icon"><Trash2 size={22} aria-hidden="true" /></span>
        <h2 id="profile-delete-title">Delete your account?</h2>
        <p id="profile-delete-description">This permanently deletes <strong>{email}</strong> and everything linked to it. It can't be undone, and we can't recover it for you later.</p>
        <div className="profile-delete-details">
          <h3 className="exam-eyebrow">Also deleted</h3>
          <ul>
            <li>Practice history, difficulty progress and streak</li>
            <li>Exam results, past attempts and Error log</li>
            <li>Professional background and preferred name</li>
            <li>{google ? "Your sign-in details, including the Google connection" : password ? "Your email and password sign-in" : "Your sign-in details"}</li>
          </ul>
        </div>
        {paidPreview && <aside className="profile-delete-warning">
          <CircleAlert size={16} aria-hidden="true" />
          <div><small>Local Pro preview</small><strong>Your Pro subscription will be cancelled.</strong> Deleting your account ends Pro access immediately and stops renewal, so you won't be charged on 14 March 2026. To keep Pro until then, cancel your subscription instead of deleting.</div>
        </aside>}
        <label htmlFor="profile-delete-confirm">Type DELETE to confirm</label>
        <input id="profile-delete-confirm" placeholder="DELETE" autoComplete="off" spellCheck={false} />
        <div className="profile-delete-actions">
          <button type="submit" autoFocus>Cancel</button>
          <button type="button" disabled title="Account deletion is unavailable.">Delete account permanently</button>
        </div>
      </form>
    </dialog>
  </main>;
}

function Background({ client }: { client: SupabaseClient }) {
  const [profile, setProfile] = useState<ExamOnboardingProfile | null>(null);
  const [draft, setDraft] = useState<ExamOnboarding | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [revision, reload] = useState(0);
  useEffect(() => {
    let current = true;
    void readExamOnboardingProfile(client).then(result => {
      if (current) { setProfile(result); setDraft(null); setConflict(false); setError(""); }
    }).catch(() => { if (current) setError("Could not load your saved background."); });
    return () => { current = false; };
  }, [client, revision]);
  async function save(value: ExamOnboarding) {
    if (!profile || saving || conflict) return;
    setSaving(true); setError("");
    try { setProfile(await saveExamOnboardingProfile(client, profile.revision, value)); setDraft(null); }
    catch (cause) {
      const stale = cause instanceof ExamRuntimeError && cause.code === "EXAM_ONBOARDING_CONFLICT";
      setConflict(stale); setError(stale ? "Your background changed elsewhere. Reload your saved answers." : "Could not save your background. Please try again.");
    } finally { setSaving(false); }
  }
  const answers = profile?.answers;
  return <Surface className="profile-panel">
    <div className="profile-panel-heading">
      <div><h2 className="exam-panel-title">Background</h2><p className="exam-panel-description">What you told us about your role and goals.</p></div>
      {profile && !draft && <button className="profile-action" onClick={() => setDraft(answers ?? emptyExamOnboarding())}>
        <Pencil size={14} />{answers ? "Edit" : "Add background"}
      </button>}
    </div>
    {draft ? <div className="account-about-card profile-background-editor">
      <AboutYou editingProfile value={draft} onChange={setDraft} onDone={save} storageError={false} saving={saving} saveError={error}
        onReloadSaved={conflict ? () => reload(n => n + 1) : undefined} />
      <button className="profile-action" disabled={saving} onClick={() => { setDraft(null); setError(""); if (conflict) reload(n => n + 1); }}>Cancel</button>
    </div> : <>
      {error && <p role="alert">{error} <button className="profile-action" onClick={() => reload(n => n + 1)}>Retry</button></p>}
      {answers ? <dl className="profile-group profile-facts">
        <div><dt className="exam-field-label">Professional role</dt><dd className="exam-option-title">{answers.otherRole || answers.role}</dd></div>
        <div><dt className="exam-field-label">Main reason</dt><dd className="exam-option-title">{answers.reason}</dd></div>
        {answers.stage && <div><dt className="exam-field-label">Stage of training</dt><dd className="exam-option-title">{answers.stage}</dd></div>}
        {answers.specialty && <div><dt className="exam-field-label">Specialty</dt><dd className="exam-option-title">{answers.otherSpecialty || answers.specialty}</dd></div>}
      </dl> : <p className="exam-panel-description profile-empty">{profile ? "Add your professional background." : !error && "Loading background…"}</p>}
    </>}
  </Surface>;
}
