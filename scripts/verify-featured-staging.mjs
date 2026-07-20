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

function assertComparison(comparison, expectedScore) {
  assert(comparison && typeof comparison === "object", "Featured comparison was not returned.");
  assert(
    ["available", "first_person"].includes(comparison.status),
    "Featured comparison returned an invalid status."
  );
  assert(comparison.canonicalScore === expectedScore, "Featured comparison used the wrong canonical score.");
  assert(Number.isInteger(comparison.cohortSize) && comparison.cohortSize >= 1, "Featured comparison returned an invalid cohort size.");
  assert(comparison.isTopScore === true, "A perfect canonical score was not identified as a top score.");
  if (comparison.status === "first_person") {
    assert(comparison.cohortSize === 1, "First-person comparison returned a cohort larger than one.");
    assert(comparison.percentileBand === null, "First-person comparison returned a percentile band.");
  } else {
    assert(
      Number.isInteger(comparison.percentileBand) &&
        comparison.percentileBand >= 0 &&
        comparison.percentileBand <= 100 &&
        comparison.percentileBand % 5 === 0,
      "Featured comparison returned an invalid percentile band."
    );
  }
  assert(
    Object.keys(comparison).sort().join(",") ===
      ["canonicalScore", "cohortSize", "isTopScore", "percentileBand", "status"].sort().join(","),
    "Featured comparison exposed data beyond the approved aggregate."
  );
}

function buildPerfectAnswers(caseData) {
  return caseData.questions_flow.map(step => {
    const chosen = step.key === "anion_gap"
      ? caseData.answer_key.anion_gap_category
      : caseData.answer_key[step.key];
    assert(chosen != null, `Featured answer key is missing a scored answer for ${step.key}.`);
    return { key: step.key, chosen };
  });
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
  assert(typeof statusBefore.releaseId === "string" && statusBefore.releaseId.length > 0, "No active Featured release was returned.");
  assert(statusBefore.state === "available", "Fresh verifier should see the Featured Case as available.");
  assert(statusBefore.comparison === null, "An incomplete Featured Case returned a comparison.");

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
  assert(prepared.releaseId === statusBefore.releaseId, "Featured prepare returned a different release.");
  assert(typeof prepared.slot?.caseData?.case_id === "string", "Featured prepare did not return an authored case.");
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

  const answers = buildPerfectAnswers(prepared.slot.caseData);
  const firstCompletion = await invoke("submit-featured-case", {
    caseToken: prepared.slot.caseToken,
    answers,
    elapsedSeconds: 30,
    clientCompletedAt: new Date().toISOString()
  });
  assert(firstCompletion.summary.totalXpAward === 0, "Featured completion awarded XP.");
  assert(firstCompletion.isCanonical === true, "First Featured completion was not canonical.");
  assert(firstCompletion.summary.accuracy === 100, "Staging verifier did not submit a perfect Featured attempt.");
  assertComparison(firstCompletion.comparison, 100);
  assert(
    firstCompletion.stepResults?.find(result => result.key === "ph_status")?.correct === true,
    "Server grading disagreed with the issued pH answer key."
  );
  assert(!("progress" in firstCompletion), "Featured completion returned normal progression.");
  assert(!("replacementSlot" in firstCompletion), "Featured completion issued a normal replacement slot.");

  const repeatedCompletion = await invoke("submit-featured-case", {
    caseToken: prepared.slot.caseToken,
    answers,
    elapsedSeconds: 30,
    clientCompletedAt: new Date().toISOString()
  });
  assert(repeatedCompletion.attemptId === firstCompletion.attemptId, "Repeated submission created a different attempt.");
  assert(
    repeatedCompletion.canonicalAttemptId === firstCompletion.canonicalAttemptId,
    "Repeated submission returned a different canonical attempt."
  );
  assertComparison(repeatedCompletion.comparison, 100);

  const completedStatus = await invoke("featured-case-status");
  assert(completedStatus.state === "completed", "Completed Featured Case was not reflected on the dashboard.");
  assertComparison(completedStatus.comparison, 100);

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
  assert(statusAfterReset.comparison === null, "Reset retained the previous Featured comparison.");

  const preparedAfterReset = await invoke("prepare-featured-case");
  const secondAnswers = buildPerfectAnswers(preparedAfterReset.slot.caseData);
  const secondCompletion = await invoke("submit-featured-case", {
    caseToken: preparedAfterReset.slot.caseToken,
    answers: secondAnswers,
    elapsedSeconds: 30,
    clientCompletedAt: new Date().toISOString()
  });
  assert(secondCompletion.isCanonical === true, "First post-reset completion was not the new canonical attempt.");
  assertComparison(secondCompletion.comparison, 100);

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
