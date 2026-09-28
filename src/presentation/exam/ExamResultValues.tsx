import { useId, useRef, useState } from "react";
import type { PressureUnit } from "../../core/types";
import { MetricLabel, MetricValue } from "../practice/MetricText";
import { SecondaryMetricRail } from "../practice/SecondaryMetricRail";
import { presentExamMetric } from "./ExamValues";
import type { ExamTable } from "./sittingTypes";

const CORE = ["pH", "PaCO2", "PCO2", "CO2", "HCO3"];
const SECONDARY = ["FiO2", "PaO2", "PO2", "SpO2", "SaO2", "Na", "K", "Cl", "Ca", "Mg"];
const rank = (label: string, order: string[]) => order.includes(label) ? order.indexOf(label) : Infinity;

/** Compact review layout using the same metric formatting and scrolling as the sitting. */
export function ExamResultValues({ table, pressureUnit, visible }: {
  table: ExamTable; pressureUnit: PressureUnit; visible: boolean;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const cardRef = useRef<HTMLElement>(null);
  const core = table.rows.filter(row => CORE.includes(row.label)).sort((a, b) => rank(a.label, CORE) - rank(b.label, CORE));
  const rest = table.rows.filter(row => !CORE.includes(row.label)).sort((a, b) => rank(a.label, SECONDARY) - rank(b.label, SECONDARY));
  return <section ref={cardRef} className="exam-results__values" aria-label={table.heading}>
    <button type="button" className="exam-results__table-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className="exam-results__eyebrow">{table.heading}</span><span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
    </button>
    <div id={id} hidden={!open} className="exam-results__table-body">
      {!!core.length && <div className="exam-results__core-values">{core.map(row => {
        const metric = presentExamMetric(row, pressureUnit);
        return <div key={row.id} className="exam-results__metric"><span><MetricLabel label={metric.label} /></span>
          <MetricValue renderedValue={metric.renderedValue} unit={metric.unit} /></div>;
      })}</div>}
      {!!rest.length && <SecondaryMetricRail metrics={rest.map(row => presentExamMetric(row, pressureUnit))}
        interactionRef={cardRef} interactionEnabled={open && visible}
        contentKey={`${table.id}:${pressureUnit}:${visible}:${open}`} showReferences={false} showAbnormalHighlighting={false} indicator="hint" />}
    </div>
  </section>;
}
