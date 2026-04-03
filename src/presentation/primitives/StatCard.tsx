import type { LucideIcon } from "lucide-react";
import { Surface } from "./Surface";
import { cn } from "../utils";

interface StatCardProps {
  label: string;
  value: string | number;
  meta: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "violet" | "orange";
}

export function StatCard(props: StatCardProps) {
  const Icon = props.icon;

  return (
    <Surface className="stat-card">
      <div className="stat-card__header">
        <span className={cn("stat-card__icon", `stat-card__icon--${props.tone}`)} aria-hidden="true">
          <Icon strokeWidth={2} />
        </span>
        <span className="stat-card__label">{props.label}</span>
      </div>
      <div className="stat-card__value">{props.value}</div>
      <p className="stat-card__meta">{props.meta}</p>
    </Surface>
  );
}
