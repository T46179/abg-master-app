import type { SupabaseClient } from "@supabase/supabase-js";
import { ExamRuntimeError, runtimeCall } from "./examRuntime";
import type { BrowserStorageLike } from "./storage";

export const EXAM_ROLES = ["Doctor", "Medical student", "Nurse", "Other"] as const;
export const EXAM_STAGES = ["Intern / resident / junior doctor", "Registrar / specialty trainee", "Specialist / consultant", "Other", "Prefer not to say"] as const;
export const EXAM_SPECIALTIES = ["Emergency medicine", "Intensive care", "Anaesthetics", "Respiratory", "Other", "Not yet chosen / prefer not to say"] as const;
export const EXAM_NURSING_SPECIALTIES = ["Critical care", "Other"] as const;
export const EXAM_REASONS = ["Preparing for an exam", "Improving clinical skills", "General study and revision", "Teaching others"] as const;
export type ExamOnboarding = { role: string; otherRole: string; otherSpecialty: string; stage: string; specialty: string; reason: string; complete: boolean };
export const emptyExamOnboarding = (): ExamOnboarding => ({ role: "", otherRole: "", otherSpecialty: "", stage: "", specialty: "", reason: "", complete: false });
export function missingExamOnboarding(value: ExamOnboarding): string[] {
  return [!EXAM_ROLES.includes(value.role as typeof EXAM_ROLES[number]) && "role",
    value.role === "Doctor" && !EXAM_STAGES.includes(value.stage as typeof EXAM_STAGES[number]) && "stage",
    (value.role === "Doctor" && !EXAM_SPECIALTIES.includes(value.specialty as typeof EXAM_SPECIALTIES[number]) || value.role === "Nurse" && !EXAM_NURSING_SPECIALTIES.includes(value.specialty as typeof EXAM_NURSING_SPECIALTIES[number])) && "specialty",
    !EXAM_REASONS.includes(value.reason as typeof EXAM_REASONS[number]) && "reason"].filter((key): key is string => typeof key === "string");
}
export function normaliseExamOnboarding(value: ExamOnboarding): ExamOnboarding {
  const role = value.role === "Paramedic" ? "Other" : value.role;
  const legacyNursing = role === "Nurse" && value.specialty && !EXAM_NURSING_SPECIALTIES.includes(value.specialty as typeof EXAM_NURSING_SPECIALTIES[number]);
  const specialty = legacyNursing ? (value.specialty === "Intensive care" ? "Critical care" : "Other") : value.specialty;
  return { role, reason: value.reason, complete: value.complete,
    otherRole: role === "Other" ? (value.role === "Paramedic" ? "Paramedic" : value.otherRole).slice(0, 120) : "",
    otherSpecialty: role === "Nurse" && specialty === "Other" ? (value.otherSpecialty || (legacyNursing ? value.specialty : "")).slice(0, 120) : "",
    stage: role === "Doctor" ? value.stage : "", specialty: ["Doctor", "Nurse"].includes(role) ? specialty : "" };
}
export function examOnboardingKey(projectUrl: string, userId: string): string {
  const origin = new URL(projectUrl).origin;
  if (!userId.trim()) throw new Error("An account is required.");
  return `abgm-exam-onboarding:v1:${encodeURIComponent(origin)}:${encodeURIComponent(userId)}`;
}
export function loadExamOnboarding(storage: BrowserStorageLike, projectUrl: string, userId: string): ExamOnboarding {
  try {
    const value: unknown = JSON.parse(storage.getItem(examOnboardingKey(projectUrl, userId)) ?? "null");
    if (!value || typeof value !== "object") return emptyExamOnboarding();
    const record = value as Record<string, unknown>;
    if (record.version !== 1 || ["role", "otherRole", "stage", "specialty", "reason"].some(k => typeof record[k] !== "string") || typeof record.complete !== "boolean" || (record.otherSpecialty !== undefined && typeof record.otherSpecialty !== "string")) return emptyExamOnboarding();
    if ((record.role && record.role !== "Paramedic" && !EXAM_ROLES.includes(record.role as typeof EXAM_ROLES[number])) || (record.stage && !EXAM_STAGES.includes(record.stage as typeof EXAM_STAGES[number])) || (record.specialty && !(record.role === "Nurse" && EXAM_NURSING_SPECIALTIES.includes(record.specialty as typeof EXAM_NURSING_SPECIALTIES[number])) && !EXAM_SPECIALTIES.includes(record.specialty as typeof EXAM_SPECIALTIES[number])) || (record.reason && !EXAM_REASONS.includes(record.reason as typeof EXAM_REASONS[number]))) return emptyExamOnboarding();
    const draft = normaliseExamOnboarding(record as unknown as ExamOnboarding);
    return { ...draft, complete: draft.complete && missingExamOnboarding(draft).length === 0 };
  } catch { return emptyExamOnboarding(); }
}
export function saveExamOnboarding(storage: BrowserStorageLike, projectUrl: string, userId: string, value: ExamOnboarding): boolean {
  try {
    const draft = normaliseExamOnboarding(value);
    storage.setItem(examOnboardingKey(projectUrl, userId), JSON.stringify({ ...draft, complete: draft.complete && !missingExamOnboarding(draft).length, version: 1 }));
    return true;
  } catch { return false; }
}

// Persist stable values independently of the wording shown in the questionnaire.
const profileCodes = {
  role: { Doctor: "doctor", "Medical student": "medical_student", Nurse: "nurse", Other: "other" },
  stage: {
    "Intern / resident / junior doctor": "intern_resident_junior_doctor",
    "Registrar / specialty trainee": "registrar_specialty_trainee",
    "Specialist / consultant": "specialist_consultant", Other: "other", "Prefer not to say": "prefer_not_to_say"
  },
  specialty: {
    "Emergency medicine": "emergency_medicine", "Intensive care": "intensive_care", Anaesthetics: "anaesthetics",
    Respiratory: "respiratory", "Critical care": "critical_care", Other: "other",
    "Not yet chosen / prefer not to say": "not_yet_chosen_or_prefer_not_to_say"
  },
  reason: {
    "Preparing for an exam": "exam_preparation", "Improving clinical skills": "improving_clinical_skills",
    "General study and revision": "general_study_and_revision", "Teaching others": "teaching_others"
  }
} satisfies Record<string, Record<string, string>>;

export interface ExamOnboardingProfile {
  revision: string | null;
  completedAt: string | null;
  answers: ExamOnboarding | null;
}

type Category = keyof typeof profileCodes;
function profileCode(category: Category, label: string) {
  return (profileCodes[category] as Record<string, string>)[label] ?? null;
}
function profileLabel(category: Category, code: unknown): string {
  if (code === null) return "";
  const label = Object.entries(profileCodes[category]).find(([, value]) => value === code)?.[0];
  if (!label) throw new ExamRuntimeError("EXAM_INVALID_RESPONSE");
  return label;
}

function decodeOnboardingProfile(profile: Record<string, unknown>): ExamOnboardingProfile {
  const { revision, completedAt, answers } = profile;
  const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
  if (revision !== null && !timestamp(revision)) throw new ExamRuntimeError("EXAM_INVALID_RESPONSE");
  if (completedAt === null && answers === null) return { revision, completedAt, answers };
  if (!timestamp(completedAt) || !revision || !answers || typeof answers !== "object") throw new ExamRuntimeError("EXAM_INVALID_RESPONSE");
  const fields = answers as Record<string, unknown>;
  const otherText = (value: unknown) => {
    if (value === null) return "";
    if (typeof value !== "string" || Array.from(value).length > 120) throw new ExamRuntimeError("EXAM_INVALID_RESPONSE");
    return value;
  };
  const value = {
    role: profileLabel("role", fields.role), stage: profileLabel("stage", fields.stage),
    specialty: profileLabel("specialty", fields.specialty), reason: profileLabel("reason", fields.reason),
    otherRole: otherText(fields.otherRole), otherSpecialty: otherText(fields.otherSpecialty), complete: true
  };
  if (missingExamOnboarding(value).length) throw new ExamRuntimeError("EXAM_INVALID_RESPONSE");
  return { revision, completedAt, answers: value };
}

export async function readExamOnboardingProfile(client: SupabaseClient): Promise<ExamOnboardingProfile> {
  return decodeOnboardingProfile(await runtimeCall(client)("onboarding_read", {}));
}

export async function saveExamOnboardingProfile(client: SupabaseClient, revision: string | null, value: ExamOnboarding): Promise<ExamOnboardingProfile> {
  const answers = normaliseExamOnboarding(value);
  if (missingExamOnboarding(answers).length) throw new ExamRuntimeError("EXAM_INVALID_ONBOARDING");
  const profile = decodeOnboardingProfile(await runtimeCall(client)("onboarding_save", {
    revision, role: profileCode("role", answers.role), stage: profileCode("stage", answers.stage),
    specialty: profileCode("specialty", answers.specialty), reason: profileCode("reason", answers.reason),
    otherRole: answers.otherRole.trim() || null, otherSpecialty: answers.otherSpecialty.trim() || null
  }));
  if (!profile.answers) throw new ExamRuntimeError("EXAM_INVALID_RESPONSE");
  return profile;
}
