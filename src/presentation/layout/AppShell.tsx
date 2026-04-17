import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { PROTECTED_PRACTICE_MESSAGES } from "../../app/protectedPracticeMessages";
import { trackEvent, trackPageView } from "../../core/analytics";
import { getReleaseFlags } from "../../core/progression";
import { Surface } from "../primitives/Surface";
import { LaunchNotifyModal } from "./LaunchNotifyModal";
import { MainNav } from "./MainNav";

export function AppShell() {
  const { state, patchSessionState, retryPendingSubmissionNow, discardPendingSubmission } = useAppContext();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [launchNotifyOpen, setLaunchNotifyOpen] = useState(false);
  const [launchNotifySubmitting, setLaunchNotifySubmitting] = useState(false);
  const [launchNotifySubmitted, setLaunchNotifySubmitted] = useState(false);
  const [launchNotifyError, setLaunchNotifyError] = useState("");
  const releaseFlags = getReleaseFlags(state.payload?.progressionConfig ?? null);

  useEffect(() => {
    const pathSegment = location.pathname.split("/")[1] || "landing";
    const baseViewName = pathSegment === "dashboard" ? "dashboard" : pathSegment;
    const viewName = baseViewName === "practice" && state.practiceState.lastCaseSummary
      ? "results"
      : baseViewName;

    patchSessionState({ currentView: viewName });
    trackPageView(viewName);
    setMobileOpen(false);
  }, [location.pathname, patchSessionState, state.practiceState.lastCaseSummary]);

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
      <MainNav
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(value => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onOpenStayUpdated={handleOpenStayUpdated}
        learnEnabled={false}
        showBetaBadge={releaseFlags.enable_beta_badge}
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
      ) : (
        <Outlet />
      )}
    </div>
  );
}
