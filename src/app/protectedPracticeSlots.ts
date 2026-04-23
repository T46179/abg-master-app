import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareProtectedPracticeCases } from "../core/protectedPractice";
import {
  loadPracticeSlotsCache,
  savePracticeSlotsCache,
  slotMatchesDifficultyKey
} from "../core/protectedPracticeCache";
import type { BrowserStorageLike } from "../core/storage";
import type { IssuedPracticeSlot, ProtectedPracticePrepareRequest, RuntimeConfig } from "../core/types";

type SlotRequestResult = {
  contentVersion: string;
  slots: Record<string, IssuedPracticeSlot>;
};

const inFlightSlotRequests = new Map<string, Promise<SlotRequestResult>>();

function normalizeDifficultyList(difficulties: string[]) {
  return Array.from(
    new Set(
      difficulties
        .map(difficulty => String(difficulty ?? "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function slotRequestKey(input: {
  userId?: string | null;
  contentVersion: string;
  difficultyKey: string;
}) {
  return `${String(input.userId ?? "anonymous")}:${input.contentVersion}:${input.difficultyKey}`;
}

export function isExpiredPracticeSlot(slot: IssuedPracticeSlot | null | undefined) {
  if (!slot?.expiresAt) return true;
  const expiresAtMs = new Date(slot.expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
}

function isReusablePracticeSlot(
  slot: IssuedPracticeSlot | null | undefined,
  difficultyKey: string,
  contentVersion: string
) {
  return Boolean(
    slot &&
    slot.contentVersion === contentVersion &&
    slotMatchesDifficultyKey(slot, difficultyKey) &&
    !isExpiredPracticeSlot(slot)
  );
}

export function getMissingPracticeSlotDifficulties(input: {
  storage: BrowserStorageLike;
  contentVersion: string;
  userId?: string | null;
  currentSlots: Record<string, IssuedPracticeSlot | null>;
  difficulties: string[];
}) {
  const difficulties = normalizeDifficultyList(input.difficulties);
  const slots = {
    ...loadPracticeSlotsCache(input.storage, input.contentVersion, input.userId),
    ...(input.currentSlots ?? {})
  };

  return {
    slots,
    missingDifficulties: difficulties.filter(difficultyKey => (
      !isReusablePracticeSlot(slots[difficultyKey], difficultyKey, input.contentVersion)
    ))
  };
}

export async function preloadProtectedPracticeSlots(input: {
  config: RuntimeConfig;
  supabase: SupabaseClient;
  storage: BrowserStorageLike;
  contentVersion: string;
  userId?: string | null;
  currentSlots: Record<string, IssuedPracticeSlot | null>;
  difficulties: string[];
  selectionHints?: ProtectedPracticePrepareRequest["selectionHints"];
}) {
  const { slots, missingDifficulties } = getMissingPracticeSlotDifficulties({
    storage: input.storage,
    contentVersion: input.contentVersion,
    userId: input.userId,
    currentSlots: input.currentSlots,
    difficulties: input.difficulties
  });

  if (!missingDifficulties.length) {
    return slots;
  }

  const fetchDifficulties = missingDifficulties.filter(difficultyKey => (
    !inFlightSlotRequests.has(slotRequestKey({
      userId: input.userId,
      contentVersion: input.contentVersion,
      difficultyKey
    }))
  ));

  if (fetchDifficulties.length) {
    const request = prepareProtectedPracticeCases(input.config, input.supabase, {
      contentVersion: input.contentVersion,
      difficulties: fetchDifficulties,
      selectionHints: input.selectionHints
    });

    for (const difficultyKey of fetchDifficulties) {
      const key = slotRequestKey({
        userId: input.userId,
        contentVersion: input.contentVersion,
        difficultyKey
      });
      const slotRequest = request
        .then(response => ({
          contentVersion: response.contentVersion,
          slots: response.slots[difficultyKey]
            ? { [difficultyKey]: response.slots[difficultyKey] }
            : {}
        }))
        .finally(() => {
          inFlightSlotRequests.delete(key);
        });
      inFlightSlotRequests.set(key, slotRequest);
    }
  }

  const resolvedRequests = await Promise.all(
    missingDifficulties
      .map(difficultyKey => inFlightSlotRequests.get(slotRequestKey({
        userId: input.userId,
        contentVersion: input.contentVersion,
        difficultyKey
      })))
      .filter((request): request is Promise<SlotRequestResult> => Boolean(request))
  );

  const resolvedContentVersion = resolvedRequests.find(result => result.contentVersion)?.contentVersion ?? input.contentVersion;
  const nextSlots = {
    ...loadPracticeSlotsCache(input.storage, resolvedContentVersion, input.userId),
    ...slots
  };

  for (const result of resolvedRequests) {
    Object.assign(nextSlots, result.slots);
  }

  for (const difficultyKey of Object.keys(nextSlots)) {
    if (!isReusablePracticeSlot(nextSlots[difficultyKey], difficultyKey, resolvedContentVersion)) {
      nextSlots[difficultyKey] = null;
    }
  }

  savePracticeSlotsCache(input.storage, nextSlots, input.userId);
  return nextSlots;
}
