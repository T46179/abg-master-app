import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./storage";
import { emptyExamOnboarding, examOnboardingKey, loadExamOnboarding, missingExamOnboarding, normaliseExamOnboarding, saveExamOnboarding } from "./examOnboarding";
const staging = "https://staging.supabase.co";
const production = "https://production.supabase.co";
const complete = { ...emptyExamOnboarding(), role: "Doctor", stage: "Prefer not to say", specialty: "Respiratory", reason: "Preparing for an exam", complete: true };
describe("Exam onboarding ownership and versioning", () => {
  it("separates owners and environments, restoring drafts without granting completion", () => {
    const storage = createMemoryStorage();
    saveExamOnboarding(storage, staging, "a", { ...complete, complete: false });
    expect(loadExamOnboarding(storage, staging, "a")).toEqual({ ...complete, complete: false });
    expect(loadExamOnboarding(storage, staging, "b")).toEqual(emptyExamOnboarding());
    expect(loadExamOnboarding(storage, production, "a")).toEqual(emptyExamOnboarding());
  });
  it("only restores a valid completed record", () => {
    const storage = createMemoryStorage(); saveExamOnboarding(storage, staging, "a", complete);
    expect(loadExamOnboarding(storage, staging, "a").complete).toBe(true);
    saveExamOnboarding(storage, staging, "a", { ...complete, stage: "" });
    expect(loadExamOnboarding(storage, staging, "a").complete).toBe(false);
  });
  it("reopens missing, malformed, unknown-version and obsolete-choice records without deleting them", () => {
    const storage = createMemoryStorage(); const key = examOnboardingKey(staging, "a");
    for (const raw of ["broken", "null", JSON.stringify({ ...complete, version: 0 }), JSON.stringify({ ...complete, version: 2 }), JSON.stringify({ ...complete, version: 1, specialty: "Old specialty" })]) {
      storage.setItem(key, raw); expect(loadExamOnboarding(storage, staging, "a")).toEqual(emptyExamOnboarding()); expect(storage.getItem(key)).toBe(raw);
    }
  });
  it("validates conditional fields and removes hidden answers when role changes", () => {
    expect(missingExamOnboarding(emptyExamOnboarding())).toEqual(["role", "reason"]);
    expect(missingExamOnboarding({ ...complete, stage: "", specialty: "" })).toEqual(["stage", "specialty"]);
    expect(missingExamOnboarding({ ...complete, role: "Nurse", stage: "", specialty: "Other" })).toEqual([]);
    expect(normaliseExamOnboarding({ ...complete, role: "Medical student" })).toMatchObject({ stage: "", specialty: "" });
    expect(normaliseExamOnboarding({ ...complete, otherRole: "not relevant" }).otherRole).toBe("");
  });
  it("accepts nursing choices with optional specialty text and restores it", () => {
    const storage = createMemoryStorage();
    for (const specialty of ["Critical care", "Other"]) {
      const draft = normaliseExamOnboarding({ ...complete, role: "Nurse", specialty, otherSpecialty: "Ward nursing" });
      expect(missingExamOnboarding(draft)).toEqual([]);
      saveExamOnboarding(storage, staging, "a", draft);
      expect(loadExamOnboarding(storage, staging, "a")).toEqual(draft);
    }
    expect(missingExamOnboarding({ ...complete, role: "Nurse", specialty: "Other", otherSpecialty: "" })).toEqual([]);
    expect(missingExamOnboarding({ ...complete, role: "Nurse", specialty: "Respiratory" })).toEqual(["specialty"]);
    expect(normaliseExamOnboarding({ ...complete, otherSpecialty: "hidden" }).otherSpecialty).toBe("");
  });
  it("preserves completed legacy role and nursing answers", () => {
    const storage = createMemoryStorage();
    const key = examOnboardingKey(staging, "a");
    storage.setItem(key, JSON.stringify({ ...complete, role: "Paramedic", version: 1 }));
    expect(loadExamOnboarding(storage, staging, "a")).toMatchObject({ role: "Other", otherRole: "Paramedic", complete: true });
    storage.setItem(key, JSON.stringify({ ...complete, role: "Nurse", specialty: "Intensive care", version: 1 }));
    expect(loadExamOnboarding(storage, staging, "a")).toMatchObject({ specialty: "Critical care", complete: true });
    storage.setItem(key, JSON.stringify({ ...complete, role: "Nurse", version: 1 }));
    expect(loadExamOnboarding(storage, staging, "a")).toMatchObject({ specialty: "Other", otherSpecialty: "Respiratory", complete: true });
  });
  it("reports unavailable storage instead of pretending answers were saved", () => {
    expect(saveExamOnboarding({ getItem: () => null, removeItem: () => undefined, setItem: () => { throw new Error("blocked"); } }, staging, "a", complete)).toBe(false);
  });
});
