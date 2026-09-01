import type {
  CompensationComparisonBand,
  CompensationRelationship,
  CompensationResult,
  PressureUnit
} from "../../../core/types";
import { convertMmHgToKPa, formatValue } from "../../../core/metrics";

const INTERPRETATION_LABELS: Record<string, string> = {
  within_expected_range: "Within expected range",
  below_expected_range: "Below expected range",
  above_expected_range: "Above expected range",
  markedly_below_expected_range: "Markedly below expected range",
  markedly_above_expected_range: "Markedly above expected range",
  between_acute_and_chronic_expectations: "Between acute and chronic expectations"
};

const BAND_LABELS: Record<string, string> = {
  reference_range: "Reference",
  expected_range: "Expected",
  acute_expected: "Acute",
  chronic_expected: "Chronic"
};

const QUALIFIER_LABELS: Record<string, string> = {
  acute_on_chronic_without_known_baseline:
    "Without a documented baseline, there is no precise combined expected range.",
  venous_sample:
    "This is a venous sample, so the exact PaCO2 difference should be interpreted with clinical context.",
  profound_hypothermia:
    "Profound hypothermia can alter measured blood-gas values and the expected physiological response."
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
  lowDisplay: string;
  highDisplay: string;
  lowPos: number;
  highPos: number;
  centerPos: number;
}

export type CompensationCalculationTone = "primary_expected" | "acute_expected" | "chronic_expected";

export interface CompensationCalculationPartVisualModel {
  text: string;
  tone?: CompensationCalculationTone;
}

export interface CompensationCalculationRowVisualModel {
  id: string;
  parts: CompensationCalculationPartVisualModel[];
}

export interface CompensationVisualModel {
  kind: "visual";
  targetLabel: string;
  measuredValue: number;
  measuredDisplay: string;
  unit: string;
  canonicalUnit: string;
  markerPercent: number;
  bands: CompensationBandVisualModel[];
  interpretationLabel: string;
  interpretationKey: string;
  clinicalSentence: string;
  qualifierMessages: string[];
  calculationRuleKey: string | null;
  calculationRows: CompensationCalculationRowVisualModel[];
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

function buildClinicalSentence(result: CompensationResult) {
  const additionalProcess = result.targetAnalyte === "paco2" ? "respiratory" : "metabolic";
  const processBelowExpected = result.targetAnalyte === "paco2"
    ? "respiratory alkalosis"
    : "metabolic acidosis";
  const processAboveExpected = result.targetAnalyte === "paco2"
    ? "respiratory acidosis"
    : "metabolic alkalosis";

  switch (result.interpretationKey) {
    case "within_expected_range":
      return `No additional ${additionalProcess} acid–base process is evident.`;
    case "below_expected_range":
      return `This suggests an additional ${processBelowExpected}.`;
    case "above_expected_range":
      return `This suggests an additional ${processAboveExpected}.`;
    case "markedly_below_expected_range":
      return `This strongly suggests an additional ${processBelowExpected}.`;
    case "markedly_above_expected_range":
      return `This strongly suggests an additional ${processAboveExpected}.`;
    case "between_acute_and_chronic_expectations":
      return "This suggests an acute-on-chronic respiratory process.";
    default:
      return "Interpret the measured value against the supplied compensation ranges.";
  }
}

function buildLinearPositionMap(result: CompensationResult) {
  const anchors = Array.from(new Set([
    result.measuredValue,
    ...result.comparisonBands.flatMap(band => [band.low, band.high])
  ]));
  const minimum = Math.min(...anchors);
  const maximum = Math.max(...anchors);
  const span = maximum - minimum;

  return new Map(
    anchors.map(anchor => [
      anchor,
      span === 0 ? 50 : ((anchor - minimum) / span) * 100
    ])
  );
}

function rawCalculationRows(lines: string[]): CompensationCalculationRowVisualModel[] {
  return lines.map((line, index) => ({
    id: `raw-${index}`,
    parts: [{ text: line }]
  }));
}

function rangeDisplayText(band: CompensationBandVisualModel) {
  return `${band.lowDisplay} – ${band.highDisplay}`;
}

function addRespiratoryPressureContext(
  line: string,
  measuredPaCO2MmHg: number,
  pressureUnit: PressureUnit
) {
  const measuredDisplay = pressureUnit === "kPa"
    ? `${formatValue(convertMmHgToKPa(measuredPaCO2MmHg), 1)} kPa (${formatNumber(measuredPaCO2MmHg)} mmHg)`
    : `${formatNumber(measuredPaCO2MmHg)} mmHg`;
  return line.replace(/^([^:]+):\s*/, `$1: PaCO₂ ${measuredDisplay} → `);
}

function calculationToneFor(band: CompensationBandVisualModel): CompensationCalculationTone | undefined {
  switch (band.kindKey) {
    case "primary_expected":
    case "acute_expected":
    case "chronic_expected":
      return band.kindKey;
    default:
      return undefined;
  }
}

function buildCalculationRows(
  result: CompensationResult,
  bands: CompensationBandVisualModel[],
  targetLabel: string,
  lines: string[],
  displayInKPa: boolean,
  displayUnit: string,
  formatDisplayNumber: (value: number) => string
): CompensationCalculationRowVisualModel[] {
  if (!lines.length) return [];

  if (result.calculation?.ruleKey === "acute_on_chronic_respiratory_acidosis") {
    const acuteBand = bands.find(band => band.id === "acute_expected");
    const chronicBand = bands.find(band => band.id === "chronic_expected");
    const hasStructuredFormulaLines = lines[0]?.startsWith("Acute:") && lines[1]?.startsWith("Chronic:");
    if (!acuteBand || !chronicBand || !hasStructuredFormulaLines) return rawCalculationRows(lines);

    return [
      { id: "acute-formula", parts: [{ text: lines[0] }] },
      { id: "chronic-formula", parts: [{ text: lines[1] }] },
      {
        id: "expected",
        parts: [
          { text: `Expected ${targetLabel}: Acute ` },
          { text: rangeDisplayText(acuteBand), tone: calculationToneFor(acuteBand) },
          { text: " · Chronic " },
          { text: rangeDisplayText(chronicBand), tone: calculationToneFor(chronicBand) },
          { text: ` ${displayUnit}` }
        ]
      },
      {
        id: "measured",
        parts: [{ text: `Measured ${targetLabel}: ${formatDisplayNumber(result.measuredValue)} ${displayUnit}` }]
      }
    ];
  }

  const expectedBand = bands.find(band => band.id === result.primaryExpectedBandId)
    ?? bands.find(band => band.role === "expected");
  if (!expectedBand) return rawCalculationRows(lines);
  const expectedValue = expectedBand.midpoint ?? ((expectedBand.low + expectedBand.high) / 2);
  const formulaText = displayInKPa
    ? `${lines[0]} → ${formatNumber(expectedValue)} × 0.133 = ${formatDisplayNumber(expectedValue)} kPa`
    : lines[0];

  return [
    { id: "formula", parts: [{ text: formulaText }] },
    {
      id: "expected",
      parts: [
        { text: `Expected ${targetLabel}: ` },
        { text: rangeDisplayText(expectedBand), tone: calculationToneFor(expectedBand) },
        { text: ` ${displayUnit}` }
      ]
    },
    {
      id: "measured",
      parts: [{ text: `Measured ${targetLabel}: ${formatDisplayNumber(result.measuredValue)} ${displayUnit}` }]
    }
  ];
}

export function buildCompensationVisualModel(
  result: unknown,
  fallbackExplanation: string,
  options?: { pressureUnit?: PressureUnit; measuredPaCO2MmHg?: number }
): BuiltCompensationVisualModel {
  if (!validateCompensationResult(result)) {
    return {
      kind: "fallback",
      explanation: String((isRecord(result) && result.fallbackExplanation) || fallbackExplanation || "Compensation details are unavailable.")
    };
  }

  const positions = buildLinearPositionMap(result);
  const displayInKPa = options?.pressureUnit === "kPa"
    && result.targetAnalyte === "paco2"
    && result.unit === "mmHg";
  const displayUnit = displayInKPa ? "kPa" : result.unit;
  const formatDisplayNumber = (value: number) => {
    if (!displayInKPa) return formatNumber(value);
    return formatValue(convertMmHgToKPa(value), 1);
  };
  const bands = result.comparisonBands.map(band => {
    const lowPos = positions.get(band.low) ?? 0;
    const highPos = positions.get(band.high) ?? 100;
    return {
      ...band,
      label: BAND_LABELS[band.labelKey] ?? band.labelKey.replaceAll("_", " "),
      lowDisplay: formatDisplayNumber(band.low),
      highDisplay: formatDisplayNumber(band.high),
      lowPos,
      highPos,
      centerPos: lowPos + ((highPos - lowPos) / 2)
    };
  });
  const targetLabel = result.targetAnalyte === "paco2" ? "PaCO₂" : "HCO₃⁻";
  const interpretationLabel = INTERPRETATION_LABELS[result.interpretationKey];
  const qualifierMessages = (result.qualifierKeys ?? []).map(
    key => QUALIFIER_LABELS[key] ?? "Additional clinical context applies to this comparison."
  );
  const pressureUnit = options?.pressureUnit ?? "mmHg";
  const measuredPaCO2MmHg = Number(options?.measuredPaCO2MmHg);
  const calculationLines = (result.calculation?.displayLines ?? [])
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => result.targetAnalyte === "hco3"
      && Number.isFinite(measuredPaCO2MmHg)
      && (result.calculation?.ruleKey === "acute_on_chronic_respiratory_acidosis" ? index < 2 : index === 0)
      ? addRespiratoryPressureContext(line, measuredPaCO2MmHg, pressureUnit)
      : line);
  const calculationRows = buildCalculationRows(
    result,
    bands,
    targetLabel,
    calculationLines,
    displayInKPa,
    displayUnit,
    formatDisplayNumber
  );
  const relationshipByBand = new Map(result.comparisons.map(comparison => [comparison.bandId, comparison.relationship]));
  const bandDescriptions = bands.map(band => {
    const relationship = relationshipByBand.get(band.id);
    return [
      `${BAND_LABELS[band.labelKey] ?? band.labelKey}: ${band.lowDisplay} to ${band.highDisplay} ${displayUnit}`,
      relationship ? `measured value ${relationship}` : null
    ].filter(Boolean).join(", ");
  });

  return {
    kind: "visual",
    targetLabel,
    measuredValue: result.measuredValue,
    measuredDisplay: formatDisplayNumber(result.measuredValue),
    unit: displayUnit,
    canonicalUnit: result.unit,
    markerPercent: positions.get(result.measuredValue) ?? 50,
    bands,
    interpretationLabel,
    interpretationKey: result.interpretationKey,
    clinicalSentence: buildClinicalSentence(result),
    qualifierMessages,
    calculationRuleKey: result.calculation?.ruleKey?.trim() || null,
    calculationRows,
    accessibleDescription: [
      `Measured ${targetLabel}: ${formatDisplayNumber(result.measuredValue)} ${displayUnit}.`,
      ...bandDescriptions,
      `Interpretation: ${interpretationLabel}.`
    ].join(" ")
  };
}
