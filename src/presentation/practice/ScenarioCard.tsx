import { Surface } from "../primitives/Surface";

export function ScenarioCard({ clinicalStem }: { clinicalStem: string | null | undefined }) {
  return (
    <Surface className="practice-scenario-card">
      <span className="section-header__eyebrow">Clinical scenario</span>
      <p className="practice-scenario-card__body">
        {clinicalStem ?? "No clinical scenario was supplied for this case."}
      </p>
    </Surface>
  );
}
