import type { DrillRequest, DrillVisual } from "../../core/examDrills";
import { formatMetricReferenceLimit, standardMetricRanges } from "../../core/metrics";
import { OxygenPressureBars } from "../practice/aaGradient/AAGradientVisualContent";
import { AnionGapClassificationGauge } from "../practice/anionGap/AnionGapVisualContent";
import { buildAnionGapVisualModel } from "../practice/anionGap/anionGapVisualModel";
import { CompensationRangeRail } from "../practice/compensation/CompensationVisualContent";
import { buildCompensationRangeGeometry } from "../practice/compensation/compensationVisualModel";
import { AccuracyBar } from "./ExamUi";

export function DrillResult({ visual, request }: { visual: DrillVisual; request: DrillRequest }) {
  if (request.drill === "compensation" && visual.kind === "range") {
    const { value, low, high, unit } = visual;
    const respiratory = request.rule === "respiratory";
    const targetLabel = respiratory ? "HCO₃⁻" : "PaCO₂";
    const referenceRange = standardMetricRanges[respiratory ? "HCO3" : "PaCO2"];
    const [referenceLow, referenceHigh] = referenceRange.map(limit => Number(formatMetricReferenceLimit(limit, unit)));
    const geometry = buildCompensationRangeGeometry(value, [
      { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: referenceLow, high: referenceHigh },
      { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low, high },
    ], String);
    const relationshipTo = (lower: number, upper: number) => value < lower ? "below" : value > upper ? "above" : "within";
    return <div className="exam-drill-visualiser">
      <div className="cmp">
        <CompensationRangeRail model={{
          ...geometry, targetLabel, measuredDisplay: String(value), unit,
          accessibleDescription: `Measured ${targetLabel}: ${value} ${unit}. `
            + `Reference: ${referenceLow} to ${referenceHigh} ${unit}, measured value ${relationshipTo(referenceLow, referenceHigh)}. `
            + `Expected: ${low} to ${high} ${unit}, measured value ${relationshipTo(low, high)}.`,
        }} />
      </div>
    </div>;
  }

  if (request.drill === "anion-gap" && visual.kind === "range") {
    const { value, low, high, unit } = visual;
    const model = buildAnionGapVisualModel({
      measuredValue: value, unit, referenceLowerLimit: low, referenceUpperLimit: high,
      classification: value < low ? "low" : value > high ? "raised" : "normal",
      includesPotassium: false,
    }, undefined, "");
    if (model.kind === "visual") return <div className="exam-drill-visualiser">
      <div className="ag">
        <AnionGapClassificationGauge reference={model.reference} unit={model.unit} primaryMarker={model.primaryMarker} />
        <p className="ag-visually-hidden">{model.accessibleDescription}</p>
      </div>
    </div>;
  }

  if (request.drill === "aa-gradient" && visual.kind === "difference" && (visual.unit === "mmHg" || visual.unit === "kPa")) {
    const { alveolar, arterial, gradient, unit } = visual;
    const arterialPercent = 100 * arterial / alveolar;
    const alveolarDisplay = alveolar.toFixed(1);
    const arterialDisplay = arterial.toFixed(1);
    const gradientDisplay = gradient.toFixed(1);
    return <div className="exam-drill-visualiser">
      <div className="aag">
        <OxygenPressureBars model={{
          unit,
          bars: {
            alveolar: { mainValue: alveolarDisplay },
            arterial: { mainValue: arterialDisplay },
            gradient: { mainValue: gradientDisplay },
          },
          geometry: { arterialPercent, gradientPercent: 100 - arterialPercent },
          accessibleDescription: `A–a gradient ${gradientDisplay} ${unit}. Estimated alveolar oxygen pressure ${alveolarDisplay} ${unit}; measured arterial oxygen pressure ${arterialDisplay} ${unit}.`,
        }} />
      </div>
    </div>;
  }

  return <BasicDrillResult visual={visual} />;
}

function BasicDrillResult({ visual }: { visual: DrillVisual }) {
  if (visual.kind === "difference") return <figure className="exam-drill-graphic">
    <figcaption>{visual.label}</figcaption>
    <div className="exam-drill-oxygen">
      <span>PAO₂ <strong>{visual.alveolar.toFixed(1)} {visual.unit}</strong></span>
      <AccuracyBar percent={100} tone="navy" />
      <span>PaO₂ <strong>{visual.arterial.toFixed(1)} {visual.unit}</strong></span>
      <AccuracyBar percent={100 * visual.arterial / visual.alveolar} tone="green" />
    </div>
    <p>A–a gradient <strong>{visual.gradient.toFixed(1)} {visual.unit}</strong></p>
  </figure>;
  const padding = (visual.high - visual.low) / 3;
  const start = Math.min(visual.low - padding, visual.value - padding);
  const end = Math.max(visual.high + padding, visual.value + padding);
  const position = (value: number) => `${100 * (value - start) / (end - start)}%`;
  return <figure className="exam-drill-graphic">
    <figcaption>{visual.label}</figcaption>
    <div className="exam-drill-scale" aria-hidden="true">
      <span className="exam-drill-scale-band" style={{ left: position(visual.low), right: `calc(100% - ${position(visual.high)})` }} />
      <span className="exam-drill-scale-marker" style={{ left: position(visual.value) }} />
    </div>
    <div className="exam-drill-scale-labels">
      <span>Value <strong>{visual.value} {visual.unit}</strong></span>
      <span>Range <strong>{visual.low}–{visual.high} {visual.unit}</strong></span>
    </div>
  </figure>;
}
