import {
  Activity,
  ArrowRight,
  FileText,
  Flame,
  Lightbulb,
  Stethoscope,
  Target,
  Trophy
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import {
  canAccessDifficulty,
  getCasesRemainingToday,
  getDifficultyMeta,
  getLevelProgress,
  getReadinessGateProgressMessage
} from "../../core/progression";
import { getDefaultPracticeDifficulty } from "../../app/viewHelpers";
import arrowRightIconUrl from "../../assets/icons/arrow_right.svg";
import { AppFooter } from "../layout/AppFooter";
import {
  getVisibleLearnLevels,
  isLearnLevelAvailable,
  isLearnLevelUnlocked,
  type LearnLevelConfig
} from "../learn/content";
import { ProgressBar } from "../primitives/ProgressBar";
import { StatCard } from "../primitives/StatCard";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";
import { getDailyClinicalPearl } from "./clinicalPearls";

const featuredCasePreviews = [
  { icon: FileText, label: "Challenging and unique cases" },
  { icon: Stethoscope, label: "Based on real clinical scenarios" }
];

function formatDashboardDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function getLearnProgressPercent(level: LearnLevelConfig, completedLessonCount: number, completed: boolean) {
  if (completed) return 100;
  if (!level.lessons.length) return 0;
  return Math.min(99, Math.round((Math.min(level.lessons.length, Math.max(0, completedLessonCount)) / level.lessons.length) * 100));
}

export function DashboardScreen() {
  const { state } = useAppContext();
  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  const payload = state.payload;
  const progressionInput = {
    progressionConfig: payload?.progressionConfig ?? null,
    dashboardState: payload?.dashboardState ?? null,
    defaultUserState: payload?.defaultUserState ?? null,
    userState: state.userState,
    cases: payload?.cases ?? []
  };
  const levelProgress = getLevelProgress(payload?.progressionConfig ?? null, state.userState);
  const readinessGateProgressMessage = levelProgress.isBlockedByReadinessGate
    ? getReadinessGateProgressMessage(payload?.progressionConfig ?? null, levelProgress.blockedDifficulty)
    : null;
  const difficultyMeta = getDifficultyMeta(progressionInput);
  const recentAttempts = (state.userState.recentPracticeAttempts ?? []).slice(-10);
  const recentCorrectSteps = recentAttempts.reduce((sum, attempt) => sum + Math.max(0, Number(attempt.correctSteps ?? 0)), 0);
  const recentTotalSteps = recentAttempts.reduce((sum, attempt) => sum + Math.max(0, Number(attempt.totalSteps ?? 0)), 0);
  const recentAccuracy = recentTotalSteps ? Math.round((recentCorrectSteps / recentTotalSteps) * 100) : 100;
  const casesRemaining = getCasesRemainingToday(payload?.progressionConfig ?? null, state.userState);
  const longestStreak = state.userState.longestStreak ?? state.userState.streak ?? 0;
  const defaultDifficulty = getDefaultPracticeDifficulty(
    progressionInput,
    state.storage?.loadLastPracticeDifficulty() ?? null
  );
  const unlockedDifficulties = difficultyMeta.filter(item => canAccessDifficulty(progressionInput, item.level));
  const currentTier = unlockedDifficulties.at(-1)?.label ?? "Beginner";
  const learningPath = getVisibleLearnLevels(state.userState.level).filter(level => level.slug !== "hidden");
  const dailyClinicalPearl = getDailyClinicalPearl();

  return (
    <main className="app-shell__page dashboard-screen">
      <div className="dashboard-screen__container">
        <Surface className="dashboard-progress-card">
          <div className="dashboard-progress-card__meta">
            <span>
              <strong>Level {state.userState.level}</strong>
              <span className="dashboard-progress-card__tier">{currentTier}</span>
            </span>
            <span>{levelProgress.xpIntoLevel} / {levelProgress.xpForNextLevel || levelProgress.xpIntoLevel} XP</span>
          </div>
          <ProgressBar value={levelProgress.progressPercent} blocked={levelProgress.isBlockedByReadinessGate} />
          <p className={`dashboard-progress-card__remaining${readinessGateProgressMessage ? " is-readiness-gate" : ""}`}>
            {readinessGateProgressMessage ?? (levelProgress.isMaxLevel
              ? "Max level"
              : levelProgress.xpForNextLevel
              ? `${Math.max(0, levelProgress.xpForNextLevel - levelProgress.xpIntoLevel)} XP until Level ${state.userState.level + 1}`
              : "Max level")}
          </p>
        </Surface>

        <section className="dashboard-feature-grid">
          <Surface className="dashboard-resume-card">
            <div className="dashboard-card-glow dashboard-card-glow--lavender" aria-hidden="true" />
            <div className="dashboard-resume-card__content">
              <span className="dashboard-eyebrow">{formatDashboardDate()}</span>
              <h1>Welcome back</h1>
              <p>
                {casesRemaining == null
                  ? "Unlimited cases available today"
                  : `${casesRemaining} case${casesRemaining === 1 ? "" : "s"} remaining today.`}
              </p>
              <div className="dashboard-resume-card__action">
                <Link className="dashboard-resume-button" to={`/practice?difficulty=${defaultDifficulty}`}>
                  <span>Resume Practice</span>
                  <img src={arrowRightIconUrl} alt="" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Surface>

          <Surface className="dashboard-featured-card">
            <div className="dashboard-featured-card__content">
              <div className="dashboard-featured-card__header">
                <div className="dashboard-featured-card__eyebrow">
                  <span className="dashboard-eyebrow">Featured Case</span>
                </div>
                <span className="dashboard-coming-soon">Coming Soon</span>
              </div>
              <h2>Hand-picked cases</h2>
              <p>A curated rotation of clinically rich gases, annotated with reasoning notes and regularly refreshed.</p>
              <div className="dashboard-featured-card__previews">
                {featuredCasePreviews.map(({ icon: Icon, label }) => (
                  <div key={label}>
                    <span className="dashboard-round-icon"><Icon aria-hidden="true" /></span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Surface>
        </section>

        <section className="dashboard-stats-grid" aria-label="Progress summary">
          <Link className="dashboard-stat-link" to="/insights" aria-label="View insights for cases solved">
            <StatCard
              label="Cases Solved"
              value={state.userState.casesCompleted}
              meta="Completed"
              icon={Activity}
              tone="blue"
            />
          </Link>
          <Link className="dashboard-stat-link" to="/insights" aria-label="View accuracy insights">
            <StatCard
              label="Accuracy"
              value={`${recentAccuracy}%`}
              meta="Last 10 cases"
              icon={Target}
              tone="green"
            />
          </Link>
          <Link className="dashboard-stat-link" to="/insights" aria-label="View current tier insights">
            <StatCard label="Current Tier" value={currentTier} meta={`Level ${state.userState.level}`} icon={Trophy} tone="violet" />
          </Link>
          <Link className="dashboard-stat-link" to="/insights" aria-label="View streak insights">
            <StatCard label="Daily Streak" value={state.userState.streak} meta={`Personal best: ${longestStreak}`} icon={Flame} tone="orange" />
          </Link>
        </section>

        <section className="dashboard-learning-grid">
          <Surface className="dashboard-learning-path">
            <div className="dashboard-section-heading">
              <div>
                <h2>Learning Progress</h2>
              </div>
              <Link className="dashboard-all-modules-link" to="/learn?all=1">
                All modules
                <img src={arrowRightIconUrl} alt="" aria-hidden="true" />
              </Link>
            </div>
            <div className="dashboard-module-list">
              {learningPath.map((level, index) => {
                const progress = state.userState.learnProgress?.[level.slug];
                const progressPercent = getLearnProgressPercent(level, progress?.completedLessonCount ?? 0, Boolean(progress?.completed));
                const unlocked = isLearnLevelUnlocked(level, state.userState.level);
                const available = isLearnLevelAvailable(level);
                const canOpen = unlocked && available;
                const status = progressPercent === 100 ? "Complete" : !available ? "Coming Soon" : !unlocked ? "Locked" : `${progressPercent}%`;
                const content = (
                  <>
                    <span className={`dashboard-module-row__rail dashboard-module-row__rail--${index + 1}`} aria-hidden="true" />
                    <span className="dashboard-module-row__body">
                      <span className="dashboard-module-row__heading">
                        <strong>{level.title}</strong>
                        <span>{status}</span>
                      </span>
                      <span className="dashboard-module-row__description">{level.subtitle}</span>
                      <span className="dashboard-module-row__progress" aria-hidden="true">
                        <span style={{ width: `${Math.max(progressPercent, 4)}%` }} />
                      </span>
                    </span>
                  </>
                );

                return canOpen ? (
                  <Link
                    key={level.slug}
                    className="dashboard-module-row"
                    to={`/learn/${level.slug}?mode=${progress?.completed ? "review" : progress ? "continue" : "start"}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={level.slug} className="dashboard-module-row is-disabled" aria-disabled="true">
                    {content}
                  </div>
                );
              })}
            </div>
          </Surface>

          <Surface className="dashboard-pearl-card">
            <div className="dashboard-card-glow dashboard-card-glow--pearl" aria-hidden="true" />
            <div className="dashboard-pearl-card__content">
              <div className="dashboard-pearl-card__eyebrow">
                <span className="dashboard-round-icon dashboard-round-icon--blue"><Lightbulb aria-hidden="true" /></span>
                <span className="dashboard-eyebrow">Clinical Pearl</span>
              </div>
              <p>{dailyClinicalPearl}</p>
            </div>
          </Surface>
        </section>
      </div>
      <AppFooter />
    </main>
  );
}
