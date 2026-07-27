import type {
  AnionGapClassification,
  AnionGapResult,
  CaseInputs
} from "../../../core/types";

const CLASSIFICATIONS = new Set<AnionGapClassification>(["low", "normal", "raised"]);
const IONIC_CONSISTENCY_TOLERANCE = 0.051;

const CLASSIFICATION_TEXT: Record<AnionGapClassification, string> = {
  low: "Low anion gap",
  normal: "Normal anion gap",
  raised: "Raised anion gap"
};

export interface AnionGapGaugeMarker {
  value: number;
  position: number;
  classification: AnionGapClassification;
  label: string;
}

export interface AnionGapCorrectionModel {
  albuminText: string;
  uncorrected: {
    value: number;
    classification: AnionGapClassification;
  };
  corrected: {
    value: number;
    classification: AnionGapClassification;
  };
  changed: boolean;
  direction: "higher" | "lower" | "unchanged";
}

export interface AnionGapIonicSegment {
  key: "na" | "cl" | "hco3" | "gap";
  label: string;
  value: number;
  widthPercent: number;
}

export interface AnionGapIonicModel {
  cations: AnionGapIonicSegment[];
  anions: AnionGapIonicSegment[];
  gap: number;
  unit: string;
}

export interface AnionGapCalculationModel {
  equationLines: string[];
  ionic?: AnionGapIonicModel;
}

export interface AnionGapVisualData {
  kind: "visual";
  calculatedValue: number;
  calculatedDisplay: string;
  unit: string;
  status: {
    text: string;
    tone: AnionGapClassification;
  };
  reference: {
    lower: number;
    upper: number;
  };
  primaryMarker: AnionGapGaugeMarker;
  correctedMarker?: AnionGapGaugeMarker;
  correction?: AnionGapCorrectionModel;
  sentence: string;
  calculation?: AnionGapCalculationModel;
  accessibleDescription: string;
}

export interface AnionGapFallbackData {
  kind: "fallback";
  explanation: string;
}

export type AnionGapVisualModel = AnionGapVisualData | AnionGapFallbackData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isClassification(value: unknown): value is AnionGapClassification {
  return typeof value === "string"
    && CLASSIFICATIONS.has(value as AnionGapClassification);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clamp(value: number, lower: number, upper: number) {
  return Math.min(upper, Math.max(lower, value));
}

function makeGaugeScale(lower: number, upper: number) {
  const normalWidth = upper - lower;

  return (value: number) => {
    if (value <= lower) {
      const relativePosition = (value - (lower - normalWidth)) / normalWidth;
      return clamp(relativePosition, 0, 1) * 30;
    }
    if (value >= upper) {
      const relativePosition = (value - upper) / normalWidth;
      return 70 + clamp(relativePosition, 0, 1) * 30;
    }
    return 30 + ((value - lower) / normalWidth) * 40;
  };
}

function normalizeAnionGapResult(value: unknown): AnionGapResult | null {
  if (!isRecord(value)) return null;
  if (value.unit !== "mmol/L") return null;
  if (!isFiniteNumber(value.measuredValue)) return null;
  if (!isFiniteNumber(value.referenceLowerLimit) || !isFiniteNumber(value.referenceUpperLimit)) {
    return null;
  }
  if (value.referenceLowerLimit >= value.referenceUpperLimit) return null;
  if (!isClassification(value.classification)) return null;
  if (value.includesPotassium !== false) return null;

  return value as unknown as AnionGapResult;
}

function buildCorrection(result: AnionGapResult): AnionGapCorrectionModel | undefined {
  const candidate = result.albuminCorrection;
  if (!candidate) return undefined;
  if (!isFiniteNumber(candidate.measuredAlbumin)) return undefined;
  if (candidate.albuminUnit !== "g/L") return undefined;
  if (!isFiniteNumber(candidate.correctedValue)) return undefined;
  if (!isClassification(candidate.classification)) return undefined;

  const difference = candidate.correctedValue - result.measuredValue;
  const direction = difference > 0
    ? "higher"
    : difference < 0
      ? "lower"
      : "unchanged";

  return {
    albuminText: `Albumin ${formatNumber(candidate.measuredAlbumin)} ${candidate.albuminUnit}`,
    uncorrected: {
      value: result.measuredValue,
      classification: result.classification
    },
    corrected: {
      value: candidate.correctedValue,
      classification: candidate.classification
    },
    changed: candidate.classification !== result.classification,
    direction
  };
}

function buildSentence(
  classification: AnionGapClassification,
  correction: AnionGapCorrectionModel | undefined
) {
  const baseSentences: Record<AnionGapClassification, string> = {
    low: "The calculated anion gap is below the reference range.",
    normal: "The calculated anion gap is within the reference range.",
    raised: "The calculated anion gap is above the reference range."
  };

  if (!correction) return baseSentences[classification];
  if (correction.changed) {
    return `${baseSentences[classification]} After albumin correction the classification changes from ${CLASSIFICATION_TEXT[
      correction.uncorrected.classification
    ].toLowerCase()} to ${CLASSIFICATION_TEXT[
      correction.corrected.classification
    ].toLowerCase()}.`;
  }
  return `${baseSentences[classification]} Albumin correction adjusts the value but the classification is unchanged.`;
}

function buildCalculation(
  result: AnionGapResult,
  caseInputs: CaseInputs | undefined,
  correction: AnionGapCorrectionModel | undefined
): AnionGapCalculationModel | undefined {
  const sodium = caseInputs?.electrolytes?.na_mmolL;
  const chloride = caseInputs?.electrolytes?.cl_mmolL;
  const bicarbonate = caseInputs?.gas?.hco3_mmolL;

  if (!isFiniteNumber(sodium) || !isFiniteNumber(chloride) || !isFiniteNumber(bicarbonate)) {
    return undefined;
  }
  if (sodium <= 0 || chloride < 0 || bicarbonate < 0) return undefined;

  const measuredAnions = chloride + bicarbonate;
  const calculatedFromInputs = sodium - measuredAnions;
  if (
    Math.abs(calculatedFromInputs - result.measuredValue)
    > IONIC_CONSISTENCY_TOLERANCE + Number.EPSILON
  ) {
    return undefined;
  }

  const equationLines = [
    "Anion gap = Na⁺ − (Cl⁻ + HCO₃⁻)",
    `= ${formatNumber(sodium)} − (${formatNumber(chloride)} + ${formatNumber(bicarbonate)})`,
    `= ${formatNumber(sodium)} − ${formatNumber(measuredAnions)} = ${formatNumber(result.measuredValue)} ${result.unit}`,
    ...(correction
      ? [
          `Albumin-corrected AG = AG + 0.25 × (40 − albumin) = ${formatNumber(
            correction.corrected.value
          )} ${result.unit}`
        ]
      : [])
  ];

  if (result.measuredValue < 0) {
    return { equationLines };
  }

  const widthPercent = (value: number) => (value / sodium) * 100;
  const ionic: AnionGapIonicModel = {
    cations: [
      {
        key: "na",
        label: "Na⁺",
        value: sodium,
        widthPercent: 100
      }
    ],
    anions: [
      {
        key: "cl",
        label: "Cl⁻",
        value: chloride,
        widthPercent: widthPercent(chloride)
      },
      {
        key: "hco3",
        label: "HCO₃⁻",
        value: bicarbonate,
        widthPercent: widthPercent(bicarbonate)
      },
      {
        key: "gap",
        label: "Anion gap",
        value: result.measuredValue,
        widthPercent: widthPercent(result.measuredValue)
      }
    ],
    gap: result.measuredValue,
    unit: result.unit
  };

  return { equationLines, ionic };
}

export function buildAnionGapVisualModel(
  value: unknown,
  caseInputs: CaseInputs | undefined,
  fallbackExplanation: string
): AnionGapVisualModel {
  const result = normalizeAnionGapResult(value);
  if (!result) {
    return {
      kind: "fallback",
      explanation: fallbackExplanation.trim()
        || "Anion gap details are unavailable for this case."
    };
  }

  const scale = makeGaugeScale(
    result.referenceLowerLimit,
    result.referenceUpperLimit
  );
  const correction = buildCorrection(result);
  const primaryMarker: AnionGapGaugeMarker = {
    value: result.measuredValue,
    position: scale(result.measuredValue),
    classification: result.classification,
    label: correction ? "Uncorrected AG" : "Calculated AG"
  };
  const correctedMarker = correction
    ? {
        value: correction.corrected.value,
        position: scale(correction.corrected.value),
        classification: correction.corrected.classification,
        label: "Albumin-corrected AG"
      }
    : undefined;
  const calculatedDisplay = formatNumber(result.measuredValue);
  const correctionDescription = correction
    ? ` Albumin-corrected anion gap ${formatNumber(correction.corrected.value)} ${result.unit}, classified ${correction.corrected.classification}.`
    : "";

  return {
    kind: "visual",
    calculatedValue: result.measuredValue,
    calculatedDisplay,
    unit: result.unit,
    status: {
      text: CLASSIFICATION_TEXT[result.classification],
      tone: result.classification
    },
    reference: {
      lower: result.referenceLowerLimit,
      upper: result.referenceUpperLimit
    },
    primaryMarker,
    correctedMarker,
    correction,
    sentence: buildSentence(result.classification, correction),
    calculation: buildCalculation(result, caseInputs, correction),
    accessibleDescription:
      `Calculated anion gap ${calculatedDisplay} ${result.unit}, classified ${result.classification}. `
      + `Reference range ${formatNumber(result.referenceLowerLimit)} to ${formatNumber(result.referenceUpperLimit)} ${result.unit}.`
      + correctionDescription
  };
}
