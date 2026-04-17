import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { learnLevels } from "../learn/content";
import { Surface } from "../primitives/Surface";
import { SectionHeader } from "../primitives/SectionHeader";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function LearnScreen() {
  const { state } = useAppContext();
  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  return (
    <main className="app-shell__page learn-overview">
      <div className="learn-overview__container">
        <Surface className="learn-overview__hero" tone="hero">
          <SectionHeader
            eyebrow="Learn"
            title="Learn ABG Interpretation"
            subtitle="Move from foundations to mixed disorders through short, visual modules built for fast pattern recognition."
          />
          <div className="learn-overview__hero-note">
            Start anywhere for now. Later, these modules can be gated behind level-based unlocks.
          </div>
        </Surface>

        <div className="learn-overview__grid">
          {learnLevels.map(level => (
            level.locked ? (
                <Surface key={level.slug} as="article" className="learn-level-card is-locked" aria-disabled="true">
                  <div className="learn-level-card__topline">
                    <span className="learn-level-card__lock">
                      <Lock />
                      {level.lockedLabel ?? "Locked"}
                  </span>
                </div>
                <div className="learn-level-card__copy">
                  <h2>{level.title}</h2>
                  <strong>{level.subtitle}</strong>
                  <p>{level.description}</p>
                </div>
                <div className="learn-level-card__meta">
                  <span>{level.lessons.length} lesson{level.lessons.length === 1 ? "" : "s"}</span>
                </div>
              </Surface>
            ) : (
              <Surface key={level.slug} as={Link} to={`/learn/${level.slug}`} className="learn-level-card">
                <div className="learn-level-card__topline">
                </div>
                <div className="learn-level-card__copy">
                  <h2>{level.title}</h2>
                  <strong>{level.subtitle}</strong>
                  <p>{level.description}</p>
                </div>
                <div className="learn-level-card__meta">
                  <span>{level.lessons.length} lesson{level.lessons.length === 1 ? "" : "s"}</span>
                </div>
              </Surface>
            )
          ))}
        </div>

      </div>
    </main>
  );
}
