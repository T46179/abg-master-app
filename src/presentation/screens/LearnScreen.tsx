import { GraduationCap } from "lucide-react";
import { useAppContext } from "../../app/AppProvider";
import { canAccessLearn, getDifficultyLabel, getDifficultyMeta } from "../../core/progression";
import { Surface } from "../primitives/Surface";
import { SectionHeader } from "../primitives/SectionHeader";
import { TeaserPanel } from "../primitives/TeaserPanel";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function LearnScreen() {
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
  const learnEnabled = canAccessLearn(progressionInput);

  if (!learnEnabled) {
    return (
      <TeaserPanel
        title="Learn Mode Coming Soon"
        description="Interactive lessons and tutorials on ABG interpretation will be available here. Master the theory before putting it into practice."
        icon={GraduationCap}
        featureLabel="Feature Under Development"
        items={[
          { title: "Theory Modules", description: "pH, CO2, and HCO3 basics" },
          { title: "Compensation Rules", description: "How the body responds" },
          { title: "Anion Gap", description: "Calculating and interpreting" },
          { title: "Mixed Disorders", description: "Advanced interpretation" }
        ]}
      />
    );
  }

  const objectivesByDifficulty = new Map<string, string[]>();
  for (const caseItem of payload?.cases ?? []) {
    const difficultyKey = getDifficultyLabel(payload?.progressionConfig ?? null, Number(caseItem.difficulty_level ?? 1));
    if (!objectivesByDifficulty.has(difficultyKey)) objectivesByDifficulty.set(difficultyKey, []);
    const bucket = objectivesByDifficulty.get(difficultyKey) ?? [];
    if (bucket.length < 3 && caseItem.learning_objective) bucket.push(caseItem.learning_objective);
  }

  const difficultyMeta = getDifficultyMeta(progressionInput);

  return (
    <main className="app-shell__page learn-screen">
      <div className="learn-screen__container">
        <Surface className="learn-screen__hero">
          <SectionHeader
            eyebrow="Learn"
            title="Learning objectives from the live runtime payload"
            subtitle="This keeps the Figma screen structure while only surfacing content already present in the current dataset."
          />
        </Surface>

        <div className="learn-screen__grid">
          {difficultyMeta.map(item => (
            <Surface key={item.key} className="learn-card">
              <span className="section-header__eyebrow">{item.label}</span>
              <h2>{item.availableCases} cases available</h2>
              <div className="learn-card__points">
                {(objectivesByDifficulty.get(item.key) ?? []).length ? (
                  (objectivesByDifficulty.get(item.key) ?? []).map(objective => (
                    <div key={objective} className="learn-card__point">{objective}</div>
                  ))
                ) : (
                  <div className="learn-card__point">Learning objectives will appear here as qualifying cases are added.</div>
                )}
              </div>
            </Surface>
          ))}
        </div>
      </div>
    </main>
  );
}
