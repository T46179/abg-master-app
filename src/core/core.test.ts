import { describe, expect, it } from "vitest";
import { getCaseFeedbackFormUrl } from "./feedback";
import { getVisibleCaseMetrics } from "./metrics";
import { applyPracticeOutcome } from "./practice";
import {
  getLevelProgress,
  mapDefaultUserState
} from "./progression";
import { getRuntimeAssetPath, normalizeCasesPayload } from "./runtime";
import { getEligibleCasesForDifficulty } from "./selection";
import {
  createAppStorage,
  createMemoryStorage,
  mapAttemptToAttemptRow,
  mapProgressRowToUserState,
  mapUserStateToProgressRow,
  STORAGE_KEYS
} from "./storage";
import type { CaseData, UserState } from "./types";

const sampleCase: CaseData = {
  case_id: "case-1",
  title: "Sample ABG",
  difficulty_level: 3,
  clinical_stem: "Test stem",
  inputs: {
    gas: {
      ph: 7.12,
      paco2_mmHg: 52,
      hco3_mmolL: 18
    },
    electrolytes: {
      na_mmolL: 140,
      cl_mmolL: 102,
      k_mmolL: 4.1,
      glucose_mmolL: 9.4
    },
    other: {
      lactate_mmolL: 4.5
    }
  },
  answer_key: {
    ph_status: "Acidaemia",
    final_diagnosis: "Sepsis"
  },
  questions_flow: [
    { key: "ph_status", options: ["Acidaemia", "Alkalaemia"] },
    { key: "final_diagnosis", options: ["Sepsis", "COPD", "Sepsis"] }
  ]
};

function createUserState(overrides: Partial<UserState> = {}): UserState {
  return {
    xp: 0,
    level: 1,
    casesCompleted: 0,
    abandonedCases: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    streak: 0,
    dailyCasesUsed: 0,
    lastCaseDate: null,
    unlockedDifficulties: ["beginner"],
    isPremium: false,
    badges: [],
    recentResults: [],
    ...overrides
  };
}

function createFakeSupabase(remoteProgress: Record<string, unknown> | null) {
  const calls = {
    upserts: [] as Array<{ table: string; payload: unknown; options: unknown }>,
    inserts: [] as Array<{ table: string; payload: unknown }>
  };

  const supabase = {
    from(table: string) {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        async maybeSingle() {
          return {
            data: table === "user_progress" ? remoteProgress : null,
            error: null
          };
        },
        async upsert(payload: unknown, options: unknown) {
          calls.upserts.push({ table, payload, options });
          return { error: null };
        },
        async insert(payload: unknown) {
          calls.inserts.push({ table, payload });
          return { error: null };
        }
      };

      return query;
    }
  };

  return { supabase, calls };
}

describe("runtime normalization", () => {
  it("normalizes wrapped payloads", () => {
    const payload = normalizeCasesPayload({
      cases: [sampleCase],
      progression_config: { difficulty_labels: { 1: "beginner" } },
      default_user_state: { total_xp: 0, level: 1 },
      dashboard_state: { user: { level: 1 } }
    });

    expect(payload.cases).toHaveLength(1);
    expect(payload.progressionConfig?.difficulty_labels?.[1]).toBe("beginner");
  });

  it("builds runtime asset paths from BASE_URL-compatible bases", () => {
    expect(getRuntimeAssetPath("abg_cases.json", "/abg-master-app/")).toBe("/abg-master-app/abg_cases.json");
    expect(getRuntimeAssetPath("/abg_cases.json", "/")).toBe("/abg_cases.json");
  });
});

describe("progression helpers", () => {
  it("maps default user state and computes level progress", () => {
    const userState = mapDefaultUserState(
      { total_xp: 45, level: 2, subscription_tier: "free" },
      {
        progressionConfig: {
          xp_required_per_level: { 1: 30, 2: 40 },
          difficulty_labels: { 1: "beginner", 2: "intermediate" }
        },
        dashboardState: null
      }
    );

    const progress = getLevelProgress(
      { xp_required_per_level: { 1: 30, 2: 40 } },
      userState
    );

    expect(userState.level).toBe(2);
    expect(progress.xpIntoLevel).toBe(15);
  });
});

describe("metric visibility", () => {
  it("shows advanced glucose metrics when available for advanced cases", () => {
    const labels = getVisibleCaseMetrics(sampleCase).map(metric => metric.label);
    expect(labels).toContain("Glucose");
    expect(labels).toContain("Lactate");
  });
});

describe("selection helpers", () => {
  it("prefers unseen cases for the requested difficulty", () => {
    const secondCase: CaseData = { ...sampleCase, case_id: "case-2", archetype: "alt" };
    const eligible = getEligibleCasesForDifficulty({
      cases: [sampleCase, secondCase],
      difficultyKey: "advanced",
      progressionConfig: { difficulty_labels: { 3: "advanced" } },
      seenCasesByDifficulty: { beginner: [], intermediate: [], advanced: ["case-1"], master: [] },
      recentArchetypes: []
    });

    expect(eligible.map(item => item.case_id)).toEqual(["case-2"]);
  });
});

describe("practice outcome", () => {
  it("awards xp and returns a case summary", () => {
    const outcome = applyPracticeOutcome({
      caseItem: sampleCase,
      userState: createUserState(),
      progressionConfig: {
        release_flags: { xp_multiplier: 3 },
        difficulty_labels: { 3: "advanced" },
        base_xp_by_difficulty: { 3: 25 },
        perfect_case_bonus_percent: 0.1,
        speed_bonus_tiers: [{ max_seconds: 999, bonus: 5 }],
        xp_required_per_level: { 1: 30, 2: 40 }
      },
      seenCasesByDifficulty: { beginner: [], intermediate: [], advanced: [], master: [] },
      stepResults: [
        { key: "ph_status", label: "pH status", chosen: "Acidaemia", correctAnswer: "Acidaemia", correct: true },
        { key: "final_diagnosis", label: "Diagnosis", chosen: "Sepsis", correctAnswer: "Sepsis", correct: true }
      ],
      elapsedSeconds: 20,
      timedMode: true,
      now: new Date("2026-03-26T00:00:00Z")
    });

    expect(outcome.userState.xp).toBe(99);
    expect(outcome.summary.totalXpAward).toBe(99);
    expect(outcome.summary.accuracy).toBe(100);
    expect(outcome.summary.difficulty).toBe("Advanced");
  });
});

describe("storage mappers", () => {
  it("maps progress and attempt rows", () => {
    const progressRow = mapUserStateToProgressRow(createUserState({
      xp: 20,
      level: 2,
      casesCompleted: 3,
      correctAnswers: 4,
      totalAnswers: 5,
      streak: 2,
      dailyCasesUsed: 1,
      lastCaseDate: "2026-03-26"
    }), "user-1");

    const mappedBack = mapProgressRowToUserState(progressRow);
    const attemptRow = mapAttemptToAttemptRow({
      user_id: "user-1",
      case_id: "case-1",
      difficulty: "advanced",
      difficulty_level: 3,
      xp_earned: 30,
      correct: 2,
      total_questions: 2,
      time_taken_ms: 20000,
      completed_at: "2026-03-26T00:00:00Z"
    });

    expect(mappedBack?.casesCompleted).toBe(3);
    expect(attemptRow.elapsed_seconds).toBe(20);
    expect(attemptRow.final_diagnosis_correct).toBe(true);
  });
});

describe("storage adapters", () => {
  it("persists local user state and preferences across re-init", async () => {
    const browserStorage = createMemoryStorage();
    const initialStorage = createAppStorage({ browserStorage });
    const savedState = createUserState({
      xp: 42,
      level: 2,
      abandonedCases: 3,
      badges: ["First case complete"],
      recentResults: [true, false]
    });

    await initialStorage.init({ releaseSignature: "sig-1" });
    await initialStorage.saveUserState(savedState);
    initialStorage.saveSeenCaseState({ beginner: ["case-1"], intermediate: [], advanced: ["case-2"], master: [] });
    initialStorage.savePracticeIntroSeen(true);
    initialStorage.saveAdvancedRangesPreference(true);

    const reloadedStorage = createAppStorage({ browserStorage });
    await reloadedStorage.init({ releaseSignature: "sig-1" });

    expect(await reloadedStorage.loadUserState()).toEqual(savedState);
    expect(reloadedStorage.loadSeenCaseState()).toEqual({
      beginner: ["case-1"],
      intermediate: [],
      advanced: ["case-2"],
      master: []
    });
    expect(reloadedStorage.loadPracticeIntroSeen()).toBe(true);
    expect(reloadedStorage.loadAdvancedRangesPreference()).toBe(true);
    expect(browserStorage.getItem(STORAGE_KEYS.USER_STATE_MODE_STORAGE_KEY)).toBe("sig-1");
  });

  it("persists practice intro acceptance changes across re-init", async () => {
    const browserStorage = createMemoryStorage();
    const storage = createAppStorage({ browserStorage });

    await storage.init({ releaseSignature: "sig-1" });
    storage.savePracticeIntroSeen(true);
    storage.savePracticeIntroSeen(false);

    const reloadedStorage = createAppStorage({ browserStorage });
    await reloadedStorage.init({ releaseSignature: "sig-1" });

    expect(reloadedStorage.loadPracticeIntroSeen()).toBe(false);
  });

  it("merges remote core progress over local extras when supabase is enabled", async () => {
    const browserStorage = createMemoryStorage();
    const localStorage = createAppStorage({ browserStorage });
    const localState = createUserState({
      xp: 5,
      abandonedCases: 2,
      badges: ["First case complete"],
      recentResults: [true]
    });

    await localStorage.init({ releaseSignature: "sig-1" });
    await localStorage.saveUserState(localState);

    const { supabase, calls } = createFakeSupabase({
      xp: 45,
      level: 2,
      streak: 3,
      cases_completed: 4,
      correct_answers: 5,
      total_answers: 6,
      last_case_date: "2026-03-27"
    });

    const storage = createAppStorage({
      browserStorage,
      supabase: supabase as never,
      supabaseEnabled: true
    });

    await storage.init({ userId: "user-1", releaseSignature: "sig-1" });
    const hydratedState = await storage.loadUserState();

    expect(hydratedState).toMatchObject({
      xp: 45,
      level: 2,
      streak: 3,
      casesCompleted: 4,
      correctAnswers: 5,
      totalAnswers: 6,
      lastCaseDate: "2026-03-27",
      abandonedCases: 2,
      badges: ["First case complete"],
      recentResults: [true]
    });
    expect(calls.upserts[0]?.table).toBe("user_progress");
  });

  it("writes attempts remotely only when saveAttempt is called", async () => {
    const browserStorage = createMemoryStorage();
    const { supabase, calls } = createFakeSupabase(null);
    const storage = createAppStorage({
      browserStorage,
      supabase: supabase as never,
      supabaseEnabled: true
    });

    await storage.init({ userId: "user-1", releaseSignature: "sig-1" });
    expect(calls.inserts).toHaveLength(0);

    await storage.saveAttempt({
      user_id: "user-1",
      case_id: "case-1",
      difficulty: "advanced",
      difficulty_level: 3,
      xp_earned: 30,
      correct: 2,
      total_questions: 2,
      time_taken_ms: 20000,
      completed_at: "2026-03-26T00:00:00Z"
    });

    expect(calls.inserts).toHaveLength(1);
    expect(calls.inserts[0]).toMatchObject({ table: "attempts" });
  });
});

describe("feedback helpers", () => {
  it("builds the legacy feedback form url from case summary data", () => {
    const url = getCaseFeedbackFormUrl({
      caseId: "case-1",
      title: "Sample ABG",
      difficulty: "Advanced",
      explanation: "",
      learningObjective: "",
      elapsedSeconds: 20,
      accuracy: 100,
      correctSteps: 2,
      totalSteps: 2,
      totalXpAward: 30,
      baseXp: 25,
      perfectBonus: 0,
      speedBonus: 5,
      level: 2,
      stepResults: [],
      caseData: sampleCase
    });

    expect(url).toContain("entry.2070020822=case-1");
    expect(url).toContain("entry.134622764=pH+7.12");
  });
});
