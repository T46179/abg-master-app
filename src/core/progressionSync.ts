import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalibrationCompletionRecord, CalibrationPlacement, ProgressRow, ProgressionConfig } from "./types";
import { getBetaReleaseNumber, getProgressionVersion } from "./progression";

export async function completeCalibrationProgress(input: {
  supabase: SupabaseClient;
  progressionConfig: ProgressionConfig | null;
  placement: CalibrationPlacement;
  completion: CalibrationCompletionRecord;
  attemptPayload?: Record<string, unknown>;
  progressionVersion?: string;
  betaReleaseNumber?: number;
}): Promise<Partial<ProgressRow> | null> {
  const { data, error } = await input.supabase.rpc("complete_calibration", {
    p_progression_version: input.progressionVersion ?? getProgressionVersion(input.progressionConfig),
    p_beta_release_number: input.betaReleaseNumber ?? getBetaReleaseNumber(input.progressionConfig),
    p_placement: input.placement,
    p_calibration_version: input.completion.version,
    p_attempt_payload: input.attemptPayload ?? {},
    p_progression_config: input.progressionConfig ?? {}
  });

  if (error) throw error;
  return data as Partial<ProgressRow> | null;
}

export async function loadRemoteProgressRow(input: {
  supabase: SupabaseClient;
  userId: string;
  progressionConfig: ProgressionConfig | null;
  progressionVersion?: string;
  betaReleaseNumber?: number;
}): Promise<Partial<ProgressRow> | null> {
  const { data, error } = await input.supabase
    .from("user_progress")
    .select("xp, level, streak, cases_completed, correct_answers, total_answers, last_case_date, progression_version, beta_release_number, calibration_completed, calibration_placement, calibration_completed_at, placement_boost_completed_at, intermediate_unlocked_at, advanced_unlocked_at, master_unlocked_at, reset_at, updated_at")
    .eq("user_id", input.userId)
    .eq("progression_version", input.progressionVersion ?? getProgressionVersion(input.progressionConfig))
    .eq("beta_release_number", input.betaReleaseNumber ?? getBetaReleaseNumber(input.progressionConfig))
    .maybeSingle();

  if (error) throw error;
  return data as Partial<ProgressRow> | null;
}
