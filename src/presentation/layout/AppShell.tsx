import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { trackPageView } from "../../core/analytics";
import { clearPendingPracticeSubmission, savePracticeSlotsCache } from "../../core/protectedPracticeCache";
import { canAccessLearn, getReleaseFlags } from "../../core/progression";
import { Surface } from "../primitives/Surface";
import { MainNav } from "./MainNav";

export function AppShell() {
  const { state, patchSessionState, patchPracticeState } = useAppContext();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const learnEnabled = canAccessLearn({
    progressionConfig: state.payload?.progressionConfig ?? null,
    dashboardState: state.payload?.dashboardState ?? null,
    defaultUserState: state.payload?.defaultUserState ?? null,
    userState: state.userState,
    cases: state.payload?.cases ?? []
  });
  const releaseFlags = getReleaseFlags(state.payload?.progressionConfig ?? null);

  useEffect(() => {
    const baseViewName = location.pathname === "/"
      ? "dashboard"
      : location.pathname.split("/")[1] || "dashboard";
    const viewName = baseViewName === "practice" && state.practiceState.lastCaseSummary
      ? "results"
      : baseViewName;

    patchSessionState({ currentView: viewName });
    trackPageView(viewName);
    setMobileOpen(false);
  }, [location.pathname, patchSessionState, state.practiceState.lastCaseSummary]);

  function handleDiscardPendingCase() {
    const pendingSubmission = state.practiceState.pendingSubmission;
    if (typeof window === "undefined" || !pendingSubmission) return;

    const confirmed = window.confirm("Discard this unsaved case?");
    if (!confirmed) return;

    clearPendingPracticeSubmission(window.localStorage);

    const nextSlots = {
      ...state.practiceState.practiceSlotsByDifficulty,
      [pendingSubmission.difficultyKey]: null
    };
    savePracticeSlotsCache(window.localStorage, nextSlots);

    patchPracticeState({
      currentCase: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCase,
      currentCaseToken: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCaseToken,
      currentCaseExpiresAt: state.practiceState.currentCaseToken === pendingSubmission.caseToken ? null : state.practiceState.currentCaseExpiresAt,
      practiceSlotsByDifficulty: nextSlots,
      pendingSubmission: null,
      syncState: "idle",
      syncMessage: null
    });

    patchSessionState({
      currentStepIndex: 0,
      selectedAnswers: [],
      stepResults: [],
      stepOptionOverrides: {},
      caseStartMs: null
    });
  }

  return (
    <div className="app-shell">
      <MainNav
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(value => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        learnEnabled={learnEnabled}
        showBetaBadge={releaseFlags.enable_beta_badge}
      />

      <div className="app-shell__status-stack">
        {state.practiceState.syncState === "pending_retry" ? (
          <div className="app-shell__warning app-shell__warning--actionable">
            <span>Sorry, your case hasn't finished saving yet. Please wait.</span>
            <button
              className="app-shell__warning-action"
              type="button"
              onClick={handleDiscardPendingCase}
            >
              Discard this unsaved case
            </button>
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
