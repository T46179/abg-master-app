import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { trackPageView } from "../../core/analytics";
import { canAccessLearn, getReleaseFlags } from "../../core/progression";
import { useAppContext } from "../../app/AppProvider";
import { Surface } from "../primitives/Surface";
import { MainNav } from "./MainNav";

export function AppShell() {
  const { state, patchSessionState } = useAppContext();
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
          <div className="app-shell__warning">
            Protected practice sync pending. Your case is not complete yet.
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
