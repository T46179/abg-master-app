import type { DrillQuestion } from "../../core/examDrills";
import { formatMetricReferenceLimit, formatValue, standardMetricRanges } from "../../core/metrics";
import { MetricCard } from "../practice/MetricCard";

const metricLabels = new Map([
  ["PaCO₂", "PaCO2"], ["PaO₂", "PaO2"], ["FiO₂", "FiO2"],
  ["HCO₃⁻", "HCO3"], ["Na⁺", "Na"], ["Cl⁻", "Cl"],
]);

const referenceRanges = new Map(Object.entries({
  ...standardMetricRanges,
  "Anion gap": [8, 16] as const,
}));

function presentDrillMetric(tile: DrillQuestion["values"][number]) {
  const { value, unit, decimals } = tile;
  const label = metricLabels.get(tile.label) ?? tile.label;
  const range = referenceRanges.get(label);
  const pressure = unit === "mmHg" || unit === "kPa";
  const oxygenation = label === "PaO2" || label === "FiO2";
  // Pressure inputs arrive in the chosen unit and are already rounded by the generator.
  const low = range && formatMetricReferenceLimit(range[0], unit);
  const high = range && formatMetricReferenceLimit(range[1], unit);
  const hasRange = low !== undefined && high !== undefined;

  return {
    label,
    unit,
    renderedValue: decimals === undefined ? String(value) : formatValue(value, decimals),
    reference: tile.reference ?? (hasRange ? `${low} - ${high}${unit ? ` ${unit}` : ""}` : undefined),
    abnormal: hasRange && (value < Number(low) || value > Number(high)),
    group: oxygenation ? "oxygenation" as const : undefined,
    pressureUnitConvertible: pressure,
  };
}

export function DrillValues({ values }: Pick<DrillQuestion, "values">) {
  return <div className="metric-grid exam-drill-values" role="group" aria-label="Question values">
    {values.map(tile => <MetricCard key={tile.label} {...presentDrillMetric(tile)} />)}
  </div>;
}
