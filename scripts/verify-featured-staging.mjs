import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const STAGING_PROJECT_REF = "clpfecuohwzwrgmqzeos";
const envPath = path.resolve(".env.local");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#") && line.includes("="))
    .map(line => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    })
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl?.includes(STAGING_PROJECT_REF)) {
  throw new Error(`Refusing server verification: active URL is not Staging (${STAGING_PROJECT_REF}).`);
}
if (!supabaseAnonKey) throw new Error("VITE_SUPABASE_ANON_KEY is required.");

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function invoke(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const context = error.context;
    const detail = context && typeof context.json === "function"
      ? await context.json().catch(() => null)
      : null;
    throw new Error(`${name} failed: ${JSON.stringify(detail ?? error.message)}`);
  }
  return data;
}

const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
if (authError || !authData.user) throw authError ?? new Error("Anonymous Staging auth failed.");

try {
  const statusBefore = await invoke("featured-case-status");
  assert(statusBefore.releaseId === "featured-authored-001-r1", "Unexpected active Featured release.");
  assert(statusBefore.state === "available", "Fresh verifier should see the Featured Case as available.");

  const { data: metricBefore, error: metricBeforeError } = await supabase
    .from("public_site_metrics")
    .select("metric_value")
    .eq("metric_key", "cases_solved")
    .single();
  if (metricBeforeError) throw metricBeforeError;

  const { data: progressBefore, error: progressBeforeError } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (progressBeforeError) throw progressBeforeError;

  const prepared = await invoke("prepare-featured-case");
  assert(prepared.slot?.caseData?.case_id === "AUTHORED_001", "Featured prepare returned the wrong authored case.");
  assert(
    prepared.slot.caseData.protected_payload_mode === "practice_learning",
    "Featured prepare did not return a practice-learning payload."
  );
  assert(
    prepared.slot.caseData.answer_key?.ph_status === "Acidaemia",
    "Featured prepare did not return the issued case answer key."
  );
  const preparedStepFeedback = prepared.slot.caseData.step_feedback;
  assert(
    preparedStepFeedback == null ||
      (typeof preparedStepFeedback === "object" && !Array.isArray(preparedStepFeedback)),
    "Featured prepare returned malformed step feedback."
  );
  if (Number(prepared.slot.caseData.difficulty_level ?? 1) <= 3) {
    assert(
      Object.keys(preparedStepFeedback ?? {}).length > 0,
      "A lower-level Featured payload did not include its normal inline step feedback."
    );
  }
  assert(
    !("slots" in prepared) && !("cases" in prepared),
    "Featured prepare returned more than the single issued case."
  );

  const { data: confirmed, error: confirmError } = await supabase.rpc("confirm_featured_case_open", {
    p_case_token: prepared.slot.caseToken
  });
  if (confirmError) throw confirmError;
  assert(confirmed === true, "Featured open confirmation was not persisted.");

  const answers = prepared.slot.caseData.questions_flow.map(step => ({
    key: step.key,
    chosen: step.selection_mode === "multi" ? [step.options[0]] : step.options[0]
  }));
  const firstCompletion = await invoke("submit-featured-case", {
    caseToken: prepared.slot.caseToken,
    answers,
    elapsedSeconds: 30,
    clientCompletedAt: new Date().toISOString()
  });
  assert(firstCompletion.summary.totalXpAward === 0, "Featured completion awarded XP.");
  assert(firstCompletion.isCanonical === true, "First Featured completion was not canonical.");
  assert(
    firstCompletion.stepResults?.find(result => result.key === "ph_status")?.correct === true,
    "Server grading disagreed with the issued pH answer key."
  );
  assert(!("progress" in firstCompletion), "Featured completion returned normal progression.");
  assert(!("replacementSlot" in firstCompletion), "Featured completion issued a normal replacement slot.");

  const { data: progressAfter, error: progressAfterError } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (progressAfterError) throw progressAfterError;
  assert(JSON.stringify(progressAfter) === JSON.stringify(progressBefore), "Featured completion mutated normal progress.");

  const { data: firstAttempts, error: firstAttemptsError } = await supabase
    .from("attempts")
    .select("case_token, mode, featured_release_id, reset_generation, xp_total_awarded")
    .eq("user_id", authData.user.id)
    .eq("mode", "featured");
  if (firstAttemptsError) throw firstAttemptsError;
  assert(firstAttempts?.length === 1, "First Featured attempt was not retained exactly once.");
  assert(firstAttempts[0].xp_total_awarded === 0, "Persisted Featured attempt awarded XP.");

  const { data: metricAfter, error: metricAfterError } = await supabase
    .from("public_site_metrics")
    .select("metric_value")
    .eq("metric_key", "cases_solved")
    .single();
  if (metricAfterError) throw metricAfterError;
  assert(metricAfter.metric_value === metricBefore.metric_value, "Featured attempt inflated the public case count.");

  const { error: resetError } = await supabase.rpc("reset_progress", {
    p_progression_version: "v2",
    p_beta_release_number: 2
  });
  if (resetError) throw resetError;

  const statusAfterReset = await invoke("featured-case-status");
  assert(statusAfterReset.state === "available", "Reset did not make the current Featured Case available again.");
  assert(statusAfterReset.opened === false, "Reset retained the old Featured open state.");

  const preparedAfterReset = await invoke("prepare-featured-case");
  const secondAnswers = preparedAfterReset.slot.caseData.questions_flow.map(step => ({
    key: step.key,
    chosen: step.selection_mode === "multi" ? [step.options[0]] : step.options[0]
  }));
  const secondCompletion = await invoke("submit-featured-case", {
    caseToken: preparedAfterReset.slot.caseToken,
    answers: secondAnswers,
    elapsedSeconds: 30,
    clientCompletedAt: new Date().toISOString()
  });
  assert(secondCompletion.isCanonical === true, "First post-reset completion was not the new canonical attempt.");

  const { data: attemptsAfterReset, error: attemptsAfterResetError } = await supabase
    .from("attempts")
    .select("reset_generation")
    .eq("user_id", authData.user.id)
    .eq("mode", "featured")
    .order("reset_generation", { ascending: true });
  if (attemptsAfterResetError) throw attemptsAfterResetError;
  assert(
    attemptsAfterReset?.length === 2 &&
      attemptsAfterReset[0].reset_generation === 0 &&
      attemptsAfterReset[1].reset_generation === 1,
    "Reset generations did not preserve old history and start a new canonical period."
  );

  const { data: metricAfterReset, error: metricAfterResetError } = await supabase
    .from("public_site_metrics")
    .select("metric_value")
    .eq("metric_key", "cases_solved")
    .single();
  if (metricAfterResetError) throw metricAfterResetError;
  assert(
    metricAfterReset.metric_value === metricBefore.metric_value,
    "Post-reset Featured attempt inflated the public case count."
  );

  console.log("Featured Case Staging server verification passed.");
} finally {
  await supabase.auth.signOut();
}
