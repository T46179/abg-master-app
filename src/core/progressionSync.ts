import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalibrationCompletionRecord, CalibrationPlacement, ProgressRow, ProgressionConfig } from "./types";
import { getBetaReleaseNumber, getProgressionVersion } from "./progression";

export async function completeCalibrationProgress(input: {
  supabase: SupabaseClient;
  progressionConfig: ProgressionConfig | null;
  placement: CalibrationPlacement;
  completion: CalibrationCompletionRecord;
  attemptPayload?: Record<string, unknown>;
}): Promise<Partial<ProgressRow> | null> {
  const { data, error } = await input.supabase.rpc("complete_calibration", {
    p_progression_version: getProgressionVersion(input.progressionConfig),
    p_beta_release_number: getBetaReleaseNumber(input.progressionConfig),
    p_placement: input.placement,
    p_calibration_version: input.completion.version,
    p_attempt_payload: input.attemptPayload ?? {},
    p_progression_config: input.progressionConfig ?? {}
  });

  if (error) throw error;
  return data as Partial<ProgressRow> | null;
}
