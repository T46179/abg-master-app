import { trackEvent } from "./analytics";

export type FeaturedCaseEntrySource =
  | "dashboard"
  | "results_summary"
  | "featured_summary"
  | "direct";

export type FeaturedCaseEntryAction = "start" | "continue" | "retry";
export type FeaturedCaseMilestone = "opened" | "engaged" | "completed" | "intro_begin";

export interface FeaturedCaseAnalyticsContext {
  attemptId: string;
  entrySource: FeaturedCaseEntrySource;
  action: FeaturedCaseEntryAction;
  isReplay: boolean;
  introShown: boolean;
  eventUuids: Record<FeaturedCaseMilestone, string>;
  tracked: Record<FeaturedCaseMilestone, boolean>;
}

export interface FeaturedCaseAnalyticsPropertiesInput {
  releaseId: string;
  entrySource: FeaturedCaseEntrySource;
  action: FeaturedCaseEntryAction;
  learnerLevel: number;
  normalCasesCompleted: number;
  isReplay: boolean;
  introShown?: boolean;
  analyticsAttemptId?: string;
  isCanonical?: boolean;
  elapsedSeconds?: number;
}

const ENTRY_SOURCES = new Set<FeaturedCaseEntrySource>([
  "dashboard",
  "results_summary",
  "featured_summary",
  "direct"
]);

const ENTRY_ACTIONS = new Set<FeaturedCaseEntryAction>([
  "start",
  "continue",
  "retry"
]);

export function createAnalyticsUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createFeaturedCaseAnalyticsContext(input: {
  entrySource: FeaturedCaseEntrySource;
  action: FeaturedCaseEntryAction;
  isReplay: boolean;
  introShown: boolean;
  alreadyEngaged?: boolean;
}): FeaturedCaseAnalyticsContext {
  return {
    attemptId: createAnalyticsUuid(),
    entrySource: input.entrySource,
    action: input.action,
    isReplay: input.isReplay,
    introShown: input.introShown,
    eventUuids: {
      opened: createAnalyticsUuid(),
      engaged: createAnalyticsUuid(),
      completed: createAnalyticsUuid(),
      intro_begin: createAnalyticsUuid()
    },
    tracked: {
      opened: false,
      engaged: Boolean(input.alreadyEngaged),
      completed: false,
      intro_begin: false
    }
  };
}

export function resolveFeaturedCaseEntry(searchParams: URLSearchParams): {
  entrySource: FeaturedCaseEntrySource;
  action: FeaturedCaseEntryAction;
  isReplay: boolean;
} {
  const rawSource = searchParams.get("source") as FeaturedCaseEntrySource | null;
  const rawAction = searchParams.get("action") as FeaturedCaseEntryAction | null;
  const isReplay = searchParams.get("replay") === "1" || rawAction === "retry";

  return {
    entrySource: rawSource && ENTRY_SOURCES.has(rawSource) ? rawSource : "direct",
    action: rawAction && ENTRY_ACTIONS.has(rawAction) ? rawAction : isReplay ? "retry" : "start",
    isReplay
  };
}

export function buildFeaturedCaseEntryUrl(
  source: Exclude<FeaturedCaseEntrySource, "direct">,
  action: FeaturedCaseEntryAction
): string {
  const params = new URLSearchParams({ source, action });
  if (action === "retry") params.set("replay", "1");
  return `/featured-case?${params.toString()}`;
}

export function buildFeaturedCaseAnalyticsProperties(
  input: FeaturedCaseAnalyticsPropertiesInput
): Record<string, unknown> {
  return {
    release_id: input.releaseId,
    entry_source: input.entrySource,
    action: input.action,
    learner_level: input.learnerLevel,
    normal_cases_completed: input.normalCasesCompleted,
    is_replay: input.isReplay,
    ...(input.introShown === undefined ? {} : { intro_shown: input.introShown }),
    ...(input.analyticsAttemptId ? { analytics_attempt_id: input.analyticsAttemptId } : {}),
    ...(input.isCanonical === undefined ? {} : { is_canonical: input.isCanonical }),
    ...(input.elapsedSeconds === undefined ? {} : { elapsed_seconds: input.elapsedSeconds })
  };
}

export function trackFeaturedCaseEntry(
  eventName: "featured_case_entry_viewed" | "featured_case_entry_clicked",
  input: FeaturedCaseAnalyticsPropertiesInput
): void {
  trackEvent(eventName, buildFeaturedCaseAnalyticsProperties(input));
}

export function trackFeaturedCaseMilestone(
  eventName:
    | "featured_case_opened"
    | "featured_case_engaged"
    | "featured_case_completed"
    | "featured_case_intro_begin_clicked",
  input: FeaturedCaseAnalyticsPropertiesInput,
  eventUuid: string
): void {
  trackEvent(eventName, buildFeaturedCaseAnalyticsProperties(input), { uuid: eventUuid });
}

