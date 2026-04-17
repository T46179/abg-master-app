import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { captureFunctionException, initFunctionMonitoring } from "../_shared/sentry.ts";
import { ISSUED_CASE_TTL_HOURS, PREPARE_RATE_LIMIT_MAX_REQUESTS } from "../_shared/constants.ts";
import {
  buildIssuedSlot,
  chooseCaseForDifficulty,
  errorResponse,
  expiresAtIso,
  jsonResponse,
  normalizeDifficultyKey,
  normalizeRecentArchetypes,
  normalizeSeenCaseHints,
  prepareThrottleMessage,
  windowStartIso
} from "../_shared/practice.ts";
import type { IssuedCaseSessionRow, PublishedCaseRow } from "../_shared/types.ts";

const FUNCTION_NAME = "prepare-practice-cases";

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
      contentVersion?: string | null;
      difficulties?: string[];
      selectionHints?: {
        seenCaseIdsByDifficulty?: Record<string, string[]>;
        recentArchetypes?: string[];
      };
    };

    const difficulties = Array.isArray(body.difficulties)
      ? body.difficulties.map(normalizeDifficultyKey).filter(Boolean)
      : [];
    if (!difficulties.length) {
      return errorResponse("CASE_SLOT_UNAVAILABLE", "No difficulties were requested.", { recoverable: true, status: 400 });
    }

    const seenCaseIdsByDifficulty = normalizeSeenCaseHints(body.selectionHints?.seenCaseIdsByDifficulty);
    const recentArchetypes = normalizeRecentArchetypes(body.selectionHints?.recentArchetypes);

    const { data: latestContentRows, error: latestContentError } = await adminClient
      .from("published_cases")
      .select("content_version")
      .order("published_at", { ascending: false })
      .limit(1);

    if (latestContentError) throw latestContentError;
    const contentVersion = String(latestContentRows?.[0]?.content_version ?? body.contentVersion ?? "").trim();
    if (!contentVersion) {
      return errorResponse("CASE_SLOT_UNAVAILABLE", "No published protected cases are available.", { recoverable: true, status: 503 });
    }

    await adminClient
      .from("issued_case_sessions")
      .update({ status: "superseded" })
      .eq("user_id", user.id)
      .eq("status", "issued")
      .neq("content_version", contentVersion);

    await adminClient
      .from("issued_case_sessions")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("status", "issued")
      .lt("expires_at", new Date().toISOString());

    const { count: recentPrepareCount, error: prepareCountError } = await adminClient
      .from("practice_prepare_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("requested_at", windowStartIso());

    if (prepareCountError) throw prepareCountError;
    if ((recentPrepareCount ?? 0) >= PREPARE_RATE_LIMIT_MAX_REQUESTS) {
      return errorResponse("CASE_SLOT_THROTTLED", prepareThrottleMessage(), { recoverable: true, status: 429 });
    }

    const { error: prepareEventError } = await adminClient
      .from("practice_prepare_events")
      .insert({ user_id: user.id });
    if (prepareEventError) throw prepareEventError;

    const slots: Record<string, ReturnType<typeof buildIssuedSlot>> = {};

    for (const difficultyKey of difficulties) {
      const { data: activeSessionRows, error: activeSessionError } = await adminClient
        .from("issued_case_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("content_version", contentVersion)
        .eq("difficulty_label", difficultyKey)
        .eq("status", "issued")
        .gt("expires_at", new Date().toISOString())
        .order("issued_at", { ascending: false })
        .limit(1);
      if (activeSessionError) throw activeSessionError;

      const activeSession = (activeSessionRows?.[0] ?? null) as IssuedCaseSessionRow | null;
      if (activeSession) {
        const { data: publishedRows, error: publishedError } = await adminClient
          .from("published_cases")
          .select("*")
          .eq("content_version", activeSession.content_version)
          .eq("case_id", activeSession.case_id)
          .limit(1);
        if (publishedError) throw publishedError;
        const publishedCase = (publishedRows?.[0] ?? null) as PublishedCaseRow | null;
        if (publishedCase) {
          slots[difficultyKey] = buildIssuedSlot(activeSession, publishedCase.public_payload);
          continue;
        }
      }

      const { data: candidateRows, error: candidateError } = await adminClient
        .from("published_cases")
        .select("*")
        .eq("content_version", contentVersion)
        .eq("difficulty_label", difficultyKey);
      if (candidateError) throw candidateError;

      const publishedCase = chooseCaseForDifficulty({
        cases: (candidateRows ?? []) as PublishedCaseRow[],
        difficultyKey,
        seenCaseIdsByDifficulty,
        recentArchetypes
      });
      if (!publishedCase) continue;

      const insertPayload = {
        user_id: user.id,
        content_version: contentVersion,
        case_id: publishedCase.case_id,
        difficulty_label: difficultyKey,
        difficulty_level: Number(publishedCase.difficulty_level ?? 1),
        status: "issued",
        expires_at: expiresAtIso()
      };

const { data: insertedRows, error: insertError } = await adminClient
  .from("issued_case_sessions")
  .insert(insertPayload)
  .select("*")
  .limit(1);

if (insertError) {
  const isDuplicateActiveSlot = String((insertError as { code?: string }).code ?? "") === "23505";

  if (!isDuplicateActiveSlot) {
    throw insertError;
  }

  const { data: existingRows, error: existingError } = await adminClient
    .from("issued_case_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("content_version", contentVersion)
    .eq("difficulty_label", difficultyKey)
    .eq("status", "issued")
    .gt("expires_at", new Date().toISOString())
    .order("issued_at", { ascending: false })
    .limit(1);

  if (existingError) throw existingError;

  const existingSession = (existingRows?.[0] ?? null) as IssuedCaseSessionRow | null;
  if (!existingSession) throw insertError;

  slots[difficultyKey] = buildIssuedSlot(existingSession, publishedCase.public_payload);
  continue;
}

const insertedSession = (insertedRows?.[0] ?? null) as IssuedCaseSessionRow | null;
if (!insertedSession) continue;
slots[difficultyKey] = buildIssuedSlot(insertedSession, publishedCase.public_payload);

    }

    return jsonResponse(
      {
        contentVersion,
        slots
      },
      {
        headers: corsHeaders
      }
    );
  } catch (error) {
    console.error(error);
    await captureFunctionException(FUNCTION_NAME, error, req);
    return errorResponse("CASE_SLOT_UNAVAILABLE", "Protected practice slots could not be prepared.", {
      recoverable: true,
      status: 500
    });
  }
});
