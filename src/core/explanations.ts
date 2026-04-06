import type {
  CaseData,
  ExplanationBlueprintEntry,
  ExplanationDomain,
  ExplanationSection,
  ExplanationVariant,
  StepFeedbackEntry,
  StepResult,
  StructuredExplanation
} from "./types";

export const EXPLANATION_VARIANT_BY_LEVEL: Record<number, ExplanationVariant> = {
  1: "beginner",
  2: "intermediate",
  3: "advanced",
  4: "master"
};

const BEGINNER_INTERMEDIATE_OVERVIEW_PRIORITY: ExplanationDomain[] = [
  "diagnosis",
  "primary_disorder",
  "ph_status",
  "compensation",
  "clinical_context"
];

const ADVANCED_MASTER_OVERVIEW_PRIORITY: ExplanationDomain[] = [
  "additional_metabolic_process",
  "anion_gap",
  "compensation",
  "diagnosis",
  "clinical_context",
  "primary_disorder",
  "ph_status"
];

function getExplanationVariant(caseItem: CaseData): ExplanationVariant {
  return EXPLANATION_VARIANT_BY_LEVEL[Number(caseItem.difficulty_level ?? 1)] ?? "advanced";
}

function firstSentence(text: string): string {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return "";

  for (const separator of [". ", ".\n", "; "]) {
    const index = trimmed.indexOf(separator);
    if (index >= 0) {
      return `${trimmed.slice(0, index).trim()}.`;
    }
  }

  return trimmed;
}

function getEntryLookup(caseItem: CaseData, variant: ExplanationVariant): Map<ExplanationDomain, ExplanationBlueprintEntry> {
  const lookup = new Map<ExplanationDomain, ExplanationBlueprintEntry>();

  for (const entry of caseItem.explanation_blueprint ?? []) {
    if (entry.variant === variant) {
      lookup.set(entry.domain, entry);
    }
  }

  return lookup;
}

function getSelectedDomains(caseItem: CaseData, missedStepKeys: Set<string>): ExplanationDomain[] {
  const variant = getExplanationVariant(caseItem);
  const additionalProcess = caseItem.answer_key?.additional_metabolic_process;

  if (variant === "beginner") {
    return ["ph_status", "primary_disorder", "diagnosis", "clinical_context"];
  }

  if (variant === "intermediate") {
    return ["ph_status", "primary_disorder", "compensation", "diagnosis", "clinical_context"];
  }

  if (variant === "advanced") {
    const domains: ExplanationDomain[] = ["compensation", "anion_gap", "diagnosis", "clinical_context"];
    if (missedStepKeys.has("primary_disorder")) domains.push("primary_disorder");
    if (missedStepKeys.has("ph_status")) domains.push("ph_status");
    return domains;
  }

  const domains: ExplanationDomain[] = ["compensation", "anion_gap", "diagnosis", "clinical_context"];
  if (additionalProcess && additionalProcess !== "None") {
    domains.unshift("additional_metabolic_process");
  }
  if (missedStepKeys.has("primary_disorder")) domains.push("primary_disorder");
  if (missedStepKeys.has("ph_status")) domains.push("ph_status");
  return domains;
}

function getOverviewPriority(variant: ExplanationVariant): ExplanationDomain[] {
  return variant === "advanced" || variant === "master"
    ? ADVANCED_MASTER_OVERVIEW_PRIORITY
    : BEGINNER_INTERMEDIATE_OVERVIEW_PRIORITY;
}

export function composeCaseStructuredExplanation(caseItem: CaseData, stepResults?: StepResult[]): StructuredExplanation {
  const variant = getExplanationVariant(caseItem);
  const lookup = getEntryLookup(caseItem, variant);
  const missedStepKeys = new Set(
    (stepResults ?? [])
      .filter(result => result.correct === false)
      .map(result => result.key)
  );
  const selectedDomains = getSelectedDomains(caseItem, missedStepKeys);
  const sections: ExplanationSection[] = [];

  for (const domain of selectedDomains) {
    const entry = lookup.get(domain);
    if (!entry) continue;
    sections.push({
      key: entry.domain,
      title: entry.title,
      body: entry.body,
      order: entry.order
    });
  }

  let overview = "";
  for (const domain of getOverviewPriority(variant)) {
    if (!selectedDomains.includes(domain)) continue;
    const entry = lookup.get(domain);
    if (!entry) continue;
    overview = firstSentence(entry.body);
    break;
  }

  if (!overview && sections.length) {
    overview = firstSentence(sections[0].body);
  }

  return {
    overview,
    sections
  };
}

export function buildConciseStepFeedback(caseItem: CaseData, stepKey: string): StepFeedbackEntry | null {
  const entry = caseItem.step_feedback?.[stepKey];
  if (!entry) return null;

  return {
    ...entry,
    body: firstSentence(entry.body)
  };
}

export function supportsInlineStepFeedback(caseItem: CaseData | null | undefined): boolean {
  if (!caseItem) return false;
  const level = Number(caseItem.difficulty_level ?? 1);
  return level <= 2 && caseItem.protected_payload_mode === "practice_learning";
}
