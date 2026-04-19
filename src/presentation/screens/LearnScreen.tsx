import { ArrowRight, BookOpen, Lock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { learnLevels } from "../learn/content";
import { ProgressBar } from "../primitives/ProgressBar";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

const LEARN_CARD_PROGRESS = 0;

export function LearnScreen() {
  const { state } = useAppContext();
  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  return (
    <main className="app-shell__page learn-overview">
      <div className="learn-overview__container">
        <div className="learn-overview__grid">
          {learnLevels.map(level => {
            const lessonCountLabel = `${level.lessons.length} module${level.lessons.length === 1 ? "" : "s"}`;

            return (
              <Surface
                key={level.slug}
                as="article"
                className={`learn-level-card${level.locked ? " is-locked" : ""}`}
                aria-disabled={level.locked ? "true" : undefined}
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
                  <span className="learn-level-card__pill">
                    <TrendingUp />
                    {LEARN_CARD_PROGRESS}% Complete
                  </span>
                </div>

                <div className="learn-level-card__footer">
                  {level.locked ? (
                    <button className="figma-button learn-level-card__cta" type="button" disabled>
                      Locked
                      <Lock />
                    </button>
                  ) : (
                    <Link className="figma-button learn-level-card__cta" to={`/learn/${level.slug}`}>
                      Start Learning
                      <ArrowRight />
                    </Link>
                  )}
                  <ProgressBar value={LEARN_CARD_PROGRESS} className="learn-level-card__progress" />
                </div>
              </Surface>
            );
          })}
        </div>

      </div>
    </main>
  );
}
