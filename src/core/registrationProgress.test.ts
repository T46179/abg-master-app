import { describe, expect, it } from "vitest";
import { meaningfulRegistrationProgress } from "./registrationProgress";
import { createEmptyUserState } from "./progression";
describe("meaningful signup progress", () => {
  const base = () => ({ user: createEmptyUserState(), seen: {}, unfinished: false, checked: true });
  it("distinguishes confirmed empty progress from unavailable progress", () => {
    expect(meaningfulRegistrationProgress(base())).toBe(false);
    expect(meaningfulRegistrationProgress({ ...base(), checked: false })).toBeNull();
  });
  it.each(["xp", "streak", "casesCompleted", "totalAnswers"] as const)("keeps saved %s meaningful", field => {
    const input = base(); input.user[field] = 1; expect(meaningfulRegistrationProgress(input)).toBe(true);
  });
  it("includes calibration, seen cases, Learn and unfinished work", () => {
    expect(meaningfulRegistrationProgress({ ...base(), user: { ...base().user, calibrationCompleted: true } })).toBe(true);
    expect(meaningfulRegistrationProgress({ ...base(), seen: { beginner: ["case"] } })).toBe(true);
    expect(meaningfulRegistrationProgress({ ...base(), unfinished: true })).toBe(true);
    expect(meaningfulRegistrationProgress({ ...base(), user: { ...base().user, learnProgress: { a: { completedLessonCount: 1, completed: false } } } })).toBe(true);
  });
});
