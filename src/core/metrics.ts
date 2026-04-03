import type { CaseData, CaseMetricDefinition } from "./types";

export function formatValue(value: unknown, decimals = 1): string {
  if (value == null || Number.isNaN(Number(value))) return "--";
  return Number(value).toFixed(decimals);
}

export function getCaseStructuredInputs(caseItem: CaseData) {
  const inputs = caseItem?.inputs ?? {};
  return {
    gas: inputs.gas ?? {},
    electrolytes: inputs.electrolytes ?? {},
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
  const { gas, electrolytes } = getCaseStructuredInputs(caseItem);
  const lactate = getCaseLactateValue(caseItem);

  return [
    {
      label: "pH",
      displayLabel: "pH",
      reference: "Normal: 7.35 - 7.45",
      value: gas.ph,
      decimals: 2,
      unit: "",
      abnormal: Number(gas.ph) < 7.35 || Number(gas.ph) > 7.45
    },
    {
      label: "PaCO2",
      displayLabel: "PaCO2",
      reference: "Normal: 35 - 45 mmHg",
      value: gas.paco2_mmHg,
      decimals: 1,
      unit: "mmHg",
      abnormal: Number(gas.paco2_mmHg) < 35 || Number(gas.paco2_mmHg) > 45
    },
    {
      label: "HCO3",
      displayLabel: "HCO3",
      reference: "Normal: 22 - 26 mmol/L",
      value: gas.hco3_mmolL,
      decimals: 1,
      unit: "mmol/L",
      abnormal: Number(gas.hco3_mmolL) < 22 || Number(gas.hco3_mmolL) > 26
    },
    {
      label: "PaO2",
      displayLabel: "PaO2",
      reference: "Normal: 80 - 100 mmHg",
      value: gas.pao2_mmHg,
      decimals: 1,
      unit: "mmHg",
      abnormal: Number(gas.pao2_mmHg) < 80 || Number(gas.pao2_mmHg) > 100
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
    {
      label: "Na",
      displayLabel: "Na+",
      reference: "Normal: 135 - 145 mmol/L",
      value: electrolytes.na_mmolL,
      decimals: 0,
      unit: "mmol/L",
      abnormal: Number(electrolytes.na_mmolL) < 135 || Number(electrolytes.na_mmolL) > 145
    },
    {
      label: "K",
      displayLabel: "K+",
      reference: "Normal: 3.5 - 5.0 mmol/L",
      value: electrolytes.k_mmolL,
      decimals: 1,
      unit: "mmol/L",
      abnormal: Number(electrolytes.k_mmolL) < 3.5 || Number(electrolytes.k_mmolL) > 5
    },
    {
      label: "Cl",
      displayLabel: "Cl-",
      reference: "Normal: 98 - 106 mmol/L",
      value: electrolytes.cl_mmolL,
      decimals: 0,
      unit: "mmol/L",
      abnormal: Number(electrolytes.cl_mmolL) < 98 || Number(electrolytes.cl_mmolL) > 106
    },
    {
      label: "Glucose",
      displayLabel: "Glucose",
      reference: "Normal: 3.9 - 7.8 mmol/L",
      value: electrolytes.glucose_mmolL,
      decimals: 1,
      unit: "mmol/L",
      abnormal: Number(electrolytes.glucose_mmolL) < 3.9 || Number(electrolytes.glucose_mmolL) > 7.8,
      minDifficultyLevel: 3
    },
    {
      label: "Lactate",
      displayLabel: "Lactate",
      reference: "Normal: 0.5 - 2.0 mmol/L",
      value: lactate,
      decimals: 1,
      unit: "mmol/L",
      abnormal: lactate != null && (lactate < 0.5 || lactate > 2)
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

  return buildCaseMetricDefinitions(caseItem).filter(metric => {
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

export function renderMetricValue(metric: CaseMetricDefinition): string {
  const formatted = formatValue(metric.value, metric.decimals ?? 1);
  if (formatted === "--") return "--";
  return metric.unit ? `${formatted} ${metric.unit}` : formatted;
}

