import { BookOpen, Flame, Megaphone, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import {
  canAccessDifficulty,
  getCasesRemainingToday,
  getHighestAccessibleDifficultyKey,
  getDifficultyMeta,
  getLevelProgress
} from "../../core/progression";
import { ProgressBar } from "../primitives/ProgressBar";
import { SectionHeader } from "../primitives/SectionHeader";
import { StatCard } from "../primitives/StatCard";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function DashboardScreen() {
  const { state } = useAppContext();
  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  const feedbackHref = "https://docs.google.com/forms/d/e/1FAIpQLSfmFQu6jCZxP1gPZklEZCn_aBzjRzlsR1jSuY-bqXxqXYN43w/viewform?usp=dialog";
  const payload = state.payload;
  const progressionInput = {
    progressionConfig: payload?.progressionConfig ?? null,
    dashboardState: payload?.dashboardState ?? null,
    defaultUserState: payload?.defaultUserState ?? null,
    userState: state.userState,
    cases: payload?.cases ?? []
  };
  const levelProgress = getLevelProgress(payload?.progressionConfig ?? null, state.userState);
  const difficultyMeta = getDifficultyMeta(progressionInput);
  const recent = state.userState.recentResults ?? [];
  const recentAccuracy = recent.length ? Math.round((recent.filter(Boolean).length / recent.length) * 100) : 100;
  const casesRemaining = getCasesRemainingToday(payload?.progressionConfig ?? null, state.userState);
  const longestStreak = state.userState.longestStreak ?? state.userState.streak ?? 0;
  const defaultDifficulty = getHighestAccessibleDifficultyKey(progressionInput);

  async function handleResetProgress() {
    if (!state.storage) return;

    const confirmed = window.confirm("Reset all progress?\n\nThis will clear your XP, level, and streak.\nThis cannot be undone.");
    if (!confirmed) return;

    await state.storage.resetUserState();
    state.storage.saveSeenCaseState({});
    state.storage.savePracticeIntroSeen(false);
    state.storage.saveAdvancedRangesPreference(false);
    window.location.reload();
  }

  return (
    <main className="app-shell__page dashboard-screen">
      <div className="dashboard-screen__container">
        <Surface className="dashboard-feedback-banner">
          <div className="dashboard-feedback-banner__icon" aria-hidden="true">
            <Megaphone />
          </div>
          <div className="dashboard-feedback-banner__copy">
            <p>We&apos;d love to hear what you think about the beta experience</p>
          </div>
          <a
            className="dashboard-feedback-banner__action"
            href={feedbackHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share Feedback
          </a>
        </Surface>

        <Surface className="dashboard-progress-card">
          <div className="dashboard-progress-card__meta">
            <span>Level {state.userState.level}</span>
            <span>{levelProgress.xpIntoLevel} / {levelProgress.xpForNextLevel || levelProgress.xpIntoLevel} XP</span>
          </div>
          <ProgressBar value={levelProgress.progressPercent} />
        </Surface>

        <Surface className="dashboard-card dashboard-card--continue">
          <SectionHeader
            title="Continue Learning"
            subtitle={
              casesRemaining == null
                ? "Unlimited cases available today"
                : `${casesRemaining} case${casesRemaining === 1 ? "" : "s"} remaining today.`
            }
          />
          <div className="dashboard-card__actions">
            <Link className="figma-button results-card__button" to={`/practice?difficulty=${defaultDifficulty}`}>
              Next case
            </Link>
            <button className="figma-button figma-button--secondary results-card__button results-card__button--secondary" type="button" disabled>
              Performance
            </button>
          </div>
        </Surface>

        <section className="dashboard-stats-grid">
          <StatCard label="Level" value={state.userState.level} meta={`${levelProgress.progressPercent}% to next level`} icon={TrendingUp} tone="blue" />
          <StatCard label="Cases" value={state.userState.casesCompleted} meta="Completed" icon={BookOpen} tone="green" />
          <StatCard label="Performance" value={`${recentAccuracy}%`} meta="Recent performance" icon={Target} tone="violet" />
          <StatCard label="Streak" value={state.userState.streak} meta={`Longest: ${longestStreak} day${longestStreak === 1 ? "" : "s"}`} icon={Flame} tone="orange" />
        </section>

        <Surface className="dashboard-card">
          <SectionHeader
            className="dashboard-mastery-header"
            title="Mastery"
            subtitle="Unlock new challenges as you progress"
          />
          <div className="dashboard-difficulty-grid">
            {difficultyMeta.map(item => {
              const unlocked = canAccessDifficulty(progressionInput, item.level);
              return unlocked ? (
                <Link key={item.key} className="dashboard-difficulty-card" to={`/practice?difficulty=${item.key}`}>
                  <span className="dashboard-difficulty-card__status is-unlocked">Unlocked</span>
                  <strong>{item.label}</strong>
                </Link>
              ) : (
                <article key={item.key} className="dashboard-difficulty-card is-locked">
                  <span className="dashboard-difficulty-card__status">Locked</span>
                  <strong>{item.label}</strong>
                  <p>Unlock at level {item.unlockLevel}</p>
                </article>
              );
            })}
          </div>
        </Surface>

        <footer className="dashboard-footer">
          <p>&copy; 2026 ABG Master. All rights reserved.</p>
          <p>
            This application is for educational purposes only and should not be used as a substitute for professional
            medical advice, diagnosis, or treatment.
          </p>
          <p>Uses Google Analytics and Microsoft Clarity for anonymised usage insights.</p>
          <div className="dashboard-footer__actions">
            <button className="figma-button figma-button--secondary dashboard-footer__reset" type="button" onClick={handleResetProgress}>
              Reset progress
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
