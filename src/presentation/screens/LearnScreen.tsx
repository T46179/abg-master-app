import type { CSSProperties } from "react";
import { ArrowRight, BookOpen, Lock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { getVisibleLearnLevels, isLearnLevelUnlocked } from "../learn/content";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

const LEARN_CARD_PROGRESS: number = 0;

export function LearnScreen() {
  const { state } = useAppContext();
  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  const visibleLearnLevels = getVisibleLearnLevels(state.userState.level);

  return (
    <main className="app-shell__page learn-overview">
      <div className="learn-overview__container">
        <div className="learn-overview__grid">
          {visibleLearnLevels.map(level => {
            const lessonCountLabel = `${level.lessons.length} module${level.lessons.length === 1 ? "" : "s"}`;
            const hasStartedModule = LEARN_CARD_PROGRESS > 0;
            const isUnlocked = isLearnLevelUnlocked(level, state.userState.level);
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
                className={`learn-level-card is-accent-preview${isUnlocked ? "" : " is-locked"}`}
                style={cardStyle}
                aria-disabled={isUnlocked ? undefined : "true"}
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
                      {LEARN_CARD_PROGRESS}% Complete
                    </span>
                  ) : null}
                </div>

                <div className="learn-level-card__footer">
                  {isUnlocked ? (
                    <Link className="figma-button learn-level-card__cta" to={`/learn/${level.slug}`}>
                      Start Learning
                      <ArrowRight />
                    </Link>
                  ) : (
                    <button className="figma-button learn-level-card__cta" type="button" disabled>
                      Unlocks at Level {level.unlockLevel}
                      <Lock />
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
