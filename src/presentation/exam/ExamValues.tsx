import { convertMmHgToKPa, formatValue } from "../../core/metrics";
import type { CaseMetricDefinition, PressureUnit } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { MetricLabel, MetricReference, MetricValue } from "../practice/MetricText";
import { SecondaryMetricRail } from "../practice/SecondaryMetricRail";
import type { ExamMetric, ExamTable } from "./sittingTypes";

export function presentExamMetric(row: ExamMetric, pressureUnit: PressureUnit): CaseMetricDefinition & { renderedValue: string } {
  const convert = Boolean(row.pressure && pressureUnit === "kPa");
  const unit = row.pressure ? pressureUnit : row.unit;
  const precision: Record<string, number> = {
    pH: 2, PaCO2: 1, PCO2: 1, HCO3: 1, PaO2: 1, PO2: 1,
    SpO2: 0, SaO2: 0, Na: 0, K: 1, Cl: 0, Glucose: 1, Lactate: 1,
    "Base excess": 1,
  };
  const decimals = convert ? 1 : precision[row.label];
  const displayValue = convert ? convertMmHgToKPa(row.value) : row.value;
  // Preserve supplied precision for other metrics, including fractional FiO2.
  const renderedValue = decimals == null ? String(displayValue) : formatValue(displayValue, decimals);
  const suppliedRange = row.reference?.match(/^\s*(?:Normal:\s*)?([+-]?\d+(?:\.\d+)?)\s*(?:[–−-]|to)\s*([+-]?\d+(?:\.\d+)?)\s*(.*?)\s*$/);
  const low = row.refLow ?? (suppliedRange ? Number(suppliedRange[1]) : undefined);
  const high = row.refHigh ?? (suppliedRange ? Number(suppliedRange[2]) : undefined);
  const rangeValue = (value: number) => convert
    ? formatValue(convertMmHgToKPa(value), 1)
    : row.label === "K" || row.label === "Lactate" ? formatValue(value, 1) : String(value);
  const rangeUnit = unit || suppliedRange?.[3] || "";
  const reference = low != null && high != null
    ? `${rangeValue(low)} - ${rangeValue(high)}${rangeUnit ? ` ${rangeUnit}` : ""}`
    : row.reference ?? "—";
  return {
    label: row.label, displayLabel: row.label, value: Number(displayValue), decimals,
    unit: row.label === "FiO2" ? "" : unit, renderedValue,
    reference: row.label === "FiO2" ? "" : reference,
    abnormal: false, pressureUnitConvertible: row.pressure,
    group: row.oxygenation ? "oxygenation" : undefined
  };
}
export function ExamValues({ table, pressureUnit, showRanges }: { table: ExamTable; pressureUnit: PressureUnit; showRanges: boolean }) {
  const primary = table.rows.filter(r => r.primary);
  const secondary = table.rows.filter(r => !r.primary).map(r => presentExamMetric(r, pressureUnit));
  return <section className="exam-values" aria-label={table.heading}>
    {primary.length > 0 && <Surface className="value-panels__card value-panels__card--primary">
      <div className="value-panels__header"><span className="section-header__eyebrow">ABG values</span></div>
      <div className="metric-grid metric-grid--primary">
        {primary.map(row => {
          const metric = presentExamMetric(row, pressureUnit);
          return <article key={row.id} className={`metric-card${row.oxygenation ? " metric-card--oxygenation" : ""}${row.pressure ? " metric-card--pressure-unit-convertible" : ""}`}>
            <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
            <MetricValue renderedValue={metric.renderedValue} unit={metric.unit} />
            {showRanges && <MetricReference reference={metric.reference} />}
          </article>;
        })}
      </div>
    </Surface>}
    {secondary.length > 0 && <Surface className="value-panels__card value-panels__card--secondary value-panels__secondary--rail">
      <div className="value-panels__header"><span className="section-header__eyebrow">Electrolytes &amp; other values</span></div>
      <SecondaryMetricRail metrics={secondary} contentKey={table.id + pressureUnit + showRanges}
        showReferences={showRanges} showAbnormalHighlighting={false} />
    </Surface>}
  </section>;
}
