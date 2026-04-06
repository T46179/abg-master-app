import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateBadges, normalizeStructuredExplanation, updateDailyStreak } from "./practice";
import { getAwardableXp, syncUserStateDerivedFields } from "./progression";
import type {
  CaseSummary,
  IssuedPracticeSlot,
  PendingPracticeSubmission,
  ProgressionConfig,
  ProtectedPracticeErrorResponse,
  ProtectedPracticePrepareRequest,
  ProtectedPracticePrepareResponse,
  ProtectedPracticeSubmitRequest,
  ProtectedPracticeSubmitResponse,
  RuntimeConfig,
  StructuredExplanation,
  UserState
} from "./types";

export const ISSUED_CASE_TTL_HOURS = 24;
export const PREPARE_RATE_LIMIT_WINDOW_SECONDS = 60;
export const PREPARE_RATE_LIMIT_MAX_REQUESTS = 8;
export const COMPLETED_SESSION_RETENTION_DAYS = 14;
const APPLIED_TOKEN_LIMIT = 64;

export class ProtectedPracticeError extends Error {
  code: string;
  recoverable: boolean;
  status: number;

  constructor(message: string, options?: { code?: string; recoverable?: boolean; status?: number }) {
    super(message);
    this.name = "ProtectedPracticeError";
    this.code = options?.code ?? "PROTECTED_PRACTICE_ERROR";
    this.recoverable = Boolean(options?.recoverable);
    this.status = Number(options?.status ?? 500);
  }
}

export function isProtectedPracticeError(error: unknown): error is ProtectedPracticeError {
  return error instanceof ProtectedPracticeError;
}

function normalizeProtectedPracticeError(payload: unknown, status: number): ProtectedPracticeError {
  const typedPayload = (payload && typeof payload === "object" ? payload : {}) as ProtectedPracticeErrorResponse;
  return new ProtectedPracticeError(
    typedPayload.message ??
      ({
        401: "We couldn’t verify your session. Please refresh and try again.",
        409: "This case is no longer available. Please start a new one.",
        429: "You’re going too fast. Please wait a moment and try again.",
        500: "Something went wrong on our end. Please try again."
      }[status] ?? `Protected practice request failed (${status}).`),
    {
      code: typedPayload.code ?? "PROTECTED_PRACTICE_ERROR",
      recoverable: Boolean(typedPayload.recoverable),
      status
    }
  );
}

async function getAccessToken(supabase: SupabaseClient): Promise<string> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new ProtectedPracticeError("Please reload the app to continue.", {
      code: "AUTH_REQUIRED",
      recoverable: true,
      status: 401
    });
  }

  return accessToken;
}

async function invokeProtectedFunction<TResponse>(
  config: RuntimeConfig,
  supabase: SupabaseClient,
  functionName: string,
  body: Record<string, unknown>
): Promise<TResponse> {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    throw new ProtectedPracticeError("Something isn’t set up correctly. Please refresh the app.", {
      code: "SUPABASE_CONFIG_MISSING",
      recoverable: true,
      status: 503
    });
  }

  const accessToken = await getAccessToken(supabase);
  const response = await fetch(`${String(config.SUPABASE_URL).replace(/\/+$/, "")}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: String(config.SUPABASE_ANON_KEY),
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw normalizeProtectedPracticeError(responseBody, response.status);
  }

  return responseBody as TResponse;
}

export function normalizeIssuedPracticeSlot(
  difficultyKey: string,
  contentVersion: string,
  slot: ProtectedPracticePrepareResponse["slots"][string] | ProtectedPracticeSubmitResponse["replacementSlot"]
): IssuedPracticeSlot {
  return {
    caseToken: String(slot.caseToken ?? ""),
    issuedAt: String(slot.issuedAt ?? ""),
    expiresAt: String(slot.expiresAt ?? ""),
    contentVersion: String(slot.contentVersion ?? contentVersion),
    difficultyKey: String(slot.difficultyKey ?? difficultyKey),
    caseData: slot.caseData
  };
}

export async function prepareProtectedPracticeCases(
  config: RuntimeConfig,
  supabase: SupabaseClient,
  request: ProtectedPracticePrepareRequest
): Promise<{ contentVersion: string; slots: Record<string, IssuedPracticeSlot> }> {
  const response = await invokeProtectedFunction<ProtectedPracticePrepareResponse>(
    config,
    supabase,
    "prepare-practice-cases",
    request as unknown as Record<string, unknown>
  );

  return {
    contentVersion: response.contentVersion,
    slots: Object.fromEntries(
      Object.entries(response.slots ?? {}).map(([difficultyKey, slot]) => [
        difficultyKey,
        normalizeIssuedPracticeSlot(difficultyKey, response.contentVersion, slot)
      ])
    )
  };
}

export async function submitProtectedPracticeCase(
  config: RuntimeConfig,
  supabase: SupabaseClient,
  request: ProtectedPracticeSubmitRequest
): Promise<{ summary: CaseSummary; replacementSlot: IssuedPracticeSlot }> {
  const response = await invokeProtectedFunction<ProtectedPracticeSubmitResponse>(
    config,
    supabase,
    "submit-practice-case",
    request as unknown as Record<string, unknown>
  );

  const explanation = normalizeStructuredExplanation(response.explanation);
  const summary: CaseSummary = {
    caseToken: response.summary.caseToken ?? request.caseToken,
    caseId: response.summary.caseId,
    title: response.summary.title,
    difficulty: response.summary.difficulty,
    explanation,
    learningObjective: response.summary.learningObjective,
    elapsedSeconds: response.summary.elapsedSeconds,
    accuracy: response.summary.accuracy,
    correctSteps: response.summary.correctSteps,
    totalSteps: response.summary.totalSteps,
    totalXpAward: response.summary.totalXpAward,
    baseXp: response.summary.baseXp,
    perfectBonus: response.summary.perfectBonus,
    speedBonus: response.summary.speedBonus,
    level: response.summary.level,
    stepResults: response.stepResults ?? [],
    caseData: response.summary.caseData
  };

  const difficultyKey = String(response.replacementSlot.difficultyKey ?? response.summary.caseData.difficulty_label ?? "").toLowerCase();
  const replacementSlot = normalizeIssuedPracticeSlot(
    difficultyKey,
    String(response.replacementSlot.contentVersion ?? ""),
    response.replacementSlot
  );

  return {
    summary,
    replacementSlot
  };
}

export function buildPendingPracticeSubmission(input: {
  caseToken: string;
  caseId: string;
  contentVersion: string;
  difficultyKey: string;
  answers: Array<{ key: string; chosen: string }>;
  elapsedSeconds: number;
  timedMode: boolean;
  clientCompletedAt: string;
}): PendingPracticeSubmission {
  return {
    caseToken: input.caseToken,
    caseId: input.caseId,
    contentVersion: input.contentVersion,
    difficultyKey: input.difficultyKey,
    answers: input.answers,
    elapsedSeconds: input.elapsedSeconds,
    timedMode: input.timedMode,
    clientCompletedAt: input.clientCompletedAt
  };
}

export function hasAppliedProtectedCaseToken(userState: UserState, caseToken: string): boolean {
  return Array.isArray(userState.appliedProtectedCaseTokens) && userState.appliedProtectedCaseTokens.includes(caseToken);
}

export function applyProtectedCaseCompletion(input: {
  userState: UserState;
  summary: CaseSummary;
  progressionConfig: ProgressionConfig | null;
  now?: Date;
}): UserState {
  if (!input.summary.caseToken) {
    return input.userState;
  }

  if (hasAppliedProtectedCaseToken(input.userState, input.summary.caseToken)) {
    return input.userState;
  }

  const totalXpAward = getAwardableXp(input.progressionConfig, input.userState.xp, input.summary.totalXpAward);
  let nextUserState: UserState = {
    ...input.userState,
    xp: input.userState.xp + totalXpAward,
    casesCompleted: input.userState.casesCompleted + 1,
    correctAnswers: input.userState.correctAnswers + input.summary.correctSteps,
    totalAnswers: input.userState.totalAnswers + input.summary.totalSteps,
    recentResults: [...input.userState.recentResults, input.summary.correctSteps === input.summary.totalSteps].slice(-20),
    appliedProtectedCaseTokens: [
      ...input.userState.appliedProtectedCaseTokens,
      input.summary.caseToken
    ].slice(-APPLIED_TOKEN_LIMIT)
  };

  nextUserState = updateDailyStreak(nextUserState, input.now);
  nextUserState = syncUserStateDerivedFields(nextUserState, input.progressionConfig);
  nextUserState = evaluateBadges(nextUserState);
  return nextUserState;
}

export function createProtectedUnavailableExplanation(message: string): StructuredExplanation {
  return {
    overview: message,
    sections: []
  };
}
