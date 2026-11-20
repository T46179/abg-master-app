import { cn } from "../utils";
import { MetricLabel, MetricReference, MetricValue } from "./MetricText";

interface MetricCardProps {
  label: string;
  renderedValue: string;
  unit: string;
  reference?: string;
  abnormal?: boolean;
  group?: "oxygenation";
  pressureUnitConvertible?: boolean;
}

export function MetricCard({ label, renderedValue, unit, reference, abnormal, group, pressureUnitConvertible }: MetricCardProps) {
  return (
    <article className={cn(
      "metric-card",
      group === "oxygenation" && "metric-card--oxygenation",
      pressureUnitConvertible && "metric-card--pressure-unit-convertible"
    )}>
      <span className="metric-card__label"><MetricLabel label={label} /></span>
      <MetricValue renderedValue={renderedValue} unit={unit} abnormal={abnormal} />
      {reference !== undefined && <MetricReference reference={reference} />}
    </article>
  );
}
