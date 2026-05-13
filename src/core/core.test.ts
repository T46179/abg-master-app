import { afterEach, describe, expect, it, vi } from "vitest";
import { composeCaseStructuredExplanation } from "./explanations";
import { getCaseFeedbackFormUrl } from "./feedback";
import { getVisibleCaseMetrics } from "./metrics";
import {
  applyPracticeOutcome,
  buildFinalStepResults,
  canUseClientSidePracticeFeedback,
  formatAnswerValue,
  getQuestionFlowStepStatus,
  isCorrectAnswer,
  reconcileProtectedSummaryWithLockedStepResults
} from "./practice";
import { applyProtectedCaseCompletion } from "./protectedPractice";
import {
  clearPracticeSlotCache,
  clearPendingPracticeSubmission,
  loadPendingPracticeSubmission,
  loadPracticeSlotsCache,
  savePendingPracticeSubmission,
  savePracticeSlotsCache,
  slotMatchesDifficultyKey
} from "./protectedPracticeCache";
import {
  canAccessDifficulty,
  getAccessibleDifficultyKeys,
  getAwardableXp,
  getHighestAccessibleDifficultyKey,
  getLevelProgress,
  getMaxReachableLevel,
  getReleaseSignature,
  isPlacementXpBoostActive,
  mapDefaultUserState
} from "./progression";
import { createMemoryStorage } from "./storage";
import { getRuntimeAssetPath, isRuntimeBootstrapError, loadCasesPayload, normalizeCasesPayload } from "./runtime";
import { getEligibleCasesForDifficulty } from "./selection";
import {
  createAppStorage,
  mapProgressRowToUserState,
  mapUserStateToProgressRow,
  STORAGE_KEYS
} from "./storage";
import type { CaseData, UserState } from "./types";

const gateProgressionConfig = {
  xp_required_per_level: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 100])),
  base_xp_by_difficulty: { 1: 10, 2: 25, 3: 65, 4: 90 },
  difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
  difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 },
  performance_unlock_requirements: {
    advanced: {
      lastCases: 5,
      minStepAccuracyPercent: 75,
      requiredDifficulty: "any_practice"
    },
    master: {
      lastCases: 5,
      minStepAccuracyPercent: 75,
      requiredDifficulty: "advanced"
    }
  }
};

const sampleCase: CaseData = {
  case_id: "case-1",
  title: "Sample ABG",
  archetype: "sepsis_respiratory_alkalosis",
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

const beginnerCase: CaseData = {
  case_id: "case-beginner",
  title: "Beginner ABG",
  archetype: "simple_nagma",
  difficulty_level: 1,
  protected_payload_mode: "practice_learning",
  answer_key: {
    ph_status: "Acidaemia",
    primary_disorder: "Metabolic acidosis"
  },
  questions_flow: [
    { key: "ph_status", options: ["Acidaemia", "Alkalaemia"] },
    { key: "primary_disorder", options: ["Metabolic acidosis", "Respiratory acidosis"] }
  ],
  explanation_blueprint: [
    {
      domain: "ph_status",
      variant: "beginner",
      title: "pH status",
      body: "pH is 7.21, so this is acidaemia. The overall direction is acidic.",
      order: 1,
      kind: "core_reasoning",
      stepKey: "ph_status"
    },
    {
      domain: "primary_disorder",
      variant: "beginner",
      title: "Primary disorder",
      body: "HCO3 is low, which supports a primary metabolic acidosis.",
      order: 2,
      kind: "core_reasoning",
      stepKey: "primary_disorder"
    },
    {
      domain: "diagnosis",
      variant: "beginner",
      title: "Diagnosis",
      body: "This pattern fits gastrointestinal bicarbonate loss.",
      order: 3,
      kind: "diagnosis"
    }
  ],
  step_feedback: {
    ph_status: {
      key: "ph_status",
      title: "pH status",
      body: "pH is 7.21, so this is acidaemia.",
      order: 1
    },
    primary_disorder: {
      key: "primary_disorder",
      title: "Primary disorder",
      body: "HCO3 is low, which supports a primary metabolic acidosis.",
      order: 2
    }
  }
};

const masterMultiSelectCase: CaseData = {
  ...sampleCase,
  case_id: "master-multi",
  difficulty_level: 4,
  answer_key: {
    acid_base_processes: ["Metabolic acidosis", "Respiratory alkalosis"]
  },
  questions_flow: [
    {
      key: "acid_base_processes",
      selection_mode: "multi",
      options: [
        "Metabolic acidosis",
        "Metabolic alkalosis",
        "Respiratory acidosis",
        "Respiratory alkalosis"
      ]
    }
  ]
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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
    appliedProtectedCaseTokens: [],
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
    },
    async rpc() {
      return { data: null, error: null };
    }
  };

  return { supabase, calls };
}

describe("runtime normalization", () => {
  it("normalizes protected runtime bootstraps", () => {
    const payload = normalizeCasesPayload({
      delivery_mode: "protected_runtime",
      progression_config: { difficulty_labels: { 1: "beginner" } },
      default_user_state: { total_xp: 0, level: 1 },
      dashboard_state: { user: { level: 1 } },
      content_version: "beta-1_2026-04-03"
    });

    expect(payload.deliveryMode).toBe("protected_runtime");
    expect(payload.cases).toEqual([]);
    expect(payload.contentVersion).toBe("beta-1_2026-04-03");
  });

  it("rejects wrapped public catalog payloads", () => {
    expect(() => normalizeCasesPayload({
      cases: [sampleCase],
      progression_config: { difficulty_labels: { 1: "beginner" } },
      default_user_state: { total_xp: 0, level: 1 },
      dashboard_state: { user: { level: 1 } },
      content_version: "beta-1_2026-04-03"
    })).toThrow("Protected runtime bootstrap format not recognized.");
  });

  it("rejects array public catalog payloads", () => {
    expect(() => normalizeCasesPayload([sampleCase])).toThrow("Protected runtime bootstrap format not recognized.");
  });

  it("builds runtime asset paths from BASE_URL-compatible bases", () => {
    expect(getRuntimeAssetPath("runtime_bootstrap.json", "/abg-master-app/")).toBe("/abg-master-app/runtime_bootstrap.json");
    expect(getRuntimeAssetPath("/runtime_bootstrap.json", "/")).toBe("/runtime_bootstrap.json");
  });

  it("fails closed when the bootstrap is unavailable and no cache exists", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    const storage = createMemoryStorage();

    let caughtError: unknown;
    try {
      await loadCasesPayload(fetchMock as typeof fetch, storage);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      "Unable to load protected runtime bootstrap from /runtime_bootstrap.json: Failed to load protected runtime bootstrap: 404"
    );
    expect(isRuntimeBootstrapError(caughtError)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/runtime_bootstrap.json", { cache: "no-store" });
  });

  it("caches valid protected bootstraps and reuses them when bootstrap fetch fails", async () => {
    const storage = createMemoryStorage();
    const bootstrap = {
      delivery_mode: "protected_runtime",
      progression_config: { difficulty_labels: { 1: "beginner" } },
      default_user_state: { total_xp: 0, level: 1 },
      dashboard_state: { user: { level: 1 } },
      content_version: "beta-1_2026-04-03"
    };
    const fetchSuccess = vi.fn(async () => Response.json(bootstrap));

    const freshPayload = await loadCasesPayload(fetchSuccess as typeof fetch, storage);
    expect(freshPayload.contentVersion).toBe("beta-1_2026-04-03");

    const fetchFailure = vi.fn(async () => new Response(null, { status: 503 }));
    const cachedPayload = await loadCasesPayload(fetchFailure as typeof fetch, storage);

    expect(cachedPayload).toEqual(freshPayload);
    expect(fetchFailure).toHaveBeenCalledWith("/runtime_bootstrap.json", { cache: "no-store" });
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

  it("caps overflowed xp at the configured max level", () => {
    const progressionConfig = {
      xp_required_per_level: { 1: 30, 2: 40 },
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced" }
    };
    const userState = mapDefaultUserState(
      { total_xp: 999, level: 25, subscription_tier: "free" },
      {
        progressionConfig,
        dashboardState: null
      }
    );
    const progress = getLevelProgress(progressionConfig, userState);

    expect(getMaxReachableLevel(progressionConfig)).toBe(3);
    expect(userState.xp).toBe(70);
    expect(userState.level).toBe(3);
    expect(progress.isMaxLevel).toBe(true);
    expect(progress.xpIntoLevel).toBe(40);
    expect(progress.xpForNextLevel).toBe(40);
  });

  it("keeps the cap config-driven so extending xp_required_per_level raises the max level", () => {
    expect(getMaxReachableLevel({ xp_required_per_level: { 1: 30, 2: 40, 3: 50, 4: 60 } })).toBe(5);
    expect(getMaxReachableLevel({
      xp_required_per_level: {
        1: 30,
        2: 40,
        3: 50,
        4: 60,
        5: 80,
        6: 100,
        7: 120,
        8: 140,
        9: 160,
        10: 200,
        11: 240,
        12: 280,
        13: 320,
        14: 360,
        15: 400,
        16: 440,
        17: 480,
        18: 520,
        19: 560,
        20: 600,
        21: 640,
        22: 680,
        23: 720,
        24: 760,
        25: 800,
        26: 840,
        27: 880,
        28: 920,
        29: 960
      }
    })).toBe(30);
  });

  it("returns zero awardable xp once the configured cap has been reached", () => {
    expect(getAwardableXp({ xp_required_per_level: { 1: 30, 2: 40 } }, 70, 25)).toBe(0);
    expect(getAwardableXp({ xp_required_per_level: { 1: 30, 2: 40 } }, 65, 25)).toBe(5);
  });

  it("blocks level 9 to 10 at the Advanced readiness gate and discards excess xp", () => {
    const outcome = applyPracticeOutcome({
      caseItem: beginnerCase,
      userState: createUserState({
        xp: 890,
        level: 9,
        recentPracticeAttempts: [
          { difficulty: "beginner", correctSteps: 1, totalSteps: 4 },
          { difficulty: "intermediate", correctSteps: 1, totalSteps: 4 },
          { difficulty: "beginner", correctSteps: 1, totalSteps: 4 },
          { difficulty: "intermediate", correctSteps: 1, totalSteps: 4 }
        ]
      }),
      progressionConfig: gateProgressionConfig,
      seenCasesByDifficulty: {},
      stepResults: [
        { key: "ph_status", label: "pH status", chosen: "Acidaemia", correct: true, correctAnswer: "Acidaemia" },
        { key: "final_diagnosis", label: "Diagnosis", chosen: "Sepsis", correct: true, correctAnswer: "Sepsis" }
      ],
      elapsedSeconds: 40,
      timedMode: false
    });

    expect(outcome.userState.xp).toBe(899);
    expect(outcome.userState.level).toBe(9);
    expect(outcome.summary.totalXpAward).toBe(9);
    expect(outcome.userState.advancedUnlockedAt).toBeUndefined();
    expect(getLevelProgress(gateProgressionConfig, outcome.userState)).toMatchObject({
      progressPercent: 99,
      isBlockedByReadinessGate: true,
      blockedDifficulty: "advanced"
    });
  });

  it("allows level 9 at the 99 percent cap to cross when the fifth eligible case satisfies Advanced readiness", () => {
    const outcome = applyPracticeOutcome({
      caseItem: beginnerCase,
      userState: createUserState({
        xp: 899,
        level: 9,
        recentPracticeAttempts: [
          { difficulty: "beginner", correctSteps: 3, totalSteps: 4 },
          { difficulty: "intermediate", correctSteps: 3, totalSteps: 4 },
          { difficulty: "beginner", correctSteps: 3, totalSteps: 4 },
          { difficulty: "intermediate", correctSteps: 3, totalSteps: 4 }
        ]
      }),
      progressionConfig: gateProgressionConfig,
      seenCasesByDifficulty: {},
      stepResults: [
        { key: "ph_status", label: "pH status", chosen: "Acidaemia", correct: true, correctAnswer: "Acidaemia" },
        { key: "final_diagnosis", label: "Diagnosis", chosen: "Sepsis", correct: true, correctAnswer: "Sepsis" }
      ],
      elapsedSeconds: 40,
      timedMode: false
    });

    expect(outcome.userState.xp).toBe(909);
    expect(outcome.userState.level).toBe(10);
    expect(outcome.summary.totalXpAward).toBe(10);
    expect(outcome.userState.advancedUnlockedAt).toEqual(expect.any(String));
    expect(outcome.userState.unlockedDifficulties).toContain("advanced");
  });

  it("blocks and unblocks level 14 to 15 using only recent Advanced cases for Master readiness", () => {
    const blocked = applyPracticeOutcome({
      caseItem: { ...sampleCase, difficulty_level: 3 },
      userState: createUserState({
        xp: 1390,
        level: 14,
        advancedUnlockedAt: "2026-05-10T00:00:00.000Z",
        recentPracticeAttempts: [
          { difficulty: "advanced", correctSteps: 1, totalSteps: 4 },
          { difficulty: "advanced", correctSteps: 1, totalSteps: 4 },
          { difficulty: "advanced", correctSteps: 1, totalSteps: 4 },
          { difficulty: "beginner", correctSteps: 4, totalSteps: 4 },
          { difficulty: "advanced", correctSteps: 1, totalSteps: 4 }
        ]
      }),
      progressionConfig: gateProgressionConfig,
      seenCasesByDifficulty: {},
      stepResults: [
        { key: "ph_status", label: "pH status", chosen: "Acidaemia", correct: true, correctAnswer: "Acidaemia" },
        { key: "final_diagnosis", label: "Diagnosis", chosen: "Sepsis", correct: true, correctAnswer: "Sepsis" }
      ],
      elapsedSeconds: 40,
      timedMode: false
    });

    expect(blocked.userState.xp).toBe(1399);
    expect(blocked.userState.level).toBe(14);
    expect(blocked.userState.masterUnlockedAt).toBeUndefined();

    const unblocked = applyPracticeOutcome({
      caseItem: { ...sampleCase, difficulty_level: 3 },
      userState: createUserState({
        xp: 1399,
        level: 14,
        advancedUnlockedAt: "2026-05-10T00:00:00.000Z",
        recentPracticeAttempts: [
          { difficulty: "advanced", correctSteps: 3, totalSteps: 4 },
          { difficulty: "advanced", correctSteps: 3, totalSteps: 4 },
          { difficulty: "advanced", correctSteps: 3, totalSteps: 4 },
          { difficulty: "beginner", correctSteps: 4, totalSteps: 4 },
          { difficulty: "advanced", correctSteps: 3, totalSteps: 4 }
        ]
      }),
      progressionConfig: gateProgressionConfig,
      seenCasesByDifficulty: {},
      stepResults: [
        { key: "ph_status", label: "pH status", chosen: "Acidaemia", correct: true, correctAnswer: "Acidaemia" },
        { key: "final_diagnosis", label: "Diagnosis", chosen: "Sepsis", correct: true, correctAnswer: "Sepsis" }
      ],
      elapsedSeconds: 40,
      timedMode: false
    });

    expect(unblocked.userState.xp).toBe(1464);
    expect(unblocked.userState.level).toBe(15);
    expect(unblocked.summary.totalXpAward).toBe(65);
    expect(unblocked.userState.masterUnlockedAt).toEqual(expect.any(String));
    expect(unblocked.userState.unlockedDifficulties).toContain("master");
  });

  it("defaults practice entry to the highest accessible difficulty", () => {
    const highestDifficulty = getHighestAccessibleDifficultyKey({
      progressionConfig: {
        difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
        difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 20 }
      },
      userState: createUserState({
        xp: 200,
        level: 10,
        unlockedDifficulties: ["beginner", "intermediate", "advanced"],
        isPremium: true,
        advancedUnlockedAt: "2026-05-10T00:00:00Z"
      })
    });

    expect(highestDifficulty).toBe("advanced");
  });

  it("derives access from calibration placement and unlock timestamps", () => {
    const progressionConfig = {
      difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" },
      difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 15 }
    };
    const advancedPlacement = createUserState({
      calibrationCompleted: true,
      calibrationPlacement: "advanced",
      xp: 0,
      level: 1
    });
    const masterEarned = createUserState({
      calibrationCompleted: true,
      calibrationPlacement: "beginner",
      masterUnlockedAt: "2026-05-10T00:00:00Z"
    });

    expect(getAccessibleDifficultyKeys({ progressionConfig, userState: advancedPlacement })).toEqual([
      "beginner",
      "intermediate",
      "advanced"
    ]);
    expect(canAccessDifficulty({ progressionConfig, userState: advancedPlacement }, "master")).toBe(false);
    expect(getAccessibleDifficultyKeys({ progressionConfig, userState: masterEarned })).toEqual([
      "beginner",
      "intermediate",
      "advanced",
      "master"
    ]);
  });

  it("detects active placement XP boosts for eligible placement cases only", () => {
    const progressionConfig = {
      placement_xp_boosts: {
        beginner: null,
        intermediate: { targetLevel: 5, multiplier: 2, eligibleDifficulties: [2] },
        advanced: { targetLevel: 10, multiplier: 2, eligibleDifficulties: [3] }
      }
    };

    expect(isPlacementXpBoostActive({
      progressionConfig,
      userState: createUserState({ calibrationPlacement: "intermediate", level: 4 }),
      difficultyLevel: 2
    })).toBe(true);
    expect(isPlacementXpBoostActive({
      progressionConfig,
      userState: createUserState({ calibrationPlacement: "intermediate", level: 4 }),
      difficultyLevel: 3
    })).toBe(false);
    expect(isPlacementXpBoostActive({
      progressionConfig,
      userState: createUserState({
        calibrationPlacement: "advanced",
        level: 9,
        placementBoostCompletedAt: "2026-05-10T00:00:00Z"
      }),
      difficultyLevel: 3
    })).toBe(false);
  });

  it("builds the release signature from version and beta release only", () => {
    expect(getReleaseSignature({
      version: "v2",
      beta_release_number: 2,
      release_flags: {
        enable_all_difficulties: false,
        enable_beta_badge: true
      }
    })).toBe(JSON.stringify({ progressionVersion: "v2", betaReleaseNumber: 2 }));
  });
});

describe("metric visibility", () => {
  it("hides lactate for beginner cases", () => {
    const labels = getVisibleCaseMetrics({
      ...sampleCase,
      difficulty_level: 1
    }).map(metric => metric.label);

    expect(labels).not.toContain("Glucose");
    expect(labels).not.toContain("Lactate");
  });

  it("shows lactate but not glucose for intermediate cases", () => {
    const labels = getVisibleCaseMetrics({
      ...sampleCase,
      difficulty_level: 2
    }).map(metric => metric.label);

    expect(labels).toContain("Lactate");
    expect(labels).not.toContain("Glucose");
  });

  it("shows advanced glucose metrics when available for advanced cases", () => {
    const labels = getVisibleCaseMetrics({
      ...sampleCase,
      difficulty_level: 3
    }).map(metric => metric.label);
    expect(labels).toContain("Glucose");
    expect(labels).toContain("Lactate");
  });

  it("shows lactate and glucose for master cases", () => {
    const labels = getVisibleCaseMetrics({
      ...sampleCase,
      difficulty_level: 4
    }).map(metric => metric.label);

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
        xp_required_per_level: { 1: 30, 2: 40, 3: 50 }
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

  it("stops awarding xp after the configured max level is reached", () => {
    const outcome = applyPracticeOutcome({
      caseItem: sampleCase,
      userState: createUserState({
        xp: 70,
        level: 3,
        unlockedDifficulties: ["beginner", "intermediate", "advanced"]
      }),
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

    expect(outcome.userState.xp).toBe(70);
    expect(outcome.userState.level).toBe(3);
    expect(outcome.summary.totalXpAward).toBe(0);
  });

  it("does not award duplicate xp for the same protected case token", () => {
    const progressionConfig = {
      difficulty_labels: { 3: "advanced" },
      xp_required_per_level: { 1: 30, 2: 40 }
    };
    const summary = {
      caseToken: "token-1",
      caseId: "case-1",
      title: "Sample ABG",
      difficulty: "Advanced",
      explanation: { overview: "", sections: [] },
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
    };

    const once = applyProtectedCaseCompletion({
      userState: createUserState(),
      summary,
      progressionConfig,
      now: new Date("2026-03-26T00:00:00Z")
    });
    const twice = applyProtectedCaseCompletion({
      userState: once,
      summary,
      progressionConfig,
      now: new Date("2026-03-26T00:00:00Z")
    });

    expect(once.xp).toBe(30);
    expect(twice.xp).toBe(30);
    expect(twice.casesCompleted).toBe(1);
    expect(twice.appliedProtectedCaseTokens).toEqual(["token-1"]);
  });

  it("composes structured explanations from blueprint data for legacy summaries", () => {
    const summary = applyPracticeOutcome({
      caseItem: beginnerCase,
      userState: createUserState(),
      progressionConfig: {
        difficulty_labels: { 1: "beginner" },
        xp_required_per_level: { 1: 30 }
      },
      seenCasesByDifficulty: { beginner: [], intermediate: [], advanced: [], master: [] },
      stepResults: [
        { key: "ph_status", label: "pH status", chosen: "Acidaemia", correctAnswer: "Acidaemia", correct: true },
        { key: "primary_disorder", label: "Primary disorder", chosen: "Metabolic acidosis", correctAnswer: "Metabolic acidosis", correct: true }
      ],
      elapsedSeconds: 10,
      timedMode: false,
      now: new Date("2026-03-26T00:00:00Z")
    }).summary;

    expect(summary.explanation.overview).toContain("gastrointestinal bicarbonate loss");
    expect(summary.explanation.sections.map(section => section.key)).toEqual([
      "ph_status",
      "primary_disorder",
      "diagnosis"
    ]);
  });
});

describe("explanations", () => {
  it("enables inline client-side feedback through advanced practice_learning cases with step feedback", () => {
    const advancedCase: CaseData = {
      ...sampleCase,
      protected_payload_mode: "practice_learning",
      answer_key: {
        ph_status: "Acidaemia"
      },
      step_feedback: {
        ph_status: {
          key: "ph_status",
          title: "pH status",
          body: "The pH is < 7.35, consistent with an acidaemia.",
          order: 1
        }
      }
    };
    const masterCase: CaseData = {
      ...advancedCase,
      difficulty_level: 4
    };

    expect(canUseClientSidePracticeFeedback(beginnerCase)).toBe(true);
    expect(canUseClientSidePracticeFeedback(advancedCase)).toBe(true);
    expect(canUseClientSidePracticeFeedback(masterCase)).toBe(false);
  });

  it("hides metrics listed in display.hidden_inputs", () => {
    const labels = getVisibleCaseMetrics({
      ...sampleCase,
      difficulty_level: 4,
      display: {
        hidden_inputs: ["pao2_mmHg", "glucose_mmolL", "Lactate"]
      }
    }).map(metric => metric.label);

    expect(labels).not.toContain("PaO2");
    expect(labels).not.toContain("Glucose");
    expect(labels).not.toContain("Lactate");
  });

  it("reintroduces advanced ph status only when that step was missed", () => {
    const advancedCase: CaseData = {
      ...sampleCase,
      explanation_blueprint: [
        { domain: "compensation", variant: "advanced", title: "Compensation", body: "Compensation mismatch points to more than one process.", order: 1, kind: "core_reasoning", stepKey: "compensation" },
        { domain: "anion_gap", variant: "advanced", title: "Anion gap", body: "The anion gap is raised.", order: 2, kind: "core_reasoning", stepKey: "anion_gap" },
        { domain: "diagnosis", variant: "advanced", title: "Diagnosis", body: "This fits a mixed process.", order: 3, kind: "diagnosis", stepKey: "final_diagnosis" },
        { domain: "ph_status", variant: "advanced", title: "pH status", body: "pH is acidaemic.", order: 4, kind: "core_reasoning", stepKey: "ph_status" },
        { domain: "primary_disorder", variant: "advanced", title: "Primary disorder", body: "PaCO2 is elevated.", order: 5, kind: "core_reasoning", stepKey: "primary_disorder" }
      ]
    };

    const withoutMiss = composeCaseStructuredExplanation(advancedCase, [
      { key: "ph_status", label: "pH status", chosen: "Acidaemia", correctAnswer: "Acidaemia", correct: true }
    ]);
    const withMiss = composeCaseStructuredExplanation(advancedCase, [
      { key: "ph_status", label: "pH status", chosen: "Alkalaemia", correctAnswer: "Acidaemia", correct: false }
    ]);

    expect(withoutMiss.sections.map(section => section.key)).not.toContain("ph_status");
    expect(withMiss.sections.map(section => section.key)).toContain("ph_status");
  });

  it("includes key takeaway for advanced cases when authored and orders it last", () => {
    const advancedCase: CaseData = {
      ...sampleCase,
      explanation_blueprint: [
        { domain: "compensation", variant: "advanced", title: "Compensation", body: "Compensation body.", order: 1, kind: "core_reasoning", stepKey: "compensation" },
        { domain: "anion_gap", variant: "advanced", title: "Anion Gap Analysis", body: "Anion gap body.", order: 2, kind: "core_reasoning", stepKey: "anion_gap" },
        { domain: "clinical_context", variant: "advanced", title: "Clinical Significance", body: "Clinical context body.", order: 3, kind: "clinical_context" },
        { domain: "key_takeaway", variant: "advanced", title: "Key Takeaway", body: "Takeaway body.", order: 999, kind: "core_reasoning" }
      ]
    };

    const explanation = composeCaseStructuredExplanation(advancedCase);

    expect(explanation.sections.map(section => section.key)).toEqual([
      "compensation",
      "anion_gap",
      "clinical_context",
      "key_takeaway"
    ]);
    expect(explanation.sections.at(-1)?.title).toBe("Key Takeaway");
  });

  it("omits whitespace-only explanation bodies from composed sections", () => {
    const advancedCase: CaseData = {
      ...sampleCase,
      explanation_blueprint: [
        { domain: "compensation", variant: "advanced", title: "Compensation", body: "   ", order: 1, kind: "core_reasoning", stepKey: "compensation" },
        { domain: "anion_gap", variant: "advanced", title: "Anion Gap Analysis", body: "Anion gap body.", order: 2, kind: "core_reasoning", stepKey: "anion_gap" }
      ]
    };

    const explanation = composeCaseStructuredExplanation(advancedCase);

    expect(explanation.sections.map(section => section.key)).toEqual(["anion_gap"]);
  });
});

describe("question flow pill status", () => {
  it("grades master multi-select answers by normalized exact-set equality", () => {
    expect(isCorrectAnswer(masterMultiSelectCase, "acid_base_processes", [
      "Respiratory alkalosis",
      "Metabolic acidosis"
    ])).toBe(true);
    expect(isCorrectAnswer(masterMultiSelectCase, "acid_base_processes", ["Metabolic acidosis"])).toBe(false);
    expect(isCorrectAnswer(masterMultiSelectCase, "acid_base_processes", [
      "Metabolic acidosis",
      "Respiratory alkalosis",
      "Respiratory acidosis"
    ])).toBe(false);
  });

  it("formats array answers for feedback and review text", () => {
    expect(formatAnswerValue(["Metabolic acidosis", "Respiratory alkalosis"])).toBe(
      "Metabolic acidosis, Respiratory alkalosis"
    );
  });

  it("derives correct and incorrect statuses from selected answers for advanced cases", () => {
    expect(getQuestionFlowStepStatus({
      caseItem: sampleCase,
      stepKey: "ph_status",
      stepSelection: {
        key: "ph_status",
        label: "pH status",
        chosen: "Acidaemia"
      }
    })).toBe("correct");

    expect(getQuestionFlowStepStatus({
      caseItem: sampleCase,
      stepKey: "ph_status",
      stepSelection: {
        key: "ph_status",
        label: "pH status",
        chosen: "Alkalaemia"
      }
    })).toBe("incorrect");
  });

  it("keeps selected-only beginner steps as complete instead of correctness-colored", () => {
    expect(getQuestionFlowStepStatus({
      caseItem: beginnerCase,
      stepKey: "ph_status",
      stepSelection: {
        key: "ph_status",
        label: "pH status",
        chosen: "Acidaemia"
      }
    })).toBe("complete");
  });

  it("keeps in-progress multi-select steps as complete until submitted", () => {
    expect(getQuestionFlowStepStatus({
      caseItem: masterMultiSelectCase,
      stepKey: "acid_base_processes",
      isCurrentStep: true,
      stepSelection: {
        key: "acid_base_processes",
        label: "Acid-base processes",
        chosen: ["Metabolic acidosis"]
      }
    })).toBeUndefined();
  });

  it("grades submitted multi-select steps once they are no longer current", () => {
    expect(getQuestionFlowStepStatus({
      caseItem: masterMultiSelectCase,
      stepKey: "acid_base_processes",
      isPastStep: true,
      stepSelection: {
        key: "acid_base_processes",
        label: "Acid-base processes",
        chosen: ["Metabolic acidosis", "Respiratory alkalosis"]
      }
    })).toBe("correct");

    expect(getQuestionFlowStepStatus({
      caseItem: masterMultiSelectCase,
      stepKey: "acid_base_processes",
      isPastStep: true,
      stepSelection: {
        key: "acid_base_processes",
        label: "Acid-base processes",
        chosen: ["Metabolic acidosis"]
      }
    })).toBe("incorrect");
  });

  it("auto-advancing advanced flows require an answer key to judge correctness locally", () => {
    const protectedAdvancedCase: CaseData = {
      ...sampleCase,
      protected_payload_mode: "practice_learning"
    };

    expect(getQuestionFlowStepStatus({
      caseItem: protectedAdvancedCase,
      stepKey: "ph_status",
      stepSelection: {
        key: "ph_status",
        label: "pH status",
        chosen: "Acidaemia"
      }
    })).toBe("correct");
  });
});

describe("locked advanced/master step handling", () => {
  it("preserves locked incorrect step results when building final legacy summaries", () => {
    const stepResults = buildFinalStepResults({
      caseItem: sampleCase,
      selectedAnswers: [
        { key: "ph_status", label: "pH status", chosen: "Acidaemia" },
        { key: "final_diagnosis", label: "Diagnosis", chosen: "Sepsis" }
      ],
      existingStepResults: [
        { key: "ph_status", label: "pH status", chosen: "Alkalaemia", correctAnswer: "Acidaemia", correct: false }
      ]
    });

    expect(stepResults).toEqual([
      { key: "ph_status", label: "pH status", chosen: "Alkalaemia", correctAnswer: "Acidaemia", correct: false },
      { key: "final_diagnosis", label: "Diagnosis", prompt: undefined, chosen: "Sepsis", correctAnswer: "Sepsis", correct: true, feedback: null }
    ]);
  });

  it("keeps locked incorrect protected steps in the final summary and removes the perfect bonus", () => {
    const summary = reconcileProtectedSummaryWithLockedStepResults({
      summary: {
        caseId: sampleCase.case_id,
        title: sampleCase.title ?? "Sample ABG",
        difficulty: "Advanced",
        explanation: { overview: "overview", sections: [] },
        learningObjective: "objective",
        elapsedSeconds: 42,
        accuracy: 100,
        correctSteps: 2,
        totalSteps: 2,
        totalXpAward: 96,
        baseXp: 25,
        perfectBonus: 3,
        speedBonus: 4,
        level: 3,
        stepResults: [
          { key: "ph_status", label: "pH status", chosen: "Acidaemia", correctAnswer: "Acidaemia", correct: true },
          { key: "final_diagnosis", label: "Diagnosis", chosen: "Sepsis", correctAnswer: "Sepsis", correct: true }
        ],
        caseData: sampleCase
      },
      lockedStepResults: [
        { key: "ph_status", label: "pH status", chosen: "Alkalaemia", correctAnswer: "Acidaemia", correct: false }
      ],
      progressionConfig: {
        release_flags: { xp_multiplier: 3 },
        perfect_case_bonus_percent: 0.1,
        base_xp_by_difficulty: { 3: 25 }
      }
    });

    expect(summary.stepResults[0]?.correct).toBe(false);
    expect(summary.correctSteps).toBe(1);
    expect(summary.accuracy).toBe(50);
    expect(summary.perfectBonus).toBe(0);
    expect(summary.totalXpAward).toBe(87);
  });
});

describe("storage mappers", () => {
  it("maps progress rows", () => {
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

    expect(mappedBack?.casesCompleted).toBe(3);
    expect(mappedBack?.lastCaseDate).toBe("2026-03-26");
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
    initialStorage.saveAppAreaVisited(true);
    initialStorage.saveAdvancedRangesPreference(true);
    initialStorage.saveLastPracticeDifficulty("advanced");
    initialStorage.saveResultsExplanationPreferences({
      primary_disorder: true,
      compensation: false,
      anion_gap: true,
      additional_metabolic_process: true,
      clinical_context: false
    });
    initialStorage.saveResultsReviewExpandedPreference(true);

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
    expect(reloadedStorage.loadAppAreaVisited()).toBe(true);
    expect(reloadedStorage.loadAdvancedRangesPreference()).toBe(true);
    expect(reloadedStorage.loadLastPracticeDifficulty()).toBe("advanced");
    expect(reloadedStorage.loadResultsExplanationPreferences()).toEqual({
      primary_disorder: true,
      compensation: false,
      anion_gap: true,
      additional_metabolic_process: true,
      clinical_context: false
    });
    expect(reloadedStorage.loadResultsReviewExpandedPreference()).toBe(true);
    expect(browserStorage.getItem(STORAGE_KEYS.USER_STATE_MODE_STORAGE_KEY)).toBe("sig-1");
  });

  it("sanitizes the stored last practice difficulty", async () => {
    const browserStorage = createMemoryStorage();
    const storage = createAppStorage({ browserStorage });

    await storage.init({ releaseSignature: "sig-1" });
    storage.saveLastPracticeDifficulty("MASTER");
    expect(storage.loadLastPracticeDifficulty()).toBe("master");

    storage.saveLastPracticeDifficulty("not-real");
    expect(storage.loadLastPracticeDifficulty()).toBeNull();
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

  it("persists app area visited changes across re-init", async () => {
    const browserStorage = createMemoryStorage();
    const storage = createAppStorage({ browserStorage });

    await storage.init({ releaseSignature: "sig-1" });
    storage.saveAppAreaVisited(true);
    storage.saveAppAreaVisited(false);

    const reloadedStorage = createAppStorage({ browserStorage });
    await reloadedStorage.init({ releaseSignature: "sig-1" });

    expect(reloadedStorage.loadAppAreaVisited()).toBe(false);
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
    expect(calls.upserts).toHaveLength(0);
  });

  it("does not expose browser-side attempt writes", async () => {
    const browserStorage = createMemoryStorage();
    const { supabase, calls } = createFakeSupabase(null);
    const storage = createAppStorage({
      browserStorage,
      supabase: supabase as never,
      supabaseEnabled: true
    });

    await storage.init({ userId: "user-1", releaseSignature: "sig-1" });
    expect(calls.inserts).toHaveLength(0);
    expect("saveAttempt" in storage).toBe(false);
  });
});

describe("protected practice cache", () => {
  it("round-trips pending submissions and clears them", () => {
    const storage = createMemoryStorage();

    savePendingPracticeSubmission(storage, {
      caseToken: "token-1",
      caseId: "case-1",
      contentVersion: "beta-1_2026-04-03",
      difficultyKey: "advanced",
      answers: [{ key: "ph_status", chosen: "Acidaemia" }],
      elapsedSeconds: 20,
      timedMode: false,
      clientCompletedAt: "2026-03-26T00:00:00Z"
    });

    expect(loadPendingPracticeSubmission(storage)?.caseToken).toBe("token-1");

    clearPendingPracticeSubmission(storage);
    expect(loadPendingPracticeSubmission(storage)).toBeNull();
  });

  it("filters stale cached slots from older content versions", () => {
    const storage = createMemoryStorage();

    savePracticeSlotsCache(storage, {
      advanced: {
        caseToken: "token-1",
        issuedAt: "2026-03-26T00:00:00Z",
        expiresAt: "2026-03-27T00:00:00Z",
        contentVersion: "old-version",
        difficultyKey: "advanced",
        caseData: sampleCase
      }
    });

    expect(loadPracticeSlotsCache(storage, "new-version").advanced).toBeNull();
  });

  it("rejects cached slots whose embedded case difficulty does not match the slot key", () => {
    const storage = createMemoryStorage();

    savePracticeSlotsCache(storage, {
      master: {
        caseToken: "token-1",
        issuedAt: "2026-03-26T00:00:00Z",
        expiresAt: "2026-03-27T00:00:00Z",
        contentVersion: "beta-1",
        difficultyKey: "master",
        caseData: {
          ...sampleCase,
          difficulty_level: 1,
          difficulty_label: "beginner"
        }
      }
    });

    const loadedSlots = loadPracticeSlotsCache(storage, "beta-1");
    expect(loadedSlots.master).toBeNull();
    expect(slotMatchesDifficultyKey(loadedSlots.master, "master")).toBe(false);
  });

  it("scopes cached slots to the active user when a user id is provided", () => {
    const storage = createMemoryStorage();

    savePracticeSlotsCache(storage, {
      advanced: {
        caseToken: "token-1",
        issuedAt: "2026-03-26T00:00:00Z",
        expiresAt: "2026-03-27T00:00:00Z",
        contentVersion: "beta-1",
        difficultyKey: "advanced",
        caseData: sampleCase
      }
    }, "user-1");

    expect(loadPracticeSlotsCache(storage, "beta-1", "user-1").advanced?.caseToken).toBe("token-1");
    expect(loadPracticeSlotsCache(storage, "beta-1", "user-2").advanced).toBeUndefined();
  });

  it("clears only the matching cached slot for a pending submission", () => {
    const storage = createMemoryStorage();

    savePracticeSlotsCache(storage, {
      advanced: {
        caseToken: "token-1",
        issuedAt: "2026-03-26T00:00:00Z",
        expiresAt: "2026-03-27T00:00:00Z",
        contentVersion: "beta-1",
        difficultyKey: "advanced",
        caseData: sampleCase
      },
      beginner: {
        caseToken: "token-2",
        issuedAt: "2026-03-26T00:00:00Z",
        expiresAt: "2026-03-27T00:00:00Z",
        contentVersion: "beta-1",
        difficultyKey: "beginner",
        caseData: beginnerCase
      }
    });

    const nextSlots = clearPracticeSlotCache(
      storage,
      loadPracticeSlotsCache(storage),
      "advanced",
      "token-1"
    );

    expect(nextSlots.advanced).toBeNull();
    expect(nextSlots.beginner?.caseToken).toBe("token-2");
  });
});

describe("feedback helpers", () => {
  it("builds the legacy feedback form url from case summary data", () => {
    const url = getCaseFeedbackFormUrl({
      caseId: "case-1",
      title: "Sample ABG",
      difficulty: "Advanced",
      explanation: { overview: "", sections: [] },
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
