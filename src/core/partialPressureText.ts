import type { ExplanationDomain, PressureUnit } from "./types";
import { convertMmHgToKPa, formatValue } from "./metrics";

export type PartialPressureTextSource = "explanation" | "feedback";

export interface PartialPressureTextContext {
  source: PartialPressureTextSource;
  domain: ExplanationDomain;
}

interface Replacement {
  start: number;
  end: number;
  text: string;
}

const NUMBER_SOURCE = "-?\\d+(?:\\.\\d+)?";
const ANALYTE_SOURCE = "(?:PaCO2|PaCO₂|pCO2|pCO₂|PaO2|PaO₂)";

const DIRECT_PRESSURE_PATTERN = new RegExp(
  `\\b(?<analyte>${ANALYTE_SOURCE})(?<connector>\\s+(?:is|of)\\s+(?:(?:about|approximately)\\s+)?)(?<low>${NUMBER_SOURCE})(?:(?<rangeSeparator>\\s*(?:-|–|—)\\s*)(?<high>${NUMBER_SOURCE}))?\\s*mmHg(?<inheritedRange>\\s*\\(acceptable range\\s+(?<inheritedLow>${NUMBER_SOURCE})\\s*(?<inheritedSeparator>-|–|—)\\s*(?<inheritedHigh>${NUMBER_SOURCE})\\))?`,
  "gu"
);

const RULE_INCREMENT_PATTERN = new RegExp(
  `(?<value>${NUMBER_SOURCE})\\s*mmHg(?<suffix>\\s+(?:increase|decrease)\\s+in\\s+${ANALYTE_SOURCE})`,
  "gu"
);

function formatKPa(value: string): string | null {
  const converted = convertMmHgToKPa(value);
  return converted == null ? null : formatValue(converted, 1);
}

function buildDirectReplacement(match: RegExpExecArray): Replacement | null {
  const groups = match.groups;
  const analyte = groups?.analyte;
  const connector = groups?.connector;
  const low = groups?.low;
  if (!analyte || !connector || !low) return null;

  const lowKPa = formatKPa(low);
  if (!lowKPa) return null;

  let renderedValue = lowKPa;
  if (groups?.high) {
    const highKPa = formatKPa(groups.high);
    if (!highKPa) return null;
    renderedValue = `${lowKPa}–${highKPa}`;
  }

  let inheritedRange = "";
  if (groups?.inheritedRange) {
    if (!groups.inheritedLow || !groups.inheritedHigh || groups.high) return null;
    const inheritedLowKPa = formatKPa(groups.inheritedLow);
    const inheritedHighKPa = formatKPa(groups.inheritedHigh);
    if (!inheritedLowKPa || !inheritedHighKPa) return null;
    inheritedRange = ` (acceptable range ${inheritedLowKPa}–${inheritedHighKPa} kPa)`;
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
    text: `${analyte}${connector}${renderedValue} kPa${inheritedRange}`
  };
}

function buildRuleIncrementReplacement(match: RegExpExecArray): Replacement | null {
  const value = match.groups?.value;
  const suffix = match.groups?.suffix;
  if (!value || !suffix) return null;

  const valueKPa = formatKPa(value);
  if (!valueKPa) return null;

  return {
    start: match.index,
    end: match.index + match[0].length,
    text: `${valueKPa} kPa${suffix}`
  };
}

function collectReplacements(text: string): Replacement[] | null {
  const replacements: Replacement[] = [];

  DIRECT_PRESSURE_PATTERN.lastIndex = 0;
  for (let match = DIRECT_PRESSURE_PATTERN.exec(text); match; match = DIRECT_PRESSURE_PATTERN.exec(text)) {
    const replacement = buildDirectReplacement(match);
    if (!replacement) return null;
    replacements.push(replacement);
  }

  RULE_INCREMENT_PATTERN.lastIndex = 0;
  for (let match = RULE_INCREMENT_PATTERN.exec(text); match; match = RULE_INCREMENT_PATTERN.exec(text)) {
    const replacement = buildRuleIncrementReplacement(match);
    if (!replacement) return null;
    replacements.push(replacement);
  }

  replacements.sort((left, right) => left.start - right.start);
  for (let index = 1; index < replacements.length; index += 1) {
    if (replacements[index].start < replacements[index - 1].end) return null;
  }

  const unitIndexes = Array.from(text.matchAll(/mmHg/g), match => match.index);
  const everyUnitIsCovered = unitIndexes.every(unitIndex =>
    replacements.some(replacement => unitIndex >= replacement.start && unitIndex < replacement.end)
  );

  return replacements.length > 0 && everyUnitIsCovered ? replacements : null;
}

export function formatPartialPressureText(text: string, pressureUnit: PressureUnit): string {
  if (pressureUnit === "mmHg" || !text.includes("mmHg")) return text;

  const replacements = collectReplacements(text);
  if (!replacements) return text;

  let rendered = "";
  let cursor = 0;
  for (const replacement of replacements) {
    rendered += text.slice(cursor, replacement.start);
    rendered += replacement.text;
    cursor = replacement.end;
  }
  rendered += text.slice(cursor);
  return rendered;
}

export function shouldFormatPartialPressureText(context: PartialPressureTextContext): boolean {
  return context.domain !== "aa_gradient_mechanism";
}

export function renderPartialPressureText(
  text: string,
  pressureUnit: PressureUnit,
  context: PartialPressureTextContext
): string {
  if (!shouldFormatPartialPressureText(context)) return text;
  return formatPartialPressureText(text, pressureUnit);
}
