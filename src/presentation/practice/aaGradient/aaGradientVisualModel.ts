import { convertMmHgToKPa } from "../../../core/metrics";
import type {
  AAGradientInterpretationTone,
  AAGradientResult,
  PressureUnit
} from "../../../core/types";

const INTERPRETATION_TONES = new Set<AAGradientInterpretationTone>([
  "normal",
  "raised",
  "context"
]);
const RESULT_TOLERANCE = 1e-9;

export type AAGradientLabelMode = "full" | "compact" | "hidden";

export interface AAGradientPressureDisplay {
  mmHg: number;
  mainValue: string;
  calculationValue: string;
}

export interface AAGradientCalculationRow {
  key: "inspired" | "correction" | "alveolar" | "arterial" | "gradient";
  label: string;
  expression: string;
  value: string;
}

export interface AAGradientVisualData {
  kind: "visual";
  unit: PressureUnit;
  canonical: {
    fio2Fraction: number;
    measuredPaCO2MmHg: number;
    measuredPaO2MmHg: number;
    inspiredOxygenPressureMmHg: number;
    co2CorrectionMmHg: number;
    alveolarOxygenPressureMmHg: number;
    aaGradientMmHg: number;
  };
  headline: AAGradientPressureDisplay;
  bars: {
    alveolar: AAGradientPressureDisplay;
    arterial: AAGradientPressureDisplay;
    gradient: AAGradientPressureDisplay;
  };
  geometry: {
    arterialPercent: number;
    gradientPercent: number;
  };
  interpretation: {
    key: string;
    tone: AAGradientInterpretationTone;
    label: string;
    explanation: string;
    qualifiers: string[];
  };
  calculationRows: AAGradientCalculationRow[];
  accessibleDescription: string;
}

export interface AAGradientFallbackData {
  kind: "fallback";
  explanation: string;
}

export type AAGradientVisualModel = AAGradientVisualData | AAGradientFallbackData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function nearlyEqual(left: number, right: number) {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= RESULT_TOLERANCE * scale;
}

function normalizeAAGradientResult(value: unknown): AAGradientResult | null {
  if (!isRecord(value)) return null;
  if (value.formulaVersion !== "alveolar_gas_v1" || value.canonicalUnit !== "mmHg") return null;
  if (!isRecord(value.inputs) || !isRecord(value.assumptions)) return null;
  if (!isRecord(value.calculated) || !isRecord(value.interpretation)) return null;

  const fio2 = value.inputs.fio2Fraction;
  const paco2 = value.inputs.measuredPaCO2MmHg;
  const pao2 = value.inputs.measuredPaO2MmHg;
  const barometric = value.assumptions.barometricPressureMmHg;
  const waterVapour = value.assumptions.waterVapourPressureMmHg;
  const respiratoryQuotient = value.assumptions.respiratoryQuotient;
  const inspired = value.calculated.inspiredOxygenPressureMmHg;
  const correction = value.calculated.co2CorrectionMmHg;
  const alveolar = value.calculated.alveolarOxygenPressureMmHg;
  const gradient = value.calculated.aaGradientMmHg;

  if (
    !isFiniteNumber(fio2)
    || !isFiniteNumber(paco2)
    || !isFiniteNumber(pao2)
    || !isFiniteNumber(barometric)
    || !isFiniteNumber(waterVapour)
    || !isFiniteNumber(respiratoryQuotient)
    || !isFiniteNumber(inspired)
    || !isFiniteNumber(correction)
    || !isFiniteNumber(alveolar)
    || !isFiniteNumber(gradient)
  ) return null;
  if (!(fio2 > 0 && fio2 <= 1) || paco2 <= 0 || pao2 <= 0) return null;
  if (barometric !== 760 || waterVapour !== 47 || respiratoryQuotient !== 0.8) return null;
  if (alveolar <= 0 || gradient < 0 || pao2 > alveolar) return null;

  const expectedInspired = fio2 * (barometric - waterVapour);
  const expectedCorrection = paco2 / respiratoryQuotient;
  const expectedAlveolar = expectedInspired - expectedCorrection;
  const expectedGradient = expectedAlveolar - pao2;
  if (
    !nearlyEqual(inspired, expectedInspired)
    || !nearlyEqual(correction, expectedCorrection)
    || !nearlyEqual(alveolar, expectedAlveolar)
    || !nearlyEqual(gradient, expectedGradient)
  ) return null;

  const tone = value.interpretation.tone;
  if (typeof tone !== "string" || !INTERPRETATION_TONES.has(tone as AAGradientInterpretationTone)) {
    return null;
  }
  if (
    !isNonEmptyString(value.interpretation.key)
    || !isNonEmptyString(value.interpretation.label)
    || !isNonEmptyString(value.interpretation.explanation)
  ) return null;
  if (
    value.interpretation.qualifiers !== undefined
    && (
      !Array.isArray(value.interpretation.qualifiers)
      || !value.interpretation.qualifiers.every(isNonEmptyString)
    )
  ) return null;

  return value as unknown as AAGradientResult;
}

function convertedPressure(valueMmHg: number, pressureUnit: PressureUnit) {
  if (pressureUnit === "mmHg") return valueMmHg;
  return convertMmHgToKPa(valueMmHg) ?? Number.NaN;
}

function formatMainPressure(valueMmHg: number, pressureUnit: PressureUnit) {
  const converted = convertedPressure(valueMmHg, pressureUnit);
  return pressureUnit === "mmHg" ? converted.toFixed(0) : converted.toFixed(1);
}

function formatCalculationPressure(valueMmHg: number, pressureUnit: PressureUnit) {
  const converted = convertedPressure(valueMmHg, pressureUnit);
  if (pressureUnit === "kPa") return converted.toFixed(1);
  const rounded = Math.round((converted + Number.EPSILON) * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

function pressureDisplay(valueMmHg: number, pressureUnit: PressureUnit): AAGradientPressureDisplay {
  return {
    mmHg: valueMmHg,
    mainValue: formatMainPressure(valueMmHg, pressureUnit),
    calculationValue: formatCalculationPressure(valueMmHg, pressureUnit)
  };
}

function formatFio2(value: number) {
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function calculationPressure(valueMmHg: number, pressureUnit: PressureUnit) {
  return `${formatCalculationPressure(valueMmHg, pressureUnit)} ${pressureUnit}`;
}

function buildCalculationRows(
  result: AAGradientResult,
  pressureUnit: PressureUnit
): AAGradientCalculationRow[] {
  const { inputs, assumptions, calculated } = result;
  const inspired = calculationPressure(calculated.inspiredOxygenPressureMmHg, pressureUnit);
  const correction = calculationPressure(calculated.co2CorrectionMmHg, pressureUnit);
  const alveolar = calculationPressure(calculated.alveolarOxygenPressureMmHg, pressureUnit);
  const arterial = calculationPressure(inputs.measuredPaO2MmHg, pressureUnit);
  const gradient = calculationPressure(calculated.aaGradientMmHg, pressureUnit);
  const barometric = formatCalculationPressure(assumptions.barometricPressureMmHg, pressureUnit);
  const waterVapour = formatCalculationPressure(assumptions.waterVapourPressureMmHg, pressureUnit);
  const paco2 = formatCalculationPressure(inputs.measuredPaCO2MmHg, pressureUnit);
  const inspiredValue = formatCalculationPressure(calculated.inspiredOxygenPressureMmHg, pressureUnit);
  const correctionValue = formatCalculationPressure(calculated.co2CorrectionMmHg, pressureUnit);
  const alveolarValue = formatCalculationPressure(calculated.alveolarOxygenPressureMmHg, pressureUnit);
  const pao2 = formatCalculationPressure(inputs.measuredPaO2MmHg, pressureUnit);

  return [
    {
      key: "inspired",
      label: "Inspired oxygen pressure",
      expression: `${formatFio2(inputs.fio2Fraction)} × (${barometric} − ${waterVapour})`,
      value: inspired
    },
    {
      key: "correction",
      label: "CO₂ correction",
      expression: `${paco2} ÷ ${assumptions.respiratoryQuotient}`,
      value: correction
    },
    {
      key: "alveolar",
      label: "Estimated PAO₂",
      expression: `${inspiredValue} − ${correctionValue}`,
      value: alveolar
    },
    {
      key: "arterial",
      label: "Measured PaO₂",
      expression: "Arterial blood gas value",
      value: arterial
    },
    {
      key: "gradient",
      label: "A–a gradient",
      expression: `${alveolarValue} − ${pao2}`,
      value: gradient
    }
  ];
}

export function getAAGradientLabelMode(
  availableWidth: number,
  fullLabelWidth: number,
  compactLabelWidth: number,
  padding = 16
): AAGradientLabelMode {
  if (![availableWidth, fullLabelWidth, compactLabelWidth, padding].every(Number.isFinite)) {
    return "full";
  }
  if (availableWidth <= 0 || fullLabelWidth <= 0 || compactLabelWidth <= 0) return "full";
  if (fullLabelWidth + padding <= availableWidth) return "full";
  if (compactLabelWidth + padding <= availableWidth) return "compact";
  return "hidden";
}

export function buildAAGradientVisualModel(
  value: unknown,
  pressureUnit: PressureUnit,
  fallbackExplanation: string
): AAGradientVisualModel {
  const result = normalizeAAGradientResult(value);
  if (!result) {
    return {
      kind: "fallback",
      explanation: fallbackExplanation.trim()
        || "A–a gradient details are unavailable for this case."
    };
  }

  const { inputs, calculated, interpretation } = result;
  const arterialPercent = (inputs.measuredPaO2MmHg / calculated.alveolarOxygenPressureMmHg) * 100;
  const gradientPercent = 100 - arterialPercent;
  const headline = pressureDisplay(calculated.aaGradientMmHg, pressureUnit);
  const alveolar = pressureDisplay(calculated.alveolarOxygenPressureMmHg, pressureUnit);
  const arterial = pressureDisplay(inputs.measuredPaO2MmHg, pressureUnit);
  const gradient = pressureDisplay(calculated.aaGradientMmHg, pressureUnit);

  return {
    kind: "visual",
    unit: pressureUnit,
    canonical: {
      fio2Fraction: inputs.fio2Fraction,
      measuredPaCO2MmHg: inputs.measuredPaCO2MmHg,
      measuredPaO2MmHg: inputs.measuredPaO2MmHg,
      inspiredOxygenPressureMmHg: calculated.inspiredOxygenPressureMmHg,
      co2CorrectionMmHg: calculated.co2CorrectionMmHg,
      alveolarOxygenPressureMmHg: calculated.alveolarOxygenPressureMmHg,
      aaGradientMmHg: calculated.aaGradientMmHg
    },
    headline,
    bars: { alveolar, arterial, gradient },
    geometry: { arterialPercent, gradientPercent },
    interpretation: {
      key: interpretation.key,
      tone: interpretation.tone,
      label: interpretation.label,
      explanation: interpretation.explanation,
      qualifiers: [...(interpretation.qualifiers ?? [])]
    },
    calculationRows: buildCalculationRows(result, pressureUnit),
    accessibleDescription:
      `A–a gradient ${headline.mainValue} ${pressureUnit}. `
      + `Estimated alveolar oxygen pressure ${alveolar.mainValue} ${pressureUnit}; `
      + `measured arterial oxygen pressure ${arterial.mainValue} ${pressureUnit}. `
      + `${interpretation.label}. ${interpretation.explanation}`
  };
}
