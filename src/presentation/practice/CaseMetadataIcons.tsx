import type { CaseData } from "../../core/types";

const AUTHORED_CASE_TOOLTIP = "This case has been adapted from a real-life clinical scenario";

function StethoscopeIcon() {
  return (
    <svg className="case-metadata-icon__svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M7 1H1V15C1 20.5 5.5 25 11 25C16.5 25 21 20.5 21 15V1H15" />
      <path d="M11 25V32.5C11 40.5 17.5 47 25.5 47C33.5 47 40 40.5 40 32.5V23" />
      <path d="M40 23C43.866 23 47 19.866 47 16C47 12.134 43.866 9 40 9C36.134 9 33 12.134 33 16C33 19.866 36.134 23 40 23Z" />
    </svg>
  );
}

export function CaseMetadataIcons({ caseItem }: { caseItem?: Pick<CaseData, "source_type"> | null }) {
  if (caseItem?.source_type !== "authored") return null;

  return (
    <span className="case-metadata-icons" aria-label={AUTHORED_CASE_TOOLTIP}>
      <span className="case-metadata-icon case-metadata-icon--authored" aria-hidden="true">
        <StethoscopeIcon />
      </span>
      <span className="case-metadata-icons__tooltip" role="tooltip">
        {AUTHORED_CASE_TOOLTIP}
      </span>
    </span>
  );
}
