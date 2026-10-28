import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemoryStorage } from "../core/storage";
import { invalidatePracticeSlotRequests } from "../core/practiceSlotEpoch";
import { loadPracticeSlotsCache, savePracticeSlotsCache } from "../core/protectedPracticeCache";
import { preloadProtectedPracticeSlots } from "./protectedPracticeSlots";

const prepareProtectedPracticeCases = vi.fn();

vi.mock("../core/protectedPractice", () => ({
  prepareProtectedPracticeCases: (...args: unknown[]) => prepareProtectedPracticeCases(...args)
}));

const runtimeConfig = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon"
};

const supabase = {} as SupabaseClient;

function createSlot(difficultyKey: string, token: string) {
  return {
    caseToken: token,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    contentVersion: "beta-1",
    difficultyKey,
    caseData: {
      case_id: `${difficultyKey}-case`,
      title: `${difficultyKey} case`,
      archetype: "dka",
      difficulty_level: difficultyKey === "advanced" ? 3 : 1,
      difficulty_label: difficultyKey,
      clinical_stem: "Test stem",
      inputs: {},
      questions_flow: []
    }
  };
}

describe("protected practice slot preloader", () => {
  beforeEach(() => {
    prepareProtectedPracticeCases.mockReset();
  });

  it("reuses valid user-scoped cached slots without calling Supabase", async () => {
    const storage = createMemoryStorage();
    savePracticeSlotsCache(storage, {
      advanced: createSlot("advanced", "cached-token")
    }, "user-1");

    const slots = await preloadProtectedPracticeSlots({
      config: runtimeConfig,
      supabase,
      storage,
      contentVersion: "beta-1",
      userId: "user-1",
      currentSlots: {},
      difficulties: ["advanced"]
    });

    expect(prepareProtectedPracticeCases).not.toHaveBeenCalled();
    expect(slots.advanced?.caseToken).toBe("cached-token");
  });

  it("deduplicates overlapping requests for the same difficulty", async () => {
    const storage = createMemoryStorage();
    prepareProtectedPracticeCases.mockImplementation(async (_config, _supabase, request) => ({
      contentVersion: "beta-1",
      slots: Object.fromEntries(
        request.difficulties.map((difficultyKey: string) => [
          difficultyKey,
          createSlot(difficultyKey, `${difficultyKey}-fresh-token`)
        ])
      )
    }));

    const [firstSlots, secondSlots] = await Promise.all([
      preloadProtectedPracticeSlots({
        config: runtimeConfig,
        supabase,
        storage,
        contentVersion: "beta-1",
        userId: "user-1",
        currentSlots: {},
        difficulties: ["advanced"]
      }),
      preloadProtectedPracticeSlots({
        config: runtimeConfig,
        supabase,
        storage,
        contentVersion: "beta-1",
        userId: "user-1",
        currentSlots: {},
        difficulties: ["advanced"]
      })
    ]);

    expect(prepareProtectedPracticeCases).toHaveBeenCalledTimes(1);
    expect(firstSlots.advanced?.caseToken).toBe("advanced-fresh-token");
    expect(secondSlots.advanced?.caseToken).toBe("advanced-fresh-token");
  });
  it("drops invalidated responses without repopulating the cache", async () => {
    const storage = createMemoryStorage();
    let finish!: (value: unknown) => void;
    prepareProtectedPracticeCases.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = preloadProtectedPracticeSlots({ config: runtimeConfig, supabase, storage,
      contentVersion: "beta-1", userId: "u", currentSlots: {}, difficulties: ["beginner"] });
    const rejected = expect(pending).rejects.toThrow("superseded");
    invalidatePracticeSlotRequests();
    finish({ contentVersion: "beta-1", slots: { beginner: createSlot("beginner", "obsolete") } });
    await rejected;
    expect(loadPracticeSlotsCache(storage, "beta-1", "u")).toEqual({});
  });

  it("does not let an obsolete request delete or replace a newer in-flight request", async () => {
    const storage = createMemoryStorage();
    const finishes: Array<(value: unknown) => void> = [];
    prepareProtectedPracticeCases.mockImplementation(() => new Promise(resolve => { finishes.push(resolve); }));
    const input = { config: runtimeConfig, supabase, storage, contentVersion: "beta-1", userId: "u", currentSlots: {}, difficulties: ["beginner"] };
    const old = preloadProtectedPracticeSlots(input);
    const rejected = expect(old).rejects.toThrow("superseded");
    invalidatePracticeSlotRequests();
    const current = preloadProtectedPracticeSlots(input);
    finishes[0]({ contentVersion: "beta-1", slots: { beginner: createSlot("beginner", "old") } });
    await rejected;
    const nextClick = preloadProtectedPracticeSlots(input);
    expect(prepareProtectedPracticeCases).toHaveBeenCalledTimes(2);
    finishes[1]({ contentVersion: "beta-1", slots: { beginner: createSlot("beginner", "new") } });
    expect((await current).beginner?.caseToken).toBe("new");
    expect((await nextClick).beginner?.caseToken).toBe("new");
  });

  it("ignores a response after the caller changes account or unmounts", async () => {
    const storage = createMemoryStorage(); let active = true;
    let finish!: (value: unknown) => void;
    prepareProtectedPracticeCases.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = preloadProtectedPracticeSlots({ config: runtimeConfig, supabase, storage,
      contentVersion: "beta-1", userId: "old-user", currentSlots: {}, difficulties: ["beginner"], isCurrent: () => active });
    const rejected = expect(pending).rejects.toThrow("superseded"); active = false;
    finish({ contentVersion: "beta-1", slots: { beginner: createSlot("beginner", "old-user-slot") } });
    await rejected;
    expect(loadPracticeSlotsCache(storage, "beta-1", "old-user")).toEqual({});
  });

});
