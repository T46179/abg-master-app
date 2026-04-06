import type { BrowserStorageLike } from "./storage";
import type { IssuedPracticeSlot, PendingPracticeSubmission } from "./types";

const PRACTICE_SLOTS_STORAGE_KEY = "abgmaster_practiceSlotsByDifficulty";
const PENDING_SUBMISSION_STORAGE_KEY = "abgmaster_pendingPracticeSubmission";
const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced", "master"] as const;

function safeGetItem(storage: BrowserStorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: BrowserStorageLike, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(storage: BrowserStorageLike, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function slotMatchesDifficultyKey(slot: IssuedPracticeSlot | null | undefined, difficultyKey: string): boolean {
  if (!slot?.caseData) return false;

  const normalizedDifficultyKey = String(difficultyKey ?? "").trim().toLowerCase();
  if (!normalizedDifficultyKey) return false;

  const caseDifficultyLabel = String(
    slot.caseData.difficulty_label ??
    DIFFICULTY_ORDER[Math.max(0, Number(slot.caseData.difficulty_level ?? 1) - 1)] ??
    ""
  ).trim().toLowerCase();
  const caseDifficultyLevel = Number(slot.caseData.difficulty_level ?? 0);
  const requestedDifficultyLevel = DIFFICULTY_ORDER.indexOf(normalizedDifficultyKey as (typeof DIFFICULTY_ORDER)[number]) + 1;

  return caseDifficultyLabel === normalizedDifficultyKey || (requestedDifficultyLevel > 0 && caseDifficultyLevel === requestedDifficultyLevel);
}

function sanitizePracticeSlot(source: unknown, difficultyKey: string): IssuedPracticeSlot | null {
  if (!isRecord(source) || !isRecord(source.caseData)) return null;

  const caseToken = String(source.caseToken ?? "").trim();
  const issuedAt = String(source.issuedAt ?? "").trim();
  const expiresAt = String(source.expiresAt ?? "").trim();
  const contentVersion = String(source.contentVersion ?? "").trim();
  const slotDifficultyKey = String(source.difficultyKey ?? "").trim();

  if (!caseToken || !issuedAt || !expiresAt || !contentVersion || !slotDifficultyKey) {
    return null;
  }

  const slot = {
    caseToken,
    issuedAt,
    expiresAt,
    contentVersion,
    difficultyKey: slotDifficultyKey,
    caseData: source.caseData as unknown as IssuedPracticeSlot["caseData"]
  };

  return slotMatchesDifficultyKey(slot, difficultyKey) ? slot : null;
}

export function loadPracticeSlotsCache(storage: BrowserStorageLike, contentVersion?: string | null): Record<string, IssuedPracticeSlot | null> {
  const raw = safeGetItem(storage, PRACTICE_SLOTS_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([difficultyKey, slotValue]) => {
        const slot = sanitizePracticeSlot(slotValue, difficultyKey);
        if (!slot) return [difficultyKey, null];
        if (contentVersion && slot.contentVersion !== contentVersion) return [difficultyKey, null];
        return [difficultyKey, slot];
      })
    );
  } catch {
    return {};
  }
}

export function savePracticeSlotsCache(storage: BrowserStorageLike, slots: Record<string, IssuedPracticeSlot | null>) {
  safeSetItem(storage, PRACTICE_SLOTS_STORAGE_KEY, JSON.stringify(slots ?? {}));
}

export function clearPracticeSlotCache(
  storage: BrowserStorageLike,
  slots: Record<string, IssuedPracticeSlot | null>,
  difficultyKey: string,
  caseToken?: string | null
) {
  const nextSlots = { ...(slots ?? {}) };
  const existingSlot = nextSlots[difficultyKey] ?? null;
  if (!existingSlot) {
    savePracticeSlotsCache(storage, nextSlots);
    return nextSlots;
  }

  if (caseToken && existingSlot.caseToken !== caseToken) {
    savePracticeSlotsCache(storage, nextSlots);
    return nextSlots;
  }

  nextSlots[difficultyKey] = null;
  savePracticeSlotsCache(storage, nextSlots);
  return nextSlots;
}

export function loadPendingPracticeSubmission(storage: BrowserStorageLike): PendingPracticeSubmission | null {
  const raw = safeGetItem(storage, PENDING_SUBMISSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const caseToken = String(parsed.caseToken ?? "").trim();
    const caseId = String(parsed.caseId ?? "").trim();
    const contentVersion = String(parsed.contentVersion ?? "").trim();
    const difficultyKey = String(parsed.difficultyKey ?? "").trim();

    if (!caseToken || !caseId || !contentVersion || !difficultyKey) {
      return null;
    }

    return {
      caseToken,
      caseId,
      contentVersion,
      difficultyKey,
      answers: Array.isArray(parsed.answers)
        ? parsed.answers
            .map(answer => ({
              key: String((answer as { key?: unknown }).key ?? "").trim(),
              chosen: String((answer as { chosen?: unknown }).chosen ?? "").trim()
            }))
            .filter(answer => answer.key && answer.chosen)
        : [],
      elapsedSeconds: Math.max(0, Number(parsed.elapsedSeconds ?? 0)),
      timedMode: Boolean(parsed.timedMode),
      clientCompletedAt: String(parsed.clientCompletedAt ?? "").trim()
    };
  } catch {
    return null;
  }
}

export function savePendingPracticeSubmission(storage: BrowserStorageLike, pending: PendingPracticeSubmission) {
  safeSetItem(storage, PENDING_SUBMISSION_STORAGE_KEY, JSON.stringify(pending));
}

export function clearPendingPracticeSubmission(storage: BrowserStorageLike) {
  safeRemoveItem(storage, PENDING_SUBMISSION_STORAGE_KEY);
}
