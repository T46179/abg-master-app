import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { captureFunctionException, initFunctionMonitoring } from "../_shared/sentry.ts";
import { composeStructuredExplanation } from "../_shared/explanations.ts";
import {
  buildIssuedSlot,
  buildSummary,
  chooseCaseForDifficulty,
  errorResponse,
  expiresAtIso,
  gradeAnswers,
  jsonResponse,
  normalizeRecentArchetypes,
  normalizeSeenCaseHints
} from "../_shared/practice.ts";
import type { IssuedCaseSessionRow, PublishedCaseRow } from "../_shared/types.ts";

const FUNCTION_NAME = "submit-practice-case";

initFunctionMonitoring(FUNCTION_NAME);

function createUserClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? ""
        }
      }
    }
  );
}

function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userClient = createUserClient(req);
    const adminClient = createAdminClient();
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const {
      data: { user }
    } = await userClient.auth.getUser(token);

    if (!user?.id) {
      return errorResponse("AUTH_REQUIRED", "A verified Supabase JWT is required.", { recoverable: true, status: 401 });
    }

    const body = await req.json().catch(() => ({})) as {
      caseToken?: string;
      answers?: Array<{ key: string; chosen: string }>;
      elapsedSeconds?: number;
      timedMode?: boolean;
      clientCompletedAt?: string;
    };

    const caseToken = String(body.caseToken ?? "").trim();
    if (!caseToken) {
      return errorResponse("CASE_SLOT_UNAVAILABLE", "Missing case token.", { recoverable: true, status: 400 });
    }

    const { data: sessionRows, error: sessionError } = await adminClient
      .from("issued_case_sessions")
      .select("*")
      .eq("case_token", caseToken)
      .eq("user_id", user.id)
      .limit(1);
    if (sessionError) throw sessionError;

    const session = (sessionRows?.[0] ?? null) as IssuedCaseSessionRow | null;
    if (!session) {
      return errorResponse("CASE_SLOT_UNAVAILABLE", "That case token is not valid for this user.", { recoverable: true, status: 404 });
    }

    if (session.status === "completed" && session.graded_response) {
      return jsonResponse(session.graded_response as Record<string, unknown>, {
        headers: corsHeaders
      });
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await adminClient
        .from("issued_case_sessions")
        .update({ status: "expired" })
        .eq("case_token", caseToken)
        .eq("status", "issued");
      return errorResponse("CASE_TOKEN_EXPIRED", "This issued case has expired. Request a fresh case and try again.", {
        recoverable: true,
        status: 409
      });
    }

    const { data: publishedRows, error: publishedError } = await adminClient
      .from("published_cases")
      .select("*")
      .eq("content_version", session.content_version)
      .eq("case_id", session.case_id)
      .limit(1);
    if (publishedError) throw publishedError;

    const publishedCase = (publishedRows?.[0] ?? null) as PublishedCaseRow | null;
    if (!publishedCase) {
      return errorResponse("CASE_SLOT_UNAVAILABLE", "Published case content could not be found.", { recoverable: true, status: 404 });
    }

    const answerKey = publishedCase.grading_payload?.answer_key ?? {};
    const progressionConfig = (publishedCase.grading_payload?.progression_config ?? {}) as Record<string, unknown>;
    const grading = gradeAnswers({
      publicPayload: publishedCase.public_payload,
      answerKey,
      answers: Array.isArray(body.answers) ? body.answers : []
    });
    const structuredExplanation = composeStructuredExplanation({
      publicPayload: {
        ...publishedCase.public_payload,
        answer_key: answerKey
      },
      explanationBlueprint: publishedCase.grading_payload?.explanation_blueprint ?? [],
      stepResults: grading.stepResults
    });
    const summary = buildSummary({
      session,
      publicPayload: publishedCase.public_payload,
      structuredExplanation,
      progressionConfig,
      stepResults: grading.stepResults,
      totalSteps: grading.totalSteps,
      correctSteps: grading.correctSteps,
      accuracy: grading.accuracy,
      elapsedSeconds: Math.max(0, Number(body.elapsedSeconds ?? 0)),
      timedMode: Boolean(body.timedMode)
    });

    const { data: replacementRows, error: replacementCaseError } = await adminClient
      .from("published_cases")
      .select("*")
      .eq("content_version", session.content_version)
      .eq("difficulty_label", session.difficulty_label);
    if (replacementCaseError) throw replacementCaseError;

    const replacementCase = chooseCaseForDifficulty({
      cases: (replacementRows ?? []) as PublishedCaseRow[],
      difficultyKey: session.difficulty_label,
      seenCaseIdsByDifficulty: normalizeSeenCaseHints({}),
      recentArchetypes: normalizeRecentArchetypes([])
    });
    if (!replacementCase) {
      return errorResponse("CASE_SLOT_UNAVAILABLE", "No replacement slot could be issued.", { recoverable: true, status: 503 });
    }

    const replacementIssuedAt = new Date().toISOString();
    const replacementExpiresAt = expiresAtIso(new Date(replacementIssuedAt));
    const replacementToken = crypto.randomUUID();
    const replacementSlot = {
      caseToken: replacementToken,
      issuedAt: replacementIssuedAt,
      expiresAt: replacementExpiresAt,
      contentVersion: session.content_version,
      difficultyKey: session.difficulty_label,
      caseData: replacementCase.public_payload
    };

    const gradedResponse = {
      summary,
      stepResults: grading.stepResults,
      explanation: structuredExplanation,
      replacementSlot
    };

    const { error: updateSessionError } = await adminClient
      .from("issued_case_sessions")
      .update({
        status: "completed",
        completed_at: body.clientCompletedAt ?? new Date().toISOString(),
        submitted_answers: body.answers ?? [],
        graded_response: gradedResponse
      })
      .eq("case_token", caseToken)
      .eq("status", "issued");
    if (updateSessionError) throw updateSessionError;

    const { error: attemptError } = await adminClient
      .from("attempts")
      .insert({
        user_id: user.id,
        case_id: session.case_id,
        archetype: publishedCase.archetype,
        difficulty_label: session.difficulty_label,
        difficulty_level: session.difficulty_level,
        xp_total_awarded: summary.totalXpAward,
        correct_steps: grading.correctSteps,
        total_steps: grading.totalSteps,
        elapsed_seconds: Math.max(0, Math.round(Number(body.elapsedSeconds ?? 0))),
        completed_at: body.clientCompletedAt ?? new Date().toISOString(),
        final_diagnosis_correct: Boolean(grading.stepResults.find(step => step.key === "final_diagnosis")?.correct),
        accuracy_percent: grading.accuracy,
        step_results_json: grading.stepResults.map(step => (
          step.correct
            ? { key: step.key, correct: true }
            : { key: step.key, correct: false, chosen: step.chosen, correct_answer: step.correctAnswer }
        )),
        app_version: null,
        content_version: session.content_version,
        mode: "practice"
      });
    if (attemptError) throw attemptError;

    const { error: replacementInsertError } = await adminClient
      .from("issued_case_sessions")
      .insert({
        case_token: replacementToken,
        user_id: user.id,
        content_version: session.content_version,
        case_id: replacementCase.case_id,
        difficulty_label: session.difficulty_label,
        difficulty_level: Number(replacementCase.difficulty_level ?? session.difficulty_level ?? 1),
        status: "issued",
        issued_at: replacementIssuedAt,
        expires_at: replacementExpiresAt
      })
      .select("*")
      .limit(1);
    if (replacementInsertError) throw replacementInsertError;

    return jsonResponse(gradedResponse, {
      headers: corsHeaders
    });
  } catch (error) {
    console.error(error);
    await captureFunctionException(FUNCTION_NAME, error, req);
    return errorResponse("CASE_SUBMIT_FAILED", "Protected practice grading failed.", {
      recoverable: true,
      status: 500
    });
  }
});
