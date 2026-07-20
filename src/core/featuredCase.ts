import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeProtectedFunction, normalizeIssuedPracticeSlot, ProtectedPracticeError } from "./protectedPractice";
import { normalizeStructuredExplanation } from "./practice";
import type {
  AnswerSelection,
  CaseSummary,
  FeaturedCaseStatus,
  IssuedPracticeSlot,
  RuntimeConfig,
  StepResult
} from "./types";

export const FEATURED_CASE_DRAFT_STORAGE_KEY = "abgmaster_featuredCaseDraft";
export const FEATURED_CASE_DRAFT_VERSION = 2;

export interface FeaturedCaseDraft {
  version: typeof FEATURED_CASE_DRAFT_VERSION;
  userId: string | null;
  releaseId: string;
  caseToken: string;
  currentStepIndex: number;
  selectedAnswers: AnswerSelection[];
  stepResults: StepResult[];
  savedAt: string;
}

interface FeaturedPrepareResponse {
  releaseId: string;
  slot: {
    caseToken: string;
    issuedAt: string;
    expiresAt: string;
    contentVersion: string;
    difficultyKey: string;
    caseData: IssuedPracticeSlot["caseData"];
  };
}

interface FeaturedSubmitResponse {
  releaseId: string;
  summary: Omit<CaseSummary, "explanation" | "stepResults">;
  stepResults: StepResult[];
  explanation: CaseSummary["explanation"];
  attemptId?: string | null;
  canonicalAttemptId?: string | null;
  isCanonical?: boolean;
}

export async function loadFeaturedCaseStatus(
  config: RuntimeConfig,
  supabase: SupabaseClient
): Promise<FeaturedCaseStatus> {
  return invokeProtectedFunction<FeaturedCaseStatus>(config, supabase, "featured-case-status", {});
}

export async function prepareFeaturedCase(
  config: RuntimeConfig,
  supabase: SupabaseClient
): Promise<{ releaseId: string; slot: IssuedPracticeSlot }> {
  const response = await invokeProtectedFunction<FeaturedPrepareResponse>(
    config,
    supabase,
    "prepare-featured-case",
    {}
  );
  return {
    releaseId: response.releaseId,
    slot: normalizeIssuedPracticeSlot(
      response.slot.difficultyKey,
      response.slot.contentVersion,
      response.slot
    )
  };
}

export async function confirmFeaturedCaseOpen(
  supabase: SupabaseClient,
  caseToken: string
): Promise<void> {
  const { data, error } = await supabase.rpc("confirm_featured_case_open", {
    p_case_token: caseToken
  });
  if (error || data !== true) {
    throw new ProtectedPracticeError("The Featured Case opened, but its invitation status could not be saved.", {
      code: "FEATURED_OPEN_CONFIRM_FAILED",
      recoverable: true,
      status: 503
    });
  }
}

export async function submitFeaturedCase(
  config: RuntimeConfig,
  supabase: SupabaseClient,
  input: {
    caseToken: string;
    answers: Array<{ key: string; chosen: string | string[] }>;
    elapsedSeconds: number;
    clientCompletedAt: string;
  }
): Promise<{
  summary: CaseSummary;
  attemptId: string | null;
  canonicalAttemptId: string | null;
  isCanonical: boolean;
}> {
  const response = await invokeProtectedFunction<FeaturedSubmitResponse>(
    config,
    supabase,
    "submit-featured-case",
    input
  );
  return {
    summary: {
      ...response.summary,
      explanation: normalizeStructuredExplanation(response.explanation),
      stepResults: response.stepResults ?? []
    },
    attemptId: response.attemptId ?? null,
    canonicalAttemptId: response.canonicalAttemptId ?? null,
    isCanonical: Boolean(response.isCanonical)
  };
}

export function loadFeaturedCaseDraft(
  storage: Pick<Storage, "getItem">,
  expected: { userId: string | null; releaseId: string; caseToken: string }
): FeaturedCaseDraft | null {
  try {
    const parsed = JSON.parse(storage.getItem(FEATURED_CASE_DRAFT_STORAGE_KEY) ?? "null") as FeaturedCaseDraft | null;
    if (
      !parsed ||
      parsed.version !== FEATURED_CASE_DRAFT_VERSION ||
      parsed.userId !== expected.userId ||
      parsed.releaseId !== expected.releaseId ||
      parsed.caseToken !== expected.caseToken ||
      !Array.isArray(parsed.selectedAnswers) ||
      !Array.isArray(parsed.stepResults)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFeaturedCaseDraft(
  storage: Pick<Storage, "setItem">,
  draft: FeaturedCaseDraft
): void {
  storage.setItem(FEATURED_CASE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearFeaturedCaseDraft(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(FEATURED_CASE_DRAFT_STORAGE_KEY);
}
