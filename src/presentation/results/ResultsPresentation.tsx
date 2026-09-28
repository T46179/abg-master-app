import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import { Surface } from "../primitives/Surface";
import { cn } from "../utils";

export function ExpandCollapseIcon({ expanded }: { expanded: boolean }) {
  return <span className={cn("results-card__collapse-icon", expanded ? "results-card__collapse-icon--collapse" : "results-card__collapse-icon--expand")} aria-hidden="true" />;
}

export function ResultsHeaderShell({ title, subtitle, metadata, children }: {
  title: string; subtitle: ReactNode; metadata?: ReactNode; children?: ReactNode;
}) {
  return <Surface className="results-summary-card">
    <div className="results-card__hero">
      <div className="results-card__hero-copy">
        <span className="results-card__icon" aria-hidden="true"><Trophy /></span>
        <div className="results-card__hero-text"><h1>{title}</h1><p>{subtitle}</p></div>
      </div>
      {metadata}
    </div>
    {children}
  </Surface>;
}

export function ResultsDetailCard({ title, expanded = true, onToggle, takeaway, children }: {
  title: string; expanded?: boolean; onToggle?: () => void; takeaway?: boolean; children: ReactNode;
}) {
  return <div className={cn("card", "results-card__detail-card", !expanded && "is-collapsed", takeaway && "results-card__detail-card--takeaway")}>
    <div className="results-card__detail-card-header">
      <h4>{title}</h4>
      {onToggle && <button className="results-card__detail-toggle" type="button" aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`} onClick={onToggle}>
        <ExpandCollapseIcon expanded={expanded} />
      </button>}
    </div>
    {expanded ? children : null}
  </div>;
}
