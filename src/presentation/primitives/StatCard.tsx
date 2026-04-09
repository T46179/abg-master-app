import { useId } from "react";
import { Info, type LucideIcon } from "lucide-react";
import { Surface } from "./Surface";
import { cn } from "../utils";

interface StatCardProps {
  label: string;
  value: string | number;
  meta: string;
  metaTooltip?: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "violet" | "orange";
}

export function StatCard(props: StatCardProps) {
  const Icon = props.icon;
  const tooltipId = useId();

  return (
    <Surface className="stat-card">
      <div className="stat-card__header">
        <span className={cn("stat-card__icon", `stat-card__icon--${props.tone}`)} aria-hidden="true">
          <Icon strokeWidth={2} />
        </span>
        <span className="stat-card__label">{props.label}</span>
      </div>
      <div className="stat-card__value">{props.value}</div>
      <p className="stat-card__meta">
        <span>{props.meta}</span>
        {props.metaTooltip ? (
          <span className="stat-card__meta-info">
            <button
              className="stat-card__meta-trigger"
              type="button"
              aria-label={`More information about ${props.meta.toLowerCase()}`}
              aria-describedby={tooltipId}
            >
              <Info strokeWidth={2.2} />
            </button>
            <span className="stat-card__meta-tooltip" id={tooltipId} role="tooltip">
              {props.metaTooltip}
            </span>
          </span>
        ) : null}
      </p>
    </Surface>
  );
}
