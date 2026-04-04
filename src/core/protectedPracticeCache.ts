import type { BrowserStorageLike } from "./storage";
import type { IssuedPracticeSlot, PendingPracticeSubmission } from "./types";

const PRACTICE_SLOTS_STORAGE_KEY = "abgmaster_practiceSlotsByDifficulty";
const PENDING_SUBMISSION_STORAGE_KEY = "abgmaster_pendingPracticeSubmission";

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

function sanitizePracticeSlot(source: unknown): IssuedPracticeSlot | null {
  if (!isRecord(source) || !isRecord(source.caseData)) return null;

  const caseToken = String(source.caseToken ?? "").trim();
  const issuedAt = String(source.issuedAt ?? "").trim();
  const expiresAt = String(source.expiresAt ?? "").trim();
  const contentVersion = String(source.contentVersion ?? "").trim();
  const difficultyKey = String(source.difficultyKey ?? "").trim();

  if (!caseToken || !issuedAt || !expiresAt || !contentVersion || !difficultyKey) {
    return null;
  }

  return {
    caseToken,
    issuedAt,
    expiresAt,
    contentVersion,
    difficultyKey,
    caseData: source.caseData as unknown as IssuedPracticeSlot["caseData"]
  };
}

export function loadPracticeSlotsCache(storage: BrowserStorageLike, contentVersion?: string | null): Record<string, IssuedPracticeSlot | null> {
  const raw = safeGetItem(storage, PRACTICE_SLOTS_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([difficultyKey, slotValue]) => {
        const slot = sanitizePracticeSlot(slotValue);
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
