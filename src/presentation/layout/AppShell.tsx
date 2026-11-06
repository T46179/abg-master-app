import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { useBackgroundAccount } from "../../app/AccountLoading";
import { useOptionalSiteAccount } from "../../app/SiteAccountProvider";
import { accountPageFromPath } from "../../core/accountRoutes";
import { AccountWaiting } from "../shared/AccountWaiting";
import { PROTECTED_PRACTICE_MESSAGES } from "../../app/protectedPracticeMessages";
import { SeoMetadata } from "../../app/seo";
import { trackEvent, trackPageView } from "../../core/analytics";
import {
  hasMeaningfulCalibrationProgress,
  shouldHoldLearnerRouteForCalibration,
  shouldRedirectToCalibrationOnboarding
} from "../../core/calibrationOnboarding";
import { getReleaseFlags } from "../../core/progression";
import type { PressureUnit } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { LoadingView } from "../shared/StatusViews";
import { MainNav } from "./MainNav";
import { ExamSittingProvider, useExamSitting } from "../exam/ExamSittingContext";
import { getMobileNavProgress } from "./mobileNavProgress";

export function AppShell() {
  const site = useOptionalSiteAccount();
  return <ExamSittingProvider key={site?.identity.generation}><AppShellContent /></ExamSittingProvider>;
}

function AppShellContent() {
  const { sitting, dispatch: dispatchExam } = useExamSitting();
  const examActive = Boolean(sitting && sitting.phase !== "complete");
  const { state, patchSessionState, retryPendingSubmissionNow, discardPendingSubmission } = useAppContext();
  const location = useLocation();
  const background = useBackgroundAccount();
  const site = useOptionalSiteAccount();
  const accountRoute = Boolean(accountPageFromPath(location.pathname)) || location.pathname === "/dev/exam-pilot";
  const needsGuest = /^\/(practice|dashboard|insights|learn|calibration|featured-case)(\/|$)/.test(location.pathname);
  const [guestError, setGuestError] = useState(false);
  const [guestAttempt, setGuestAttempt] = useState(0);
  useEffect(() => {
    setGuestError(false);
    if (!background || !needsGuest || site?.identity.status !== "signed_out") return;
    let cancelled = false;
    void site.account.continueAsGuest().catch(() => { if (!cancelled) setGuestError(true); });
    return () => { cancelled = true; };
  }, [Boolean(background), needsGuest, site?.identity.status, site?.account, guestAttempt]);
  const accountWaiting = Boolean(background && (!background.ready || site?.identity.status === "checking" ||
    (!accountRoute && (background.error || (needsGuest && site?.identity.status === "signed_out")))));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const learnOpenedTrackedRef = useRef(false);
  const releaseFlags = getReleaseFlags(state.payload?.progressionConfig ?? null);
  const mobileProgress = getMobileNavProgress({
    progressionConfig: state.payload?.progressionConfig ?? null,
    dashboardState: state.payload?.dashboardState ?? null,
    defaultUserState: state.payload?.defaultUserState ?? null,
    userState: state.userState,
    cases: state.payload?.cases ?? []
  });
  const hasMeaningfulProgress = hasMeaningfulCalibrationProgress({
    userState: state.userState,
    seenCasesByDifficulty: state.storage?.loadSeenCaseState() ?? null,
    hasActiveCase: Boolean(state.practiceState.currentCase),
    hasSummary: Boolean(state.practiceState.lastCaseSummary),
    hasPendingSubmission: Boolean(state.practiceState.pendingSubmission)
  });
  const isHostedExamPilotRoute = import.meta.env.MODE === "exam-pilot" && /^\/exam\/?$/.test(location.pathname);
  const isLocalAccountPilotRoute = import.meta.env.DEV && !["production", "exam-pilot", "account-staging"].includes(import.meta.env.MODE) && /^\/dev\/exam-pilot\/?$/.test(location.pathname);
  const shouldHoldLearnerRoute = !isLocalAccountPilotRoute && !isHostedExamPilotRoute && shouldHoldLearnerRouteForCalibration({
    hasSeenIntroduction: state.storage?.loadPracticeIntroSeen() ?? false,
    hasVisitedAppArea: state.storage?.loadAppAreaVisited() ?? false,
    pathname: location.pathname,
    calibration: state.calibrationState,
    hasMeaningfulProgress
  });
  const shouldRedirectToCalibration = !isLocalAccountPilotRoute && !isHostedExamPilotRoute && shouldRedirectToCalibrationOnboarding({
    hasSeenIntroduction: state.storage?.loadPracticeIntroSeen() ?? false,
    hasVisitedAppArea: state.storage?.loadAppAreaVisited() ?? false,
    pathname: location.pathname,
    calibration: state.calibrationState,
    hasMeaningfulProgress
  });

  useEffect(() => {
    if (accountWaiting || shouldHoldLearnerRoute || shouldRedirectToCalibration) return;

    const pathSegment = location.pathname.split("/")[1] || "landing";
    const baseViewName = pathSegment === "dashboard" ? "dashboard" : pathSegment;
    const viewName = baseViewName === "practice" && state.practiceState.lastCaseSummary
      ? "results"
      : baseViewName;

    patchSessionState({ currentView: viewName });
    if (pathSegment === "dashboard" || pathSegment === "learn") {
      state.storage?.saveAppAreaVisited(true);
    }
    if (pathSegment === "learn" && !learnOpenedTrackedRef.current) {
      const source = new URLSearchParams(location.search).get("source") ?? undefined;
      learnOpenedTrackedRef.current = true;
      trackEvent("learn_opened", {
        ...(source ? { source } : {})
      });
    }
    trackPageView(viewName);
  }, [
    location.pathname,
    accountWaiting,
    patchSessionState,
    shouldHoldLearnerRoute,
    shouldRedirectToCalibration,
    state.practiceState.lastCaseSummary,
    state.storage
  ]);

  useEffect(() => {
    setMobileOpen(false);
    setSettingsOpen(false);
  }, [location.key]);

  function handleDiscardPendingCase() {
    if (typeof window === "undefined" || !state.practiceState.pendingSubmission) return;
    const confirmed = window.confirm("Discard this unsaved case?");
    if (!confirmed) return;
    discardPendingSubmission();
  }

  function handleToggleMobile() {
    setSettingsOpen(false);
    setMobileOpen(value => !value);
  }

  function handleToggleSettings() {
    const nextOpen = !settingsOpen;
    setSettingsOpen(nextOpen);
    if (nextOpen) {
      setMobileOpen(false);
    }
  }

  function handlePressureUnitChange(pressureUnit: PressureUnit) {
    if (examActive) return;
    if ((state.sessionState?.pressureUnit ?? "mmHg") === pressureUnit) return;
    patchSessionState({ pressureUnit });
    state.storage?.savePressureUnitPreference(pressureUnit);
  }

  return (
    <div className="app-shell">
      <SeoMetadata />

      <MainNav
        mobileOpen={mobileOpen}
        onToggleMobile={handleToggleMobile}
        onCloseMobile={() => setMobileOpen(false)}
        settingsOpen={settingsOpen}
        pressureUnit={examActive ? sitting!.pressureUnit : state.sessionState?.pressureUnit ?? "mmHg"}
        pressureUnitLocked={examActive}
        examRanges={examActive && /^\/(exam|dev\/exam-pilot)\/?$/.test(location.pathname) ? sitting!.showRanges : undefined}
        onExamRangesChange={() => dispatchExam({ type: "ranges" })}
        onToggleSettings={handleToggleSettings}
        onCloseSettings={() => setSettingsOpen(false)}
        onPressureUnitChange={handlePressureUnitChange}
        learnEnabled
        showBetaBadge={releaseFlags.enable_beta_badge}
        mobileProgress={mobileProgress}
      />

      <div className="app-shell__status-stack">
        {state.practiceState.syncState === "pending_retry" ? (
          <div className="app-shell__warning app-shell__warning--actionable">
            <div>
              <span>{state.practiceState.syncMessage ?? PROTECTED_PRACTICE_MESSAGES.retryBanner}</span>
            </div>
            <div>
              <button
                className="app-shell__warning-action"
                type="button"
                onClick={retryPendingSubmissionNow}
              >
                Retry now
              </button>
              <button
                className="app-shell__warning-action"
                type="button"
                onClick={handleDiscardPendingCase}
              >
                Discard this unsaved case
              </button>
            </div>
          </div>
        ) : null}
        {Object.values(state.appStatus.warnings).map((warning, index) => (
          <div key={`${warning.message ?? "warning"}-${index}`} className="app-shell__warning">
            {warning.message}
          </div>
        ))}
      </div>

      {accountWaiting && !state.appStatus.blocking ? (
        <main className="app-shell__page status-screen"><AccountWaiting attempt={(background?.attempt ?? 0) + guestAttempt}
          error={background?.error ? "We couldn't check your account." : guestError ? "We couldn't start guest Practice." : undefined}
          retry={() => { if (site?.identity.status === "signed_out") setGuestAttempt(n => n + 1); else background?.retry(); }} />
          {background?.error && <p><a href="/sign-in">Sign in</a> or <a href="/forgot-password">recover your account</a></p>}
        </main>
      ) : state.appStatus.blocking ? (
        <main className="app-shell__page status-screen">
          <Surface className="status-panel">
            <span className="status-panel__eyebrow">Application blocked</span>
            <h1>{state.appStatus.blocking.title ?? "Something went wrong."}</h1>
            <p>{state.appStatus.blocking.message ?? "The frontend could not initialize."}</p>
          </Surface>
        </main>
      ) : shouldHoldLearnerRoute ? (
        <LoadingView />
      ) : shouldRedirectToCalibration ? (
        <Navigate to="/calibration" replace />
      ) : (
        <Outlet />
      )}
    </div>
  );
}
