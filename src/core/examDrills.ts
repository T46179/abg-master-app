import type { SupabaseClient } from "@supabase/supabase-js";
import type { PressureUnit } from "./types";

export const drillCounts = [5, 10, 15, 20] as const;
export type DrillCount = typeof drillCounts[number];
export type DrillKey = "anion-gap" | "compensation" | "delta-ratio" | "aa-gradient" | "pf-ratio" | "corrections";
export type CompensationRule = "met-acidosis" | "met-alkalosis" | "respiratory";
export type DrillRequest =
  | { drill: "compensation"; count: DrillCount; rule: CompensationRule; pressureUnit: PressureUnit }
  | { drill: "aa-gradient" | "pf-ratio" | "delta-ratio"; count: DrillCount; pressureUnit: PressureUnit }
  | { drill: "anion-gap" | "corrections"; count: DrillCount };
export type DrillVisual =
  | { kind: "range"; label: string; value: number; low: number; high: number; unit: string }
  | { kind: "difference"; label: string; alveolar: number; arterial: number; gradient: number; unit: string };
export type DrillQuestion = {
  correctedGap?: boolean;
  respiratoryPattern?: string;
  values: { label: string; value: number; unit: string; decimals?: number; reference?: string }[];
  numeric: { prompt: string; target: number; tolerance: number; decimals: number; unit: string; working: string };
  choice?: { prompt: string; options: { id: string; label: string }[]; correctId: string; working: string };
  visual?: DrillVisual;
};
export type DrillSet = { help: { title: string; formula: string; note?: string }; questions: DrillQuestion[]; alternateQuestions?: DrillQuestion[] };
export type DrillLoader = (request: DrillRequest, signal: AbortSignal) => Promise<DrillSet>;

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validDecimals = (value: unknown) => isFiniteNumber(value) && Number.isInteger(value) && value >= 0 && value <= 2;

function validQuestion(question: unknown): question is DrillQuestion {
  if (!isRecord(question)) return false;
  if (question.correctedGap !== undefined && typeof question.correctedGap !== "boolean") return false;
  if (question.respiratoryPattern !== undefined && !hasText(question.respiratoryPattern)) return false;
  const { values, numeric, choice, visual } = question;
  if (!Array.isArray(values) || !values.length || !values.every(tile => isRecord(tile)
    && hasText(tile.label) && isFiniteNumber(tile.value) && typeof tile.unit === "string"
    && (tile.decimals === undefined || validDecimals(tile.decimals))
    && (tile.reference === undefined || hasText(tile.reference)))) return false;
  if (!isRecord(numeric) || !hasText(numeric.prompt) || !isFiniteNumber(numeric.target)
    || !isFiniteNumber(numeric.tolerance) || numeric.tolerance < 0 || !validDecimals(numeric.decimals)
    || typeof numeric.unit !== "string" || !hasText(numeric.working)) return false;
  if (choice !== undefined && (!isRecord(choice) || !hasText(choice.prompt) || !hasText(choice.working)
    || !Array.isArray(choice.options) || choice.options.length < 2
    || !choice.options.every(option => isRecord(option) && hasText(option.id) && hasText(option.label))
    || new Set(choice.options.map(option => option.id)).size !== choice.options.length
    || !choice.options.some(option => option.id === choice.correctId))) return false;
  if (visual === undefined) return true;
  if (!isRecord(visual) || !hasText(visual.label) || typeof visual.unit !== "string") return false;
  if (visual.kind === "range") return isFiniteNumber(visual.value) && isFiniteNumber(visual.low)
    && isFiniteNumber(visual.high) && visual.low < visual.high;
  return visual.kind === "difference" && isFiniteNumber(visual.alveolar) && isFiniteNumber(visual.arterial)
    && isFiniteNumber(visual.gradient) && visual.alveolar > 0 && visual.arterial > 0 && visual.arterial <= visual.alveolar && visual.gradient >= 0;
}

function validSet(value: unknown, count: DrillCount): value is DrillSet {
  return isRecord(value) && isRecord(value.help) && hasText(value.help.title) && hasText(value.help.formula)
    && (value.help.note === undefined || hasText(value.help.note))
    && Array.isArray(value.questions) && value.questions.length === count && value.questions.every(validQuestion);
}

const respiratoryResponseOptions = [
  { id: "above", label: "Additional respiratory acidosis" },
  { id: "below", label: "Additional respiratory alkalosis" },
  { id: "within", label: "Appropriate respiratory compensation" },
];

const metabolicResponseOptions = [
  { id: "within", label: "Appropriate metabolic compensation" },
  { id: "below", label: "Additional metabolic acidosis" },
  { id: "above", label: "Additional metabolic alkalosis" },
];

function normalizeLegacyQuestion(question: DrillQuestion, request: DrillRequest): DrillQuestion {
  const { numeric, choice, visual } = question;
  if (request.drill === "anion-gap") return {
    ...question, choice: undefined, correctedGap: question.correctedGap ?? (visual?.label === "Albumin-corrected AG"),
    numeric: { ...numeric, prompt: "What is the anion gap?", working: numeric.working.replace(/^(?!AG = )/, "AG = ")
      .replace(". Correct for albumin: ", "\nCorrected AG = ") },
  };
  if (request.drill === "compensation") {
    const pattern = numeric.prompt.match(/^Calculate the expected HCO₃⁻ for ((?:acute|chronic) respiratory (?:acidosis|alkalosis))$/)?.[1];
    return { ...question, respiratoryPattern: pattern,
      numeric: { ...numeric, prompt: pattern ? `Calculate the expected HCO₃⁻ (${pattern.split(" ")[0]})` : numeric.prompt,
        working: numeric.working.split(". Expected range: ", 1)[0] },
      choice: choice && { ...choice,
        prompt: choice.prompt === "How does the measured PaCO₂ compare with the expected range?" ? "Interpret the respiratory response."
          : choice.prompt === "How does the measured HCO₃⁻ compare with the expected range?" ? "Interpret the HCO₃⁻ response." : choice.prompt,
        options: request.rule === "respiratory" ? metabolicResponseOptions : respiratoryResponseOptions },
    };
  }
  if (request.drill === "delta-ratio" && choice?.prompt === "What does this delta ratio suggest in high anion gap metabolic acidosis?")
    return { ...question, choice: { ...choice, prompt: "What acid–base disorder does this suggest?" } };
  return question;
}

export function readDrillSet(data: unknown, request: DrillRequest): DrillSet {
  const invalid = () => new Error("We couldn’t load this drill. Please try again.");
  if (!validSet(data, request.count)) throw invalid();
  if (data.alternateQuestions !== undefined) {
    if (!("pressureUnit" in request) || !Array.isArray(data.alternateQuestions)
      || data.alternateQuestions.length !== request.count
      || !data.alternateQuestions.every((q, i) => validQuestion(q) && q.choice?.correctId === data.questions[i].choice?.correctId))
      throw invalid();
    return data;
  }
  const formula = data.help.formula.replace(/^Expected (?=(?:PaCO₂|HCO₃⁻) = )/, "")
    .replace("0.3(Glucose − 5.5)", "0.3 × (Glucose − 5.5)").replace("(Anion gap − 12)", "(AG − 12)");
  const legacyFormula = request.drill === "compensation" && request.rule === "respiratory"
    ? "HCO₃⁻ = 24 + multiplier × (PaCO₂ − 40) ÷ 10 ± 2"
    : formula === "PaCO₂ = 1.5 × HCO₃⁻ + 8" ? formula + " ± 2"
    : formula === "PaCO₂ = 40 + 0.7 × (HCO₃⁻ − 24)" ? formula + " ± 3" : formula;
  return { help: { ...data.help, formula: legacyFormula }, questions: data.questions.map(q => normalizeLegacyQuestion(q, request)) };
}

export async function requestDrill(client: SupabaseClient, request: DrillRequest, signal: AbortSignal): Promise<DrillSet> {
  const { data, error } = await client.functions.invoke("exam-drills", { body: request, signal });
  if (error) {
    const status = error.context?.status;
    throw new Error(status === 401 ? "Your session has expired. Please sign in again." : status === 403
      ? "Focused Drills require an active Exam plan."
      : "We couldn’t generate this drill. Please try again.");
  }
  return readDrillSet(data, request);
}

export function checkDrillNumber(entry: string, { target, tolerance }: DrillQuestion["numeric"]): boolean | null {
  const trimmed = entry.trim();
  if (trimmed.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return null;
  const number = Number(trimmed);
  if (!Number.isFinite(number)) return null;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(target)) * 8;
  return Math.abs(number - target) <= tolerance + epsilon;
}
