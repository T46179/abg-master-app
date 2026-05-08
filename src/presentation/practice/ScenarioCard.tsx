import { Surface } from "../primitives/Surface";
import { CaseMetadataIcons } from "./CaseMetadataIcons";
import type { CaseData } from "../../core/types";

export function ScenarioCard({
  clinicalStem,
  caseItem
}: {
  clinicalStem: string | null | undefined;
  caseItem?: Pick<CaseData, "source_type"> | null;
}) {
  return (
    <Surface className="practice-scenario-card">
      <div className="practice-scenario-card__header">
        <span className="section-header__eyebrow">Clinical scenario</span>
        <CaseMetadataIcons caseItem={caseItem} />
      </div>
      <p className="practice-scenario-card__body">
        {clinicalStem ?? "No clinical scenario was supplied for this case."}
      </p>
    </Surface>
  );
}
