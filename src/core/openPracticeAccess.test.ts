import { describe, expect, it, vi } from "vitest";
import { resolvePracticeDifficulty, getDefaultPracticeDifficulty } from "../app/viewHelpers";
import { createLocalStorageAdapter } from "./storage";
import { loadCasesPayload } from "./runtime";
import {
  applyDifficultyUnlocks, canAccessDifficulty, createEmptyUserState,
  getAwardableXpWithReadinessGates, getBlockedXpGate, getReleaseFlags, getReleaseSignature
} from "./progression";
import { shouldHoldLearnerRouteForCalibration, shouldRedirectToCalibrationOnboarding, resolveCalibrationState } from "./calibrationOnboarding";
import type { ProgressionConfig } from "./types";

const baseConfig: ProgressionConfig = {
  version: "v2", beta_release_number: 2,
  xp_required_per_level: Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 1, 100])),
  difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
};

describe("reversible Practice access", () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])("keeps access and readiness independent: open=%s legacy=%s", (open, legacy) => {
    const config = { ...baseConfig, release_flags: { enable_open_practice_access: open, enable_all_difficulties: legacy } };
    const userState = { ...createEmptyUserState(), xp: 899, level: 9 };
    expect(canAccessDifficulty({ progressionConfig: config, userState }, "master")).toBe(open || legacy);
    expect(getAwardableXpWithReadinessGates({ progressionConfig: config, userState, requestedXp: 50, attemptsIncludingCurrent: [] })).toBe(open ? 50 : 0);
    expect(Boolean(getBlockedXpGate(config, userState))).toBe(!open);
    expect(userState.masterUnlockedAt).toBeUndefined();
  });

  it("defaults off, preserves max XP and does not grant Master from completing Master", () => {
    expect(getReleaseFlags(null).enable_open_practice_access).toBe(false);
    const progressionConfig = { ...baseConfig, release_flags: { enable_open_practice_access: true } };
    const userState = { ...createEmptyUserState(), xp: 1890 };
    expect(getAwardableXpWithReadinessGates({ progressionConfig, userState, requestedXp: 50, attemptsIncludingCurrent: [] })).toBe(10);
    const attempts = Array.from({ length: 5 }, () => ({ difficulty: "master", correctSteps: 4, totalSteps: 4 }));
    expect(applyDifficultyUnlocks({ progressionConfig, userState: { ...userState, level: 19 }, attempts }).masterUnlockedAt).toBeUndefined();
  });

  it("requires explicit reselection without changing a locked saved preference", () => {
    const userState = createEmptyUserState();
    const progressionInput = { progressionConfig: baseConfig, userState };
    const input = { requestedDifficulty: null, hasExplicitDifficultyParam: false, calibrationRecord: null, progressionInput, lastPracticeDifficulty: "master", enableCalibrationAccessGuard: false };
    expect(resolvePracticeDifficulty(input)).toMatchObject({ resolvedDifficulty: "master", requiresSelection: true });
    expect(resolvePracticeDifficulty({ ...input, requestedDifficulty: "advanced", hasExplicitDifficultyParam: true })).toMatchObject({ resolvedDifficulty: "advanced", requiresSelection: true });
    expect(resolvePracticeDifficulty({ ...input, requestedDifficulty: "beginner", hasExplicitDifficultyParam: true }).requiresSelection).toBeFalsy();
    expect(userState).toEqual(createEmptyUserState());
  });

  it("uses explicit URL, last selection, Calibration suggestion, then Beginner in open mode", () => {
    const progressionInput = { progressionConfig: { release_flags: { enable_open_practice_access: true } }, userState: createEmptyUserState() };
    const input = { requestedDifficulty: null, hasExplicitDifficultyParam: false, calibrationRecord: null, progressionInput, lastPracticeDifficulty: null, enableCalibrationAccessGuard: false };
    expect(resolvePracticeDifficulty(input).resolvedDifficulty).toBe("beginner");
    expect(getDefaultPracticeDifficulty(progressionInput, null)).toBe("beginner");
    const calibrated = { ...input, calibrationRecord: { completed: true, placement: "advanced", version: 2 } as const };
    expect(resolvePracticeDifficulty(calibrated).resolvedDifficulty).toBe("advanced");
    expect(resolvePracticeDifficulty({ ...calibrated, lastPracticeDifficulty: "intermediate" }).resolvedDifficulty).toBe("intermediate");
    expect(resolvePracticeDifficulty({ ...calibrated, lastPracticeDifficulty: "intermediate", requestedDifficulty: "master", hasExplicitDifficultyParam: true }).resolvedDifficulty).toBe("master");
  });

  it.each(["loading", "absent", "unavailable"] as const)("does not re-invite accepted/dismissed users while remote=%s", remoteStatus => {
    const input = { pathname: "/practice", calibration: resolveCalibrationState({ localCompletion: null, remoteCompletion: null, remoteStatus }), hasMeaningfulProgress: false, hasSeenIntroduction: true };
    expect(shouldHoldLearnerRouteForCalibration(input)).toBe(false);
    expect(shouldRedirectToCalibrationOnboarding(input)).toBe(false);
  });

  it("refreshes flags at the same progression version and preserves user history", async () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
    const adapter = createLocalStorageAdapter(storage);
    await adapter.init({ releaseSignature: getReleaseSignature(baseConfig) });
    await adapter.saveUserState({ ...createEmptyUserState(), xp: 300, casesCompleted: 3 });
    for (const open of [false, true, false]) {
      const progression_config = { ...baseConfig, release_flags: { enable_open_practice_access: open } };
      const fetcher = vi.fn(async () => Response.json({ delivery_mode: "protected_runtime", progression_config, content_version: "same" }));
      const payload = await loadCasesPayload(fetcher as typeof fetch, storage);
      expect(payload.progressionConfig?.release_flags?.enable_open_practice_access).toBe(open);
      expect(fetcher).toHaveBeenCalledWith("/runtime_bootstrap.json", { cache: "no-store" });
      await adapter.init({ releaseSignature: getReleaseSignature(progression_config) });
      expect((await adapter.loadUserState())?.xp).toBe(300);
    }
    const fallback = await loadCasesPayload(vi.fn(async () => { throw new Error("offline"); }) as typeof fetch, storage);
    expect(fallback.progressionConfig?.release_flags?.enable_open_practice_access).toBe(false);
  });
});
