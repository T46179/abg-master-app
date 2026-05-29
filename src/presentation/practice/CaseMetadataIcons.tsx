import type { ReactNode } from "react";
import type { CaseData } from "../../core/types";
import flashIcon from "../../assets/icons/flash.svg";

const AUTHORED_CASE_TOOLTIP = "This case has been adapted from a real-life clinical scenario";
const OXYGENATION_CASE_TOOLTIP = "This is an arterial blood gas and requires oxygenation interpretation. Unless stated otherwise, oxygenation calculations assume sea-level atmospheric pressure.";
const BOOSTED_XP_TOOLTIP = "This case earns bonus XP";

interface CaseMetadataIconItem {
  key: string;
  className: string;
  tooltip: string;
  icon: ReactNode;
}

function StethoscopeIcon() {
  return (
    <svg className="case-metadata-icon__svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M7 1H1V15C1 20.5 5.5 25 11 25C16.5 25 21 20.5 21 15V1H15" />
      <path d="M11 25V32.5C11 40.5 17.5 47 25.5 47C33.5 47 40 40.5 40 32.5V23" />
      <path d="M40 23C43.866 23 47 19.866 47 16C47 12.134 43.866 9 40 9C36.134 9 33 12.134 33 16C33 19.866 36.134 23 40 23Z" />
    </svg>
  );
}

function SyringeIcon() {
  return <span className="case-metadata-icon__svg case-metadata-icon__svg--syringe" aria-hidden="true" />;
}

export function CaseMetadataIcons({
  caseItem,
  boostedXp = false
}: {
  caseItem?: Pick<CaseData, "case_features" | "source_type"> | null;
  boostedXp?: boolean;
}) {
  const items: CaseMetadataIconItem[] = [];

  if (caseItem?.source_type === "authored") {
    items.push({
      key: "authored",
      className: "case-metadata-icon--authored",
      tooltip: AUTHORED_CASE_TOOLTIP,
      icon: <StethoscopeIcon />
    });
  }

  if (caseItem?.case_features?.includes("oxygenation_focus")) {
    items.push({
      key: "oxygenation",
      className: "case-metadata-icon--oxygenation",
      tooltip: OXYGENATION_CASE_TOOLTIP,
      icon: <SyringeIcon />
    });
  }

  if (boostedXp) {
    items.push({
      key: "boosted-xp",
      className: "case-metadata-icon--boosted-xp",
      tooltip: BOOSTED_XP_TOOLTIP,
      icon: <img className="case-metadata-icon__svg" src={flashIcon} alt="" aria-hidden="true" />
    });
  }

  if (!items.length) return null;

  return (
    <span className="case-metadata-icons">
      {items.map(item => (
        <span key={item.key} className="case-metadata-icons__item" aria-label={item.tooltip}>
          <span className={`case-metadata-icon ${item.className}`} aria-hidden="true">
            {item.icon}
          </span>
          <span className="case-metadata-icons__tooltip" role="tooltip">
            {item.tooltip}
          </span>
        </span>
      ))}
    </span>
  );
}
