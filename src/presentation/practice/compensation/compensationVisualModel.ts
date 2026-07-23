import type {
  CompensationComparisonBand,
  CompensationRelationship,
  CompensationResult
} from "../../../core/types";

const INTERPRETATION_LABELS: Record<string, string> = {
  within_expected_range: "Within expected range",
  below_expected_range: "Below expected range",
  above_expected_range: "Above expected range",
  markedly_below_expected_range: "Markedly below expected range",
  markedly_above_expected_range: "Markedly above expected range",
  between_acute_and_chronic_expectations: "Between acute and chronic expectations"
};

const BAND_LABELS: Record<string, string> = {
  reference_range: "Reference interval",
  expected_range: "Expected interval",
  acute_expected: "Acute expected",
  chronic_expected: "Chronic expected"
};

const QUALIFIER_LABELS: Record<string, string> = {
  acute_on_chronic_without_known_baseline:
    "No documented baseline: this supports an acute-on-chronic pattern but does not define a precise combined target.",
  venous_sample:
    "This is a venous sample, so the exact PaCO2 difference should be interpreted with clinical context.",
  profound_hypothermia:
    "Profound hypothermia can alter measured blood-gas values and the expected physiological response."
};

const RULE_LABELS: Record<string, string> = {
  winter: "Winter's formula",
  metabolic_alkalosis: "Metabolic alkalosis rule",
  metabolic_alkalosis_compensation: "Metabolic alkalosis rule",
  acute_respiratory_acidosis: "Acute respiratory acidosis rule",
  chronic_respiratory_acidosis: "Chronic respiratory acidosis rule",
  acute_respiratory_alkalosis: "Acute respiratory alkalosis rule",
  chronic_respiratory_alkalosis: "Chronic respiratory alkalosis rule",
  acute_on_chronic_respiratory_acidosis: "Acute and chronic respiratory acidosis comparison"
};

const VALID_ROLES = new Set(["reference", "expected", "comparator"]);
const VALID_RELATIONSHIPS = new Set<CompensationRelationship>(["below", "within", "above"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateCompensationResult(value: unknown): value is CompensationResult {
  if (!isRecord(value)) return false;
  if (value.targetAnalyte !== "paco2" && value.targetAnalyte !== "hco3") return false;
  if (value.unit !== "mmHg" && value.unit !== "mmol/L") return false;
  if (value.targetAnalyte === "paco2" && value.unit !== "mmHg") return false;
  if (value.targetAnalyte === "hco3" && value.unit !== "mmol/L") return false;
  if (!isFiniteNumber(value.measuredValue)) return false;
  if (!Array.isArray(value.comparisonBands) || value.comparisonBands.length === 0) return false;

  const bandIds = new Set<string>();
  for (const candidate of value.comparisonBands) {
    if (!isRecord(candidate)) return false;
    const id = String(candidate.id ?? "").trim();
    if (!id || bandIds.has(id)) return false;
    bandIds.add(id);
    if (!VALID_ROLES.has(String(candidate.role ?? ""))) return false;
    if (!String(candidate.labelKey ?? "").trim()) return false;
    if (!isFiniteNumber(candidate.low) || !isFiniteNumber(candidate.high) || candidate.low > candidate.high) return false;
    if (candidate.midpoint !== undefined && !isFiniteNumber(candidate.midpoint)) return false;
  }

  if (value.primaryExpectedBandId !== undefined && !bandIds.has(String(value.primaryExpectedBandId))) return false;
  if (!Array.isArray(value.comparisons)) return false;
  const comparedIds = new Set<string>();
  for (const candidate of value.comparisons) {
    if (!isRecord(candidate)) return false;
    const bandId = String(candidate.bandId ?? "").trim();
    if (!bandIds.has(bandId) || comparedIds.has(bandId)) return false;
    comparedIds.add(bandId);
    if (!VALID_RELATIONSHIPS.has(candidate.relationship as CompensationRelationship)) return false;
  }
  if (!String(value.interpretationKey ?? "").trim() || !INTERPRETATION_LABELS[String(value.interpretationKey)]) return false;
  if (value.qualifierKeys !== undefined && (!Array.isArray(value.qualifierKeys) || value.qualifierKeys.some(key => typeof key !== "string"))) {
    return false;
  }
  if (value.calculation !== undefined) {
    if (!isRecord(value.calculation)) return false;
    if (
      value.calculation.displayLines !== undefined
      && (!Array.isArray(value.calculation.displayLines)
        || value.calculation.displayLines.some(line => typeof line !== "string" || !line.trim()))
    ) return false;
  }
  return true;
}

export interface CompensationBandVisualModel extends CompensationComparisonBand {
  label: string;
  lowPos: number;
  highPos: number;
  midPos?: number;
}

export interface CompensationVisualModel {
  kind: "visual";
  targetLabel: string;
  measuredValue: number;
  measuredDisplay: string;
  unit: string;
  markerPercent: number;
  bands: CompensationBandVisualModel[];
  interpretationLabel: string;
  interpretationKey: string;
  clinicalSentence: string;
  qualifierMessages: string[];
  calculationLabel: string | null;
  calculationLines: string[];
  accessibleDescription: string;
}

export interface CompensationFallbackModel {
  kind: "fallback";
  explanation: string;
}

export type BuiltCompensationVisualModel = CompensationVisualModel | CompensationFallbackModel;

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildClinicalSentence(result: CompensationResult, targetLabel: string) {
  const measured = `${targetLabel} ${formatNumber(result.measuredValue)} ${result.unit}`;
  switch (result.interpretationKey) {
    case "within_expected_range":
      return `${measured} sits within the expected compensation range.`;
    case "below_expected_range":
      return `${measured} sits below the expected compensation range.`;
    case "above_expected_range":
      return `${measured} sits above the expected compensation range.`;
    case "markedly_below_expected_range":
      return `${measured} sits markedly below the expected compensation range.`;
    case "markedly_above_expected_range":
      return `${measured} sits markedly above the expected compensation range.`;
    case "between_acute_and_chronic_expectations":
      return `${measured} sits above the acute expectation and below the chronic expectation.`;
    default:
      return `${measured} is shown against the supplied compensation ranges.`;
  }
}

function buildOrdinalPositionMap(result: CompensationResult) {
  const anchors = Array.from(new Set([
    result.measuredValue,
    ...result.comparisonBands.flatMap(band => [band.low, band.high])
  ])).sort((left, right) => left - right);
  return new Map(
    anchors.map((anchor, index) => [
      anchor,
      anchors.length === 1 ? 50 : (index / (anchors.length - 1)) * 100
    ])
  );
}

export function buildCompensationVisualModel(
  result: unknown,
  fallbackExplanation: string
): BuiltCompensationVisualModel {
  if (!validateCompensationResult(result)) {
    return {
      kind: "fallback",
      explanation: String((isRecord(result) && result.fallbackExplanation) || fallbackExplanation || "Compensation details are unavailable.")
    };
  }

  const positions = buildOrdinalPositionMap(result);
  const bands = result.comparisonBands.map(band => {
    const lowPos = positions.get(band.low) ?? 0;
    const highPos = positions.get(band.high) ?? 100;
    const midPos = band.midpoint === undefined
      ? undefined
      : band.high === band.low
        ? 50
        : Math.min(100, Math.max(0, ((band.midpoint - band.low) / (band.high - band.low)) * 100));
    return {
      ...band,
      label: BAND_LABELS[band.labelKey] ?? band.labelKey.replaceAll("_", " "),
      lowPos,
      highPos,
      midPos
    };
  });
  const targetLabel = result.targetAnalyte === "paco2" ? "PaCO₂" : "HCO₃⁻";
  const interpretationLabel = INTERPRETATION_LABELS[result.interpretationKey];
  const qualifierMessages = (result.qualifierKeys ?? []).map(
    key => QUALIFIER_LABELS[key] ?? "Additional clinical context applies to this comparison."
  );
  const calculationLines = result.calculation?.displayLines?.map(line => line.trim()).filter(Boolean) ?? [];
  const relationshipByBand = new Map(result.comparisons.map(comparison => [comparison.bandId, comparison.relationship]));
  const bandDescriptions = result.comparisonBands.map(band => {
    const relationship = relationshipByBand.get(band.id);
    return [
      `${BAND_LABELS[band.labelKey] ?? band.labelKey}: ${formatNumber(band.low)} to ${formatNumber(band.high)} ${result.unit}`,
      relationship ? `measured value ${relationship}` : null
    ].filter(Boolean).join(", ");
  });

  return {
    kind: "visual",
    targetLabel,
    measuredValue: result.measuredValue,
    measuredDisplay: formatNumber(result.measuredValue),
    unit: result.unit,
    markerPercent: positions.get(result.measuredValue) ?? 50,
    bands,
    interpretationLabel,
    interpretationKey: result.interpretationKey,
    clinicalSentence: buildClinicalSentence(result, targetLabel),
    qualifierMessages,
    calculationLabel: result.calculation?.ruleKey
      ? (RULE_LABELS[result.calculation.ruleKey] ?? result.calculation.ruleKey.replaceAll("_", " "))
      : null,
    calculationLines,
    accessibleDescription: [
      `Measured ${targetLabel}: ${formatNumber(result.measuredValue)} ${result.unit}.`,
      ...bandDescriptions,
      `Interpretation: ${interpretationLabel}.`
    ].join(" ")
  };
}
