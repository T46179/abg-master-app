import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCalibrationCompletionRecord, getCalibrationCompletionUserFields } from "./calibration";
import { createLocalStorageAdapter, createMemoryStorage, sanitizeCalibrationCompletion } from "./storage";
import { completeCalibrationProgress, loadRemoteProgressRow } from "./progressionSync";
import { createEmptyUserState, getCalibrationCompletionFromUserState, getSkillEligibleDifficultyKeys, mapProgressRowToUserState } from "./progression";
import { getDefaultPracticeDifficulty, resolvePracticeDifficulty } from "../app/viewHelpers";
import { generateBloodGasBlitzQuestions } from "../presentation/minigames/BloodGasBlitz";

describe("Calibration 3 persistence and compatibility", () => {
  it("retains a Master recommendation locally without earning a Master unlock", async () => {
    const completion = createCalibrationCompletionRecord("master");
    expect(completion).toEqual({ completed: true, placement: "advanced", recommendation: "master", version: 3 });
    const adapter = createLocalStorageAdapter(createMemoryStorage());
    await adapter.init({ releaseSignature: "unchanged" });
    adapter.saveCalibrationCompletion(completion);
    expect(adapter.loadCalibrationCompletion()).toEqual(completion);
    const userState = { ...createEmptyUserState(), ...getCalibrationCompletionUserFields(completion) };
    await adapter.saveUserState(userState);
    expect(getCalibrationCompletionFromUserState((await adapter.loadUserState())!)).toEqual(completion);
    expect(getSkillEligibleDifficultyKeys(userState)).toEqual(["beginner", "intermediate", "advanced"]);
    expect(userState.masterUnlockedAt).toBeUndefined();
    expect(getDefaultPracticeDifficulty({ progressionConfig: { release_flags: { enable_open_practice_access: true } }, userState }, null)).toBe("master");
    expect(resolvePracticeDifficulty({ requestedDifficulty: null, hasExplicitDifficultyParam: false, calibrationRecord: completion, progressionInput: { progressionConfig: null, userState }, lastPracticeDifficulty: null, enableCalibrationAccessGuard: false })).toMatchObject({ requiresSelection: true, resolvedDifficulty: "master" });
  });

  it("leaves old completion records unchanged and rejects an inconsistent recommendation", () => {
    const legacy = { completed: true, placement: "intermediate", version: 1 };
    expect(sanitizeCalibrationCompletion(legacy)).toEqual(legacy);
    expect(sanitizeCalibrationCompletion({ ...legacy, version: 3, recommendation: "master" })?.recommendation).toBeUndefined();
    expect(mapProgressRowToUserState({ calibration_completed: false })).toMatchObject({ calibrationRecommendation: null });
  });

  it("passes v3 recommendation metadata through the existing RPC payload", async () => {
    const rpc = vi.fn(async () => ({ data: { calibration_completed: true, calibration_placement: "advanced", master_unlocked_at: null }, error: null }));
    const result = await completeCalibrationProgress({ supabase: { rpc } as unknown as SupabaseClient, progressionConfig: null, placement: "advanced", completion: createCalibrationCompletionRecord("master"), attemptPayload: { elapsedMs: 555000 } });
    expect(rpc).toHaveBeenCalledWith("complete_calibration", expect.objectContaining({ p_placement: "advanced", p_calibration_version: 3, p_attempt_payload: { elapsedMs: 555000, recommendation: "master", scoring_version: 3 } }));
    expect(mapProgressRowToUserState(result)).toMatchObject({ calibrationRecommendation: "master", calibrationPlacement: "advanced", calibrationVersion: 3, masterUnlockedAt: null });
  });

  it("restores a remote recommendation from existing attempt JSON with user and reset boundaries", async () => {
    const queries: Array<{ table: string; filters: unknown[][] }> = [];
    const from = vi.fn((table: string) => {
      const filters: unknown[][] = [];
      queries.push({ table, filters });
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((...args: unknown[]) => { filters.push(args); return query; }),
        gte: vi.fn((...args: unknown[]) => { filters.push(args); return query; }),
        gt: vi.fn((...args: unknown[]) => { filters.push(args); return query; }),
        order: vi.fn(() => query), limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: table === "user_progress"
          ? { calibration_completed: true, calibration_placement: "advanced", reset_at: "2026-10-01T00:00:00Z" }
          : { placement: "advanced", calibration_version: 3, attempt_payload: { recommendation: "master" } }, error: null }))
      };
      return query;
    });
    const result = await loadRemoteProgressRow({ supabase: { from } as unknown as SupabaseClient, userId: "test-user", progressionConfig: null });
    expect(result).toMatchObject({ calibration_recommendation: "master", calibration_placement: "advanced", calibration_version: 3 });
    expect(queries[1]).toMatchObject({ table: "calibration_attempts" });
    expect(queries[1].filters).toEqual(expect.arrayContaining([["user_id", "test-user"], ["progression_version", "v2"], ["beta_release_number", 2], ["calibration_version", 3], ["completed_at", "2026-10-01T00:00:00Z"]]));
  });

  it("generates exactly two of each pH category for Calibration and preserves Learn's ten", () => {
    for (let run = 0; run < 30; run++) {
      const questions = generateBloodGasBlitzQuestions("ph-classification-calibration-v3");
      expect(questions).toHaveLength(6);
      for (const category of ["Acidaemia", "Normal", "Alkalaemia"]) expect(questions.filter(question => question.expectedAnswer === category)).toHaveLength(2);
      expect(new Set(questions.map(question => question.value)).size).toBe(6);
    }
    expect(generateBloodGasBlitzQuestions("ph-classification-v1")).toHaveLength(10);
  });
});
