import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { PROTECTED_PRACTICE_MESSAGES } from "../../app/protectedPracticeMessages";
import { SeoMetadata } from "../../app/seo";
import { trackEvent, trackPageView } from "../../core/analytics";
import {
  hasMeaningfulCalibrationProgress,
  shouldHoldLearnerRouteForCalibration,
  shouldRedirectToCalibrationOnboarding
} from "../../core/calibrationOnboarding";
import { getReleaseFlags } from "../../core/progression";
import { Surface } from "../primitives/Surface";
import { LoadingView } from "../shared/StatusViews";
import { LaunchNotifyModal } from "./LaunchNotifyModal";
import { MainNav } from "./MainNav";
import { getMobileNavProgress } from "./mobileNavProgress";

export function AppShell() {
  const { state, patchSessionState, retryPendingSubmissionNow, discardPendingSubmission } = useAppContext();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [launchNotifyOpen, setLaunchNotifyOpen] = useState(false);
  const [launchNotifySubmitting, setLaunchNotifySubmitting] = useState(false);
  const [launchNotifySubmitted, setLaunchNotifySubmitted] = useState(false);
  const [launchNotifyError, setLaunchNotifyError] = useState("");
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
  const shouldHoldLearnerRoute = shouldHoldLearnerRouteForCalibration({
    pathname: location.pathname,
    calibration: state.calibrationState,
    hasMeaningfulProgress
  });
  const shouldRedirectToCalibration = shouldRedirectToCalibrationOnboarding({
    pathname: location.pathname,
    calibration: state.calibrationState,
    hasMeaningfulProgress
  });

  useEffect(() => {
    if (shouldHoldLearnerRoute || shouldRedirectToCalibration) return;

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
    setMobileOpen(false);
  }, [
    location.pathname,
    patchSessionState,
    shouldHoldLearnerRoute,
    shouldRedirectToCalibration,
    state.practiceState.lastCaseSummary,
    state.storage
  ]);

  function handleDiscardPendingCase() {
    if (typeof window === "undefined" || !state.practiceState.pendingSubmission) return;
    const confirmed = window.confirm("Discard this unsaved case?");
    if (!confirmed) return;
    discardPendingSubmission();
  }

  function handleOpenStayUpdated() {
    setMobileOpen(false);
    setLaunchNotifyError("");
    setLaunchNotifySubmitted(false);
    setLaunchNotifyOpen(true);
  }

  function handleCloseStayUpdated() {
    setLaunchNotifyOpen(false);
    setLaunchNotifySubmitting(false);
    setLaunchNotifyError("");
    setLaunchNotifySubmitted(false);
  }

  async function handleLaunchNotifySubmit(email: string) {
    setLaunchNotifySubmitting(true);
    setLaunchNotifyError("");

    try {
      const response = await fetch("https://submit-form.com/8T8RZZaL6", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error(`Launch notify submit failed: ${response.status}`);
      }

      setLaunchNotifySubmitted(true);
      trackEvent("launch_notify_submitted");
    } catch (error) {
      console.warn("Launch notify signup failed.", error);
      setLaunchNotifyError("That didn't work. Please try again.");
    } finally {
      setLaunchNotifySubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <SeoMetadata />

      <MainNav
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(value => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onOpenStayUpdated={handleOpenStayUpdated}
        learnEnabled
        showBetaBadge={releaseFlags.enable_beta_badge}
        mobileProgress={mobileProgress}
      />

      <LaunchNotifyModal
        open={launchNotifyOpen}
        onClose={handleCloseStayUpdated}
        onSubmit={handleLaunchNotifySubmit}
        isSubmitting={launchNotifySubmitting}
        isSubmitted={launchNotifySubmitted}
        error={launchNotifyError}
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

      {state.appStatus.blocking ? (
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
