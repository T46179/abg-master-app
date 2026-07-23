import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeProtectedFunction, normalizeIssuedPracticeSlot, ProtectedPracticeError } from "./protectedPractice";
import { normalizeStructuredExplanation } from "./practice";
import {
  createFeaturedCaseAnalyticsContext,
  type FeaturedCaseAnalyticsContext,
  type FeaturedCaseEntryAction,
  type FeaturedCaseEntrySource
} from "./featuredCaseAnalytics";
import type {
  AnswerSelection,
  CaseSummary,
  FeaturedCaseComparison,
  FeaturedCaseStatus,
  IssuedPracticeSlot,
  RuntimeConfig,
  StepResult
} from "./types";

export const FEATURED_CASE_DRAFT_STORAGE_KEY = "abgmaster_featuredCaseDraft";
export const FEATURED_CASE_INTRO_SEEN_STORAGE_KEY = "abgmaster_featuredCaseIntroSeen";
export const FEATURED_CASE_INVITATION_DISMISSAL_STORAGE_KEY = "abgmaster_featuredCaseInvitationDismissal";
export const FEATURED_CASE_DRAFT_VERSION = 2;
const FEATURED_CASE_INVITATION_DISMISSAL_VERSION = 1;

export interface FeaturedCaseDraft {
  version: typeof FEATURED_CASE_DRAFT_VERSION;
  userId: string | null;
  releaseId: string;
  caseToken: string;
  currentStepIndex: number;
  selectedAnswers: AnswerSelection[];
  stepResults: StepResult[];
  savedAt: string;
  analytics?: FeaturedCaseAnalyticsContext;
}

interface FeaturedCaseInvitationDismissal {
  version: typeof FEATURED_CASE_INVITATION_DISMISSAL_VERSION;
  userId: string | null;
  releaseId: string;
}

const FEATURED_ANALYTICS_CONTEXT_LOCK = "abgmaster-featured-analytics-context";

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
  comparison?: FeaturedCaseComparison | null;
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
  comparison: FeaturedCaseComparison | null;
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
    isCanonical: Boolean(response.isCanonical),
    comparison: response.comparison ?? null
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

export async function ensureFeaturedCaseAnalyticsContext(
  storage: Pick<Storage, "getItem" | "setItem">,
  expected: { userId: string | null; releaseId: string; caseToken: string },
  input: {
    entrySource: FeaturedCaseEntrySource;
    action: FeaturedCaseEntryAction;
    isReplay: boolean;
    introShown: boolean;
  },
  fallbackDraft: FeaturedCaseDraft
): Promise<FeaturedCaseDraft> {
  const initialize = () => {
    const currentDraft = loadFeaturedCaseDraft(storage, expected) ?? fallbackDraft;
    if (currentDraft.analytics) return currentDraft;

    const analytics = createFeaturedCaseAnalyticsContext({
      ...input,
      alreadyEngaged: currentDraft.selectedAnswers.length > 0 || currentDraft.stepResults.length > 0
    });
    const nextDraft = { ...currentDraft, analytics };
    saveFeaturedCaseDraft(storage, nextDraft);
    return nextDraft;
  };

  const lockManager = typeof navigator === "undefined"
    ? null
    : (navigator as Navigator & {
        locks?: {
          request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
        };
      }).locks;

  if (lockManager) {
    return lockManager.request(FEATURED_ANALYTICS_CONTEXT_LOCK, initialize);
  }

  const candidate = initialize();
  await Promise.resolve();
  return loadFeaturedCaseDraft(storage, expected) ?? candidate;
}

export function clearFeaturedCaseDraft(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(FEATURED_CASE_DRAFT_STORAGE_KEY);
}

export function loadFeaturedCaseIntroSeen(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(FEATURED_CASE_INTRO_SEEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveFeaturedCaseIntroSeen(storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(FEATURED_CASE_INTRO_SEEN_STORAGE_KEY, "true");
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}

export function isFeaturedCaseInvitationDismissed(
  storage: Pick<Storage, "getItem">,
  expected: { userId: string | null; releaseId: string }
): boolean {
  try {
    const parsed = JSON.parse(
      storage.getItem(FEATURED_CASE_INVITATION_DISMISSAL_STORAGE_KEY) ?? "null"
    ) as FeaturedCaseInvitationDismissal | null;
    return Boolean(
      parsed
      && parsed.version === FEATURED_CASE_INVITATION_DISMISSAL_VERSION
      && parsed.userId === expected.userId
      && parsed.releaseId === expected.releaseId
    );
  } catch {
    return false;
  }
}

export function saveFeaturedCaseInvitationDismissal(
  storage: Pick<Storage, "setItem">,
  dismissal: { userId: string | null; releaseId: string }
): void {
  try {
    storage.setItem(
      FEATURED_CASE_INVITATION_DISMISSAL_STORAGE_KEY,
      JSON.stringify({
        version: FEATURED_CASE_INVITATION_DISMISSAL_VERSION,
        userId: dismissal.userId,
        releaseId: dismissal.releaseId
      } satisfies FeaturedCaseInvitationDismissal)
    );
  } catch {
    // The invitation still dismisses for the current mounted session.
  }
}
