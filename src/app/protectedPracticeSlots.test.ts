import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemoryStorage } from "../core/storage";
import { savePracticeSlotsCache } from "../core/protectedPracticeCache";
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
});
