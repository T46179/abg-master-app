import type { BrowserStorageLike } from "./storage";

export const EXAM_ROLES = ["Doctor", "Medical student", "Nurse", "Paramedic", "Other"] as const;
export const EXAM_STAGES = ["Intern / resident / junior doctor", "Registrar / specialty trainee", "Specialist / consultant", "Other", "Prefer not to say"] as const;
export const EXAM_SPECIALTIES = ["Emergency medicine", "Intensive care", "Anaesthetics", "Respiratory", "Other", "Not yet chosen / prefer not to say"] as const;
export const EXAM_REASONS = ["Preparing for an exam", "Improving clinical skills", "General study and revision", "Teaching others"] as const;
export type ExamOnboarding = { role: string; otherRole: string; stage: string; specialty: string; reason: string; complete: boolean };
export const emptyExamOnboarding = (): ExamOnboarding => ({ role: "", otherRole: "", stage: "", specialty: "", reason: "", complete: false });
export function missingExamOnboarding(value: ExamOnboarding): string[] {
  return [!EXAM_ROLES.includes(value.role as typeof EXAM_ROLES[number]) && "role",
    value.role === "Doctor" && !EXAM_STAGES.includes(value.stage as typeof EXAM_STAGES[number]) && "stage",
    ["Doctor", "Nurse"].includes(value.role) && !EXAM_SPECIALTIES.includes(value.specialty as typeof EXAM_SPECIALTIES[number]) && "specialty",
    !EXAM_REASONS.includes(value.reason as typeof EXAM_REASONS[number]) && "reason"].filter((key): key is string => typeof key === "string");
}
export function normaliseExamOnboarding(value: ExamOnboarding): ExamOnboarding {
  return { role: value.role, reason: value.reason, complete: value.complete, otherRole: value.role === "Other" ? value.otherRole.slice(0, 120) : "",
    stage: value.role === "Doctor" ? value.stage : "", specialty: ["Doctor", "Nurse"].includes(value.role) ? value.specialty : "" };
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
    if (record.version !== 1 || ["role", "otherRole", "stage", "specialty", "reason"].some(k => typeof record[k] !== "string") || typeof record.complete !== "boolean") return emptyExamOnboarding();
    if ((record.role && !EXAM_ROLES.includes(record.role as typeof EXAM_ROLES[number])) || (record.stage && !EXAM_STAGES.includes(record.stage as typeof EXAM_STAGES[number])) || (record.specialty && !EXAM_SPECIALTIES.includes(record.specialty as typeof EXAM_SPECIALTIES[number])) || (record.reason && !EXAM_REASONS.includes(record.reason as typeof EXAM_REASONS[number]))) return emptyExamOnboarding();
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
