import type { CaseData, CaseMetricDefinition, PressureUnit } from "./types";

export type { PressureUnit } from "./types";

const MMHG_TO_KPA = 0.133322;

export const standardMetricRanges = {
  pH: [7.35, 7.45],
  PaCO2: [35, 45],
  HCO3: [22, 26],
  PaO2: [80, 100],
  Na: [135, 145],
  Cl: [98, 106],
  Glucose: [3.9, 7.8]
} as const;

function buildStandardMetric(
  label: keyof typeof standardMetricRanges,
  value: CaseMetricDefinition["value"],
  decimals: number,
  unit: string,
  options?: Pick<CaseMetricDefinition, "group" | "pressureUnitConvertible" | "minDifficultyLevel"> & { displayLabel?: string }
): CaseMetricDefinition {
  const [low, high] = standardMetricRanges[label];
  return {
    label, displayLabel: label, value, decimals, unit,
    reference: `Normal: ${low} - ${high}${unit ? ` ${unit}` : ""}`,
    abnormal: Number(value) < low || Number(value) > high,
    ...options
  };
}

export function formatValue(value: unknown, decimals = 1): string {
  if (value == null || Number.isNaN(Number(value))) return "--";
  return Number(value).toFixed(decimals);
}

export function convertMmHgToKPa(value: unknown): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value) * MMHG_TO_KPA;
}

export function formatMetricReferenceLimit(limit: number, unit: string): string {
  return unit === "kPa" ? formatValue(convertMmHgToKPa(limit), 1) : String(limit);
}

function formatPressureReference(reference: string, pressureUnit: PressureUnit): string {
  if (pressureUnit === "mmHg") return reference;

  return reference.replace(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*mmHg/g, (_match, lower, upper) => {
    const lowerKpa = convertMmHgToKPa(lower);
    const upperKpa = convertMmHgToKPa(upper);
    if (lowerKpa == null || upperKpa == null) return _match;
    return `${formatValue(lowerKpa, 1)} - ${formatValue(upperKpa, 1)} kPa`;
  });
}

export function getDisplayMetricDefinition(
  metric: CaseMetricDefinition,
  options?: { pressureUnit?: PressureUnit }
): CaseMetricDefinition {
  const pressureUnit = options?.pressureUnit ?? "mmHg";
  if (pressureUnit === "mmHg" || !metric.pressureUnitConvertible || metric.unit !== "mmHg") return metric;

  const convertedValue = convertMmHgToKPa(metric.value);
  return {
    ...metric,
    value: convertedValue,
    decimals: 1,
    unit: "kPa",
    reference: formatPressureReference(metric.reference, pressureUnit)
  };
}

export function getCaseStructuredInputs(caseItem: CaseData) {
  const inputs = caseItem?.inputs ?? {};
  return {
    gas: inputs.gas ?? {},
    electrolytes: inputs.electrolytes ?? {},
    oxygenation: inputs.oxygenation ?? {},
    other: inputs.other ?? {},
    legacyInputs: inputs
  };
}

export function getCaseLactateValue(caseItem: CaseData): number | null {
  const { other, legacyInputs } = getCaseStructuredInputs(caseItem);
  const lactate = other.lactate_mmolL ?? legacyInputs.lactate_mmolL ?? null;
  return lactate == null ? null : Number(lactate);
}

export function buildCaseMetricDefinitions(caseItem: CaseData): CaseMetricDefinition[] {
  const { gas, electrolytes, oxygenation } = getCaseStructuredInputs(caseItem);
  const lactate = getCaseLactateValue(caseItem);

  return [
    buildStandardMetric("pH", gas.ph, 2, ""),
    buildStandardMetric("PaCO2", gas.paco2_mmHg, 1, "mmHg", { pressureUnitConvertible: true }),
    buildStandardMetric("HCO3", gas.hco3_mmolL, 1, "mmol/L"),
    {
      label: "FiO2",
      displayLabel: "FiO2",
      reference: "Room air: 0.21",
      value: oxygenation.fio2_fraction,
      decimals: 1,
      unit: "",
      abnormal: false,
      group: "oxygenation"
    },
    buildStandardMetric("PaO2", gas.pao2_mmHg, 1, "mmHg", {
      pressureUnitConvertible: true,
      group: "oxygenation"
    }),
    {
      label: "SpO2",
      displayLabel: "SpO2",
      reference: "Normal: 94 - 98%",
      value: oxygenation.spo2_percent,
      decimals: 0,
      unit: "%",
      abnormal: Number(oxygenation.spo2_percent) < 94 || Number(oxygenation.spo2_percent) > 100,
      group: "oxygenation"
    },
    {
      label: "Base excess",
      displayLabel: "Base excess",
      reference: "Normal: -2 to +2 mEq/L",
      value: gas.base_excess_mEqL,
      decimals: 1,
      unit: "mEq/L",
      abnormal: Number(gas.base_excess_mEqL) < -2 || Number(gas.base_excess_mEqL) > 2
    },
    buildStandardMetric("Na", electrolytes.na_mmolL, 0, "mmol/L", { displayLabel: "Na+" }),
    {
      label: "K",
      displayLabel: "K+",
      reference: "Normal: 3.5 - 5.0 mmol/L",
      value: electrolytes.k_mmolL,
      decimals: 1,
      unit: "mmol/L",
      abnormal: Number(electrolytes.k_mmolL) < 3.5 || Number(electrolytes.k_mmolL) > 5
    },
    buildStandardMetric("Cl", electrolytes.cl_mmolL, 0, "mmol/L", { displayLabel: "Cl-" }),
    buildStandardMetric("Glucose", electrolytes.glucose_mmolL, 1, "mmol/L", { minDifficultyLevel: 3 }),
    {
      label: "Lactate",
      displayLabel: "Lactate",
      reference: "Normal: 0.5 - 2.0 mmol/L",
      value: lactate,
      decimals: 1,
      unit: "mmol/L",
      abnormal: lactate != null && (lactate < 0.5 || lactate > 2),
      minDifficultyLevel: 2
    }
  ];
}

export function shouldShowMetricReferences(caseItem: CaseData, showAdvancedRanges: boolean): boolean {
  const difficultyLevel = Number(caseItem?.difficulty_level ?? 1);
  if (difficultyLevel <= 2) return true;
  if (difficultyLevel === 3) return Boolean(showAdvancedRanges);
  return false;
}

export function isMetricVisibleForDifficulty(metric: CaseMetricDefinition, difficultyLevel: number): boolean {
  if (metric.minDifficultyLevel != null && difficultyLevel < metric.minDifficultyLevel) {
    return false;
  }

  if (metric.maxDifficultyLevel != null && difficultyLevel > metric.maxDifficultyLevel) {
    return false;
  }

  return true;
}

export function getVisibleCaseMetrics(caseItem: CaseData): CaseMetricDefinition[] {
  const difficultyLevel = Number(caseItem?.difficulty_level ?? 1);
  const hiddenInputs = new Set((caseItem?.display?.hidden_inputs ?? []).map(value => String(value)));
  const metricInputKeys: Record<string, string[]> = {
    pH: ["ph"],
    PaCO2: ["paco2_mmHg"],
    HCO3: ["hco3_mmolL"],
    FiO2: ["fio2_fraction"],
    PaO2: ["pao2_mmHg"],
    SpO2: ["spo2_percent"],
    "Base excess": ["base_excess_mEqL"],
    Na: ["na_mmolL"],
    K: ["k_mmolL"],
    Cl: ["cl_mmolL"],
    Glucose: ["glucose_mmolL"],
    Lactate: ["lactate_mmolL"]
  };

  return buildCaseMetricDefinitions(caseItem).filter(metric => {
    if (hiddenInputs.has(metric.label) || (metricInputKeys[metric.label] ?? []).some(key => hiddenInputs.has(key))) {
      return false;
    }

    if (!isMetricVisibleForDifficulty(metric, difficultyLevel)) {
      return false;
    }

    if (metric.label === "Glucose") {
      if (difficultyLevel >= 4) return true;
      if (difficultyLevel >= 3) return metric.value != null;
    }

    return true;
  });
}

export function renderMetricValue(metric: CaseMetricDefinition, options?: { pressureUnit?: PressureUnit }): string {
  const displayMetric = getDisplayMetricDefinition(metric, options);
  const formatted = formatValue(displayMetric.value, displayMetric.decimals ?? 1);
  if (formatted === "--") return "--";
  return displayMetric.unit ? `${formatted} ${displayMetric.unit}` : formatted;
}

