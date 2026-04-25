import type { CSSProperties } from "react";
import { ArrowRight, BookOpen, TrendingUp } from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import lockIcon from "../../assets/icons/lock.svg";
import timerIcon from "../../assets/icons/timer.svg";
import { getVisibleLearnLevels, isLearnLevelAvailable, isLearnLevelUnlocked } from "../learn/content";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";
import type { LearnModuleProgress } from "../../core/types";

function getLearnModuleProgressPercent(progress: LearnModuleProgress | undefined, lessonCount: number): number {
  if (!progress || lessonCount <= 0) return 0;
  if (progress.completed) return 100;

  const completedLessonCount = Math.min(lessonCount, Math.max(0, progress.completedLessonCount));
  return Math.min(99, Math.round((completedLessonCount / lessonCount) * 100));
}

function getLearnModuleCtaLabel(progress: LearnModuleProgress | undefined): string {
  if (progress?.completed) return "Review";
  if (progress) return "Continue";
  return "Start Learning";
}

function formatSpeedCheckTime(elapsedMs: number): string {
  return `${Math.max(0, Math.round(elapsedMs / 1000))}s`;
}

function readLastLearnModuleSlug() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("abg-master:learn:last-module");
}

export function LearnScreen() {
  const { state } = useAppContext();
  const [searchParams] = useSearchParams();
  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  const visibleLearnLevels = getVisibleLearnLevels(state.userState.level);
  const lastLearnModuleSlug = searchParams.get("all") === "1" ? null : readLastLearnModuleSlug();
  const lastLearnModule = visibleLearnLevels.find(level =>
    level.slug === lastLearnModuleSlug && isLearnLevelUnlocked(level, state.userState.level)
  );

  if (lastLearnModule) {
    return <Navigate to={`/learn/${lastLearnModule.slug}`} replace />;
  }

  return (
    <main className="app-shell__page learn-overview">
      <div className="learn-overview__container">
        <div className="learn-overview__grid">
          {visibleLearnLevels.map(level => {
            const lessonCountLabel = `${level.lessons.length} lesson${level.lessons.length === 1 ? "" : "s"}`;
            const moduleProgress = state.userState.learnProgress?.[level.slug];
            const progressPercent = getLearnModuleProgressPercent(moduleProgress, level.lessons.length);
            const hasStartedModule = progressPercent > 0;
            const bestSpeedCheckResult = level.slug === "foundations" ? moduleProgress?.bestSpeedCheckResult : undefined;
            const ctaLabel = getLearnModuleCtaLabel(moduleProgress);
            const isUnlocked = isLearnLevelUnlocked(level, state.userState.level);
            const isAvailable = isLearnLevelAvailable(level);
            const canOpenLevel = isUnlocked && isAvailable;
            const cardStyle = {
              "--learn-card-bg-start": level.palette.backgroundStart,
              "--learn-card-bg-end": level.palette.backgroundEnd,
              "--learn-card-accent-light": level.palette.accentLight,
              "--learn-card-accent-dark": level.palette.accentDark
            } as CSSProperties;

            return (
              <Surface
                key={level.slug}
                as="article"
                className={`learn-level-card is-accent-preview${canOpenLevel ? "" : " is-locked"}`}
                style={cardStyle}
                aria-disabled={canOpenLevel ? undefined : "true"}
              >
                <div className="learn-level-card__copy">
                  <h2>{level.title}</h2>
                  <strong>{level.subtitle}</strong>
                </div>

                <div className="learn-level-card__pills" aria-label={`${level.title} details`}>
                  <span className="learn-level-card__pill">
                    <BookOpen />
                    {lessonCountLabel}
                  </span>
                  {hasStartedModule ? (
                    <span className="learn-level-card__pill">
                      <TrendingUp />
                      {progressPercent}% Complete
                    </span>
                  ) : null}
                  {bestSpeedCheckResult ? (
                    <span className="learn-level-card__pill learn-level-card__pill--speed-check">
                      <img src={timerIcon} alt="" aria-hidden="true" />
                      {formatSpeedCheckTime(bestSpeedCheckResult.elapsedMs)}
                    </span>
                  ) : null}
                </div>

                <div className="learn-level-card__footer">
                  {canOpenLevel ? (
                    <Link className="figma-button learn-level-card__cta" to={`/learn/${level.slug}`}>
                      {ctaLabel}
                      <ArrowRight />
                    </Link>
                  ) : (
                    <button className="figma-button learn-level-card__cta" type="button" disabled>
                      {isAvailable ? `Unlocks at Level ${level.unlockLevel}` : "Coming Soon"}
                      <img className="learn-level-card__cta-icon" src={lockIcon} alt="" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </Surface>
            );
          })}
        </div>

      </div>
    </main>
  );
}
