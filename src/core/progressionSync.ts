import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalibrationCompletionRecord, CalibrationPlacement, CalibrationRecommendation, ProgressRow, ProgressionConfig } from "./types";
import { getBetaReleaseNumber, getProgressionVersion } from "./progression";

function withRecommendation(progress: Partial<ProgressRow> | null, recommendation: unknown, version: number) {
  if (!progress?.calibration_completed || version < 3
    || !["beginner", "intermediate", "advanced", "master"].includes(String(recommendation))
    || progress.calibration_placement !== (recommendation === "master" ? "advanced" : recommendation)) return progress;
  return { ...progress, calibration_recommendation: recommendation as CalibrationRecommendation, calibration_version: version };
}

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
    p_attempt_payload: {
      ...input.attemptPayload,
      ...(input.completion.version >= 3 ? {
        recommendation: input.completion.recommendation ?? input.placement,
        scoring_version: input.completion.version
      } : {})
    },
    p_progression_config: input.progressionConfig ?? {}
  });

  if (error) throw error;
  return withRecommendation(data as Partial<ProgressRow> | null, input.completion.recommendation, input.completion.version);
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
  const progress = data as Partial<ProgressRow> | null;
  if (!progress?.calibration_completed) return progress;
  // Recommendation metadata lives in the existing attempt JSON, separately from
  // the legacy progression placement. Never expand earned Master access here.
  let attempts = input.supabase.from("calibration_attempts")
    .select("placement, calibration_version, attempt_payload")
    .eq("user_id", input.userId)
    .eq("progression_version", input.progressionVersion ?? getProgressionVersion(input.progressionConfig))
    .eq("beta_release_number", input.betaReleaseNumber ?? getBetaReleaseNumber(input.progressionConfig))
    .gte("calibration_version", 3);
  if (progress.reset_at) attempts = attempts.gt("completed_at", progress.reset_at);
  const { data: attempt, error: attemptError } = await attempts.order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (attemptError) throw attemptError;
  return attempt && attempt.placement === progress.calibration_placement
    ? withRecommendation(progress, attempt.attempt_payload?.recommendation, Number(attempt.calibration_version))
    : progress;
}
