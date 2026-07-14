import { RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { clearPendingCalibrationCompletion } from "../../core/calibrationRecovery";
import { OPEN_ANALYTICS_CHOICES_EVENT } from "./AnalyticsConsentBanner";
import { APP_BUILD_LABEL } from "./appBuild";

function clearLearnModuleResumeState() {
  if (typeof window === "undefined") return;

  Object.keys(window.localStorage)
    .filter(key => key === "abg-master:learn:last-module" || /^abg-master:learn:[^:]+:lesson-index$/.test(key))
    .forEach(key => window.localStorage.removeItem(key));
}

export function AppFooter() {
  const { state } = useAppContext();

  async function handleResetProgress() {
    if (!state.storage) return;

    const confirmed = window.confirm("Reset all progress?\n\nThis will clear your XP, level, streak, practice history, and learning module progress.\nThis cannot be undone.");
    if (!confirmed) return;

    await state.storage.resetUserState();
    state.storage.saveSeenCaseState({});
    state.storage.savePracticeIntroSeen(false);
    state.storage.saveAppAreaVisited(false);
    state.storage.saveAdvancedRangesPreference(false);
    state.storage.clearCalibrationCompletion();
    clearPendingCalibrationCompletion(window.localStorage);
    clearLearnModuleResumeState();
    window.location.assign("/practice");
  }

  return (
    <footer className="dashboard-page-footer">
      <div className="dashboard-page-footer__container">
        <div className="dashboard-page-footer__top">
          <div className="dashboard-page-footer__brand">
            <div className="dashboard-page-footer__brand-line">
              <span>ABG Master</span>
              <span className="dashboard-page-footer__beta">Beta</span>
            </div>
            <p>For educational purposes only. Not a substitute for professional medical advice, diagnosis, or treatment.</p>
          </div>

          <nav className="dashboard-page-footer__navigation" aria-label="Footer navigation">
            <Link className="dashboard-page-footer__link" to="/updates">Updates</Link>
            <Link className="dashboard-page-footer__link" to="/resources">Resources</Link>
            <Link className="dashboard-page-footer__link" to="/contact">Contact</Link>
            <button
              className="dashboard-page-footer__link dashboard-page-footer__analytics"
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_ANALYTICS_CHOICES_EVENT))}
            >
              Analytics
            </button>
            <Link className="dashboard-page-footer__link" to="/about">About</Link>
            <Link className="dashboard-page-footer__link dashboard-page-footer__privacy" to="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy
            </Link>
          </nav>
        </div>

        <div className="dashboard-page-footer__bottom">
          <div className="dashboard-page-footer__build-info">
            <p>&copy; 2026 ABG Master. All rights reserved.</p>
            <p className="dashboard-page-footer__build"><span aria-hidden="true" />{APP_BUILD_LABEL}</p>
          </div>
          <button className="dashboard-page-footer__reset" type="button" onClick={handleResetProgress}>
            <RotateCcw aria-hidden="true" />
            Reset progress
          </button>
        </div>
      </div>
    </footer>
  );
}
