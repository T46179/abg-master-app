import { formatValue, getDisplayMetricDefinition } from "../../core/metrics";
import type { PressureUnit } from "../../core/types";
import type { CalibrationMetricDefinition } from "./calibrationConfig";

// Display conversion only: answer identities and scoring remain canonical mmHg.
export function getCalibrationDisplayMetric(metric: CalibrationMetricDefinition, pressureUnit: PressureUnit): CalibrationMetricDefinition {
  if (metric.unit !== "mmHg" || pressureUnit === "mmHg") return metric;
  const display = getDisplayMetricDefinition({
    label: metric.label, displayLabel: metric.label, reference: metric.reference,
    value: Number(metric.value), unit: "mmHg", decimals: 1,
    abnormal: Boolean(metric.abnormal), pressureUnitConvertible: true
  }, { pressureUnit });
  return { ...metric, value: formatValue(display.value, display.decimals), unit: display.unit, reference: display.reference };
}
