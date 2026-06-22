import { describe, expect, it, vi } from "vitest";
import {
  INSIGHTS_VIEW_MODEL_VERSION,
  INSIGHTS_COMMON_MISS_WINDOW,
  INSIGHTS_STEP_ACCURACY_WINDOW,
  MIN_COMMON_MISS_RATE_PERCENT,
  MIN_COMMON_MISS_COUNT,
  MIN_COMMON_MISS_SAMPLE_SIZE,
  MIN_INSIGHTS_COMPLETED_CASES,
  buildInsightsViewModel,
  createInsightsLoadingViewModel,
  createInsightsUnauthenticatedViewModel,
  createInsightsUnavailableViewModel,
  commonMissPatternCopy,
  CURRENT_FOCUS_FALLBACK_EXPLANATION,
  currentFocusCopyRegistry,
  fetchInsightsAttempts,
  insightsRouteContract,
  type InsightsAttemptRow
} from "./insights";
import { createEmptyUserState } from "./progression";
import type { CaseData, ProgressionConfig, UserState } from "./types";

function createUserState(patch: Partial<UserState> = {}): UserState {
  return {
    ...createEmptyUserState(),
    ...patch
  };
}

function createAttempt(patch: Partial<InsightsAttemptRow> = {}): InsightsAttemptRow {
  return {
    id: "attempt-001",
    caseId: "CASE_001",
    clinicalPatternKey: "dka_vomiting",
    difficulty: "beginner",
    difficultyLevel: 1,
    correctSteps: 3,
    totalSteps: 4,
    accuracyPercent: 75,
    finalDiagnosisCorrect: true,
    stepResults: [
      { key: "ph_status", correct: true },
      { key: "primary_disorder", correct: true },
      { key: "compensation", correct: false },
      { key: "final_diagnosis", correct: true }
    ],
    completedAt: "2026-05-20T00:00:00.000Z",
    contentVersion: "test-content",
    ...patch
  };
}

function readyModel(attempts: InsightsAttemptRow[], options?: {
  userState?: Partial<UserState>;
  progressionConfig?: ProgressionConfig | null;
  availableCases?: CaseData[];
}) {
  return buildInsightsViewModel({
    attempts,
    totalAttemptCount: attempts.length,
    userState: createUserState(options?.userState),
    progressionConfig: options?.progressionConfig ?? null,
    availableCases: options?.availableCases
  });
}

describe("insights", () => {
  it("defines the visible route contract", () => {
    expect(insightsRouteContract).toEqual({
      route: "/insights",
      navigationLabel: "Insights",
      navEligible: true,
      navVisible: true
    });
  });

  it("includes the view-model version in all states", () => {
    const locked = buildInsightsViewModel({
      attempts: [],
      totalAttemptCount: 0,
      userState: createUserState(),
      progressionConfig: null
    });
    const ready = readyModel(Array.from({ length: MIN_INSIGHTS_COMPLETED_CASES }, (_, index) => createAttempt({
      id: `attempt-${index}`
    })));

    expect(createInsightsLoadingViewModel().viewModelVersion).toBe(INSIGHTS_VIEW_MODEL_VERSION);
    expect(createInsightsUnavailableViewModel().viewModelVersion).toBe(INSIGHTS_VIEW_MODEL_VERSION);
    expect(createInsightsUnauthenticatedViewModel().viewModelVersion).toBe(INSIGHTS_VIEW_MODEL_VERSION);
    expect(locked.viewModelVersion).toBe(INSIGHTS_VIEW_MODEL_VERSION);
    expect(ready.viewModelVersion).toBe(INSIGHTS_VIEW_MODEL_VERSION);
  });

  it("locks before five filtered completed practice attempts", () => {
    const viewModel = buildInsightsViewModel({
      attempts: Array.from({ length: 4 }, (_, index) => createAttempt({ id: `attempt-${index}` })),
      totalAttemptCount: 4,
      userState: createUserState(),
      progressionConfig: null
    });

    expect(viewModel).toMatchObject({
      state: "locked",
      casesCompleted: 4,
      casesRequired: 5,
      casesRemaining: 1,
      practiceHref: "/practice"
    });
  });

  it("locks after reset until five new completed practice attempts exist", () => {
    const viewModel = readyModel([
      ...Array.from({ length: 20 }, (_, index) => createAttempt({
        id: `before-reset-${index}`,
        completedAt: `2026-05-${String(10 + index).padStart(2, "0")}T00:00:00.000Z`
      })),
      ...Array.from({ length: 4 }, (_, index) => createAttempt({
        id: `after-reset-${index}`,
        completedAt: `2026-05-30T0${index}:00:00.000Z`
      }))
    ], {
      userState: {
        resetAt: "2026-05-29T00:00:00.000Z"
      }
    });

    expect(viewModel).toMatchObject({
      state: "locked",
      casesCompleted: 4,
      casesRequired: 5,
      casesRemaining: 1
    });
  });

  it("uses only post-reset attempts for ready metrics and recent cases", () => {
    const viewModel = readyModel([
      ...Array.from({ length: 10 }, (_, index) => createAttempt({
        id: `before-reset-${index}`,
        caseId: `OLD_${index}`,
        difficulty: "master",
        clinicalPatternKey: "salicylate_toxicity",
        correctSteps: 4,
        totalSteps: 4,
        completedAt: `2026-05-${String(10 + index).padStart(2, "0")}T00:00:00.000Z`,
        stepResults: [{ key: "ph_status", correct: true }]
      })),
      ...Array.from({ length: 5 }, (_, index) => createAttempt({
        id: `after-reset-${index}`,
        caseId: `NEW_${index}`,
        difficulty: "beginner",
        clinicalPatternKey: "simple_nagma",
        correctSteps: 1,
        totalSteps: 4,
        completedAt: `2026-05-30T0${index}:00:00.000Z`,
        stepResults: [{ key: "ph_status", correct: false }]
      }))
    ], {
      userState: {
        resetAt: "2026-05-29T00:00:00.000Z"
      }
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.recentAccuracy).toMatchObject({
      correctSteps: 5,
      totalSteps: 20,
      valuePercent: 25,
      windowSize: 5
    });
    expect(viewModel.recentCaseReview.map(item => item.caseId)).toEqual(["NEW_4", "NEW_3", "NEW_2", "NEW_1", "NEW_0"]);
    expect(viewModel.difficultyProgress).toEqual([
      expect.objectContaining({ difficulty: "beginner", completedCount: 5 })
    ]);
    expect(viewModel.clinicalPatternCoverage.encounteredPatterns).toEqual([
      expect.objectContaining({ label: "NAGMA", attempts: 5 })
    ]);
    expect(JSON.stringify(viewModel)).not.toContain("OLD_");
    expect(JSON.stringify(viewModel)).not.toContain("Salicylate toxicity");
  });

  it("uses the highest accessible difficulty as the current level label", () => {
    const viewModel = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({ id: `attempt-${index}` })), {
      userState: {
        intermediateUnlockedAt: "2026-05-01T00:00:00.000Z",
        advancedUnlockedAt: "2026-05-02T00:00:00.000Z",
        unlockedDifficulties: ["beginner", "intermediate", "advanced"]
      }
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.currentLevelLabel).toBe("Advanced");
  });

  it("uses completed_at desc and id desc for recent accuracy", () => {
    const attempts = [
      createAttempt({ id: "a", correctSteps: 0, totalSteps: 4, completedAt: "2026-05-20T00:00:00.000Z" }),
      createAttempt({ id: "c", correctSteps: 4, totalSteps: 4, completedAt: "2026-05-20T00:00:00.000Z" }),
      createAttempt({ id: "b", correctSteps: 4, totalSteps: 4, completedAt: "2026-05-20T00:00:00.000Z" }),
      ...Array.from({ length: 9 }, (_, index) => createAttempt({
        id: `old-${index}`,
        correctSteps: 0,
        totalSteps: 4,
        completedAt: `2026-05-${String(10 - index).padStart(2, "0")}T00:00:00.000Z`
      }))
    ];
    const viewModel = readyModel(attempts);

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.recentAccuracy.correctSteps).toBe(8);
    expect(viewModel.recentAccuracy.totalSteps).toBe(40);
    expect(viewModel.recentCaseReview[0]?.caseId).toBe("CASE_001");
  });

  it("uses deterministic ordering for trend windows and recent case review", () => {
    const attempts = [
      ...Array.from({ length: 10 }, (_, index) => createAttempt({
        id: `new-${String(index).padStart(2, "0")}`,
        caseId: `NEW_${index}`,
        correctSteps: 4,
        totalSteps: 4,
        completedAt: "2026-05-30T00:00:00.000Z"
      })),
      ...Array.from({ length: 10 }, (_, index) => createAttempt({
        id: `old-${String(index).padStart(2, "0")}`,
        caseId: `OLD_${index}`,
        correctSteps: 1,
        totalSteps: 4,
        completedAt: "2026-05-20T00:00:00.000Z"
      }))
    ];
    const viewModel = readyModel(attempts);

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.accuracyTrend).toMatchObject({
      recentPercent: 100,
      previousPercent: 25,
      deltaPercent: 75,
      direction: "improving"
    });
    expect(viewModel.recentCaseReview[0]?.caseId).toBe("NEW_9");
  });

  it("derives dynamic reasoning steps and ignores malformed step result entries", () => {
    const viewModel = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `attempt-${index}`,
      stepResults: [
        { key: "ph_status", correct: true },
        { key: "osmolar_gap", correct: index % 2 === 0 },
        { key: "malformed" },
        { correct: true },
        null
      ]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.reasoningStepAccuracy.map(step => step.stepKey)).toEqual(["ph_status", "osmolar_gap"]);
    expect(viewModel.reasoningStepAccuracy.find(step => step.stepKey === "osmolar_gap")).toMatchObject({
      label: "Osmolar Gap",
      attempts: 5,
      correct: 3
    });
  });

  it("uses only the most recent 50 attempts for reasoning step accuracy in deterministic order", () => {
    const attempts = Array.from({ length: INSIGHTS_STEP_ACCURACY_WINDOW + 1 }, (_, index) => createAttempt({
      id: `same-${String(index).padStart(2, "0")}`,
      completedAt: "2026-05-30T00:00:00.000Z",
      stepResults: [{ key: "ph_status", correct: index > 0 }]
    }));
    const viewModel = readyModel(attempts);

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.reasoningStepAccuracy).toEqual([
      expect.objectContaining({
        stepKey: "ph_status",
        attempts: INSIGHTS_STEP_ACCURACY_WINDOW,
        correct: INSIGHTS_STEP_ACCURACY_WINDOW,
        accuracyPercent: 100
      })
    ]);
  });

  it("keeps current focus based on the same last-50 reasoning step window", () => {
    const recentAttempts = Array.from({ length: INSIGHTS_STEP_ACCURACY_WINDOW }, (_, index) => createAttempt({
      id: `recent-${String(index).padStart(2, "0")}`,
      completedAt: `2026-05-${String(30 - Math.floor(index / 2)).padStart(2, "0")}T00:00:00.000Z`,
      stepResults: [
        { key: "ph_status", correct: index >= INSIGHTS_STEP_ACCURACY_WINDOW / 2 },
        { key: "compensation", correct: true }
      ]
    }));
    const olderAttempts = Array.from({ length: 10 }, (_, index) => createAttempt({
      id: `older-${index}`,
      completedAt: `2026-04-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
      stepResults: [
        { key: "diagnosis", correct: false }
      ]
    }));
    const viewModel = readyModel([...olderAttempts, ...recentAttempts]);

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.reasoningStepAccuracy.find(step => step.stepKey === "diagnosis")).toBeUndefined();
    expect(viewModel.currentFocus).toMatchObject({
      state: "available",
      stepKey: "ph_status",
      attempts: INSIGHTS_STEP_ACCURACY_WINDOW,
      accuracyPercent: 50
    });
  });

  it("skips diagnosis steps when selecting current focus", () => {
    const viewModel = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `diagnosis-focus-${index}`,
      stepResults: [
        { key: "diagnosis", correct: false },
        { key: "final_diagnosis", correct: false },
        { key: "primary_disorder", correct: index >= 2 },
        { key: "compensation", correct: true }
      ]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.reasoningStepAccuracy.find(step => step.stepKey === "diagnosis")).toMatchObject({
      accuracyPercent: 0
    });
    expect(viewModel.reasoningStepAccuracy.find(step => step.stepKey === "final_diagnosis")).toMatchObject({
      accuracyPercent: 0
    });
    expect(viewModel.currentFocus).toMatchObject({
      state: "available",
      stepKey: "primary_disorder",
      accuracyPercent: 60
    });
  });

  it("returns current focus only when a weakest step has enough data", () => {
    const insufficient = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `attempt-${index}`,
      stepResults: index < 2 ? [{ key: "compensation", correct: false }] : []
    })));
    const available = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `focus-${index}`,
      stepResults: [
        { key: "ph_status", correct: true },
        { key: "compensation", correct: index >= 4 }
      ]
    })));

    expect(insufficient.state).toBe("ready");
    expect(available.state).toBe("ready");
    if (insufficient.state !== "ready" || available.state !== "ready") return;
    expect(insufficient.currentFocus.state).toBe("insufficient_data");
    expect(available.currentFocus).toMatchObject({
      state: "available",
      stepKey: "compensation",
      label: "Compensation",
      attempts: 5,
      accuracyPercent: 20,
      explanation: currentFocusCopyRegistry.compensation
    });
  });

  it("adds current focus explanations for known and unknown step keys", () => {
    const known = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `known-focus-${index}`,
      stepResults: [
        { key: "primary_disorder", correct: index >= 4 },
        { key: "ph_status", correct: true }
      ]
    })));
    const unknown = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `unknown-focus-${index}`,
      stepResults: [
        { key: "future_reasoning_step", correct: index >= 4 },
        { key: "ph_status", correct: true }
      ]
    })));

    expect(known.state).toBe("ready");
    expect(unknown.state).toBe("ready");
    if (known.state !== "ready" || unknown.state !== "ready") return;
    expect(known.currentFocus).toMatchObject({
      state: "available",
      stepKey: "primary_disorder",
      explanation: currentFocusCopyRegistry.primary_disorder
    });
    expect(unknown.currentFocus).toMatchObject({
      state: "available",
      stepKey: "future_reasoning_step",
      explanation: CURRENT_FOCUS_FALLBACK_EXPLANATION
    });
  });

  it("keeps common miss patterns conservative and display-ready", () => {
    const insufficient = readyModel([
      ...Array.from({ length: MIN_COMMON_MISS_SAMPLE_SIZE - 1 }, (_, index) => createAttempt({
        id: `insufficient-${index}`,
        stepResults: [
          { key: "compensation", correct: index >= MIN_COMMON_MISS_COUNT }
        ]
      })),
      createAttempt({
        id: "other-context",
        clinicalPatternKey: "simple_respiratory_acidosis",
        stepResults: [{ key: "compensation", correct: true }]
      })
    ]);
    const available = readyModel(Array.from({ length: MIN_COMMON_MISS_SAMPLE_SIZE }, (_, index) => createAttempt({
      id: `available-${index}`,
      stepResults: [
        { key: "compensation", correct: index >= MIN_COMMON_MISS_COUNT }
      ]
    })));

    expect(insufficient.state).toBe("ready");
    expect(available.state).toBe("ready");
    if (insufficient.state !== "ready" || available.state !== "ready") return;
    expect(insufficient.commonMissPattern.state).toBe("insufficient_data");
    expect(available.commonMissPattern).toMatchObject({
      state: "available",
      stepKey: "compensation",
      stepLabel: "Compensation",
      contextKey: "metabolic_acidosis_cases",
      contextLabel: "metabolic acidosis cases",
      missCount: MIN_COMMON_MISS_COUNT,
      sampleSize: MIN_COMMON_MISS_SAMPLE_SIZE,
      missRatePercent: Math.round((MIN_COMMON_MISS_COUNT / MIN_COMMON_MISS_SAMPLE_SIZE) * 100),
      headline: "You seem more likely to miss compensation on metabolic acidosis cases.",
      tip: commonMissPatternCopy.tipsByPattern["compensation::metabolic_acidosis_cases"],
      detail: `Incorrect ${MIN_COMMON_MISS_COUNT}/${MIN_COMMON_MISS_SAMPLE_SIZE} (${Math.round((MIN_COMMON_MISS_COUNT / MIN_COMMON_MISS_SAMPLE_SIZE) * 100)}%) in this context`
    });
  });

  it("uses dedicated copy for non-compensation common miss patterns", () => {
    const viewModel = readyModel(Array.from({ length: MIN_COMMON_MISS_SAMPLE_SIZE }, (_, index) => createAttempt({
      id: `anion-gap-pattern-${index}`,
      clinicalPatternKey: "dka",
      stepResults: [{ key: "anion_gap", correct: index >= MIN_COMMON_MISS_COUNT }]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern).toMatchObject({
      state: "available",
      stepKey: "anion_gap",
      tip: commonMissPatternCopy.tips.anion_gap
    });
  });

  it("detects compensation patterns in metabolic alkalosis cases", () => {
    const viewModel = readyModel(Array.from({ length: MIN_COMMON_MISS_SAMPLE_SIZE }, (_, index) => createAttempt({
      id: `metabolic-alkalosis-pattern-${index}`,
      clinicalPatternKey: "simple_metabolic_alkalosis",
      stepResults: [{ key: "compensation", correct: index >= MIN_COMMON_MISS_COUNT }]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern).toMatchObject({
      state: "available",
      stepKey: "compensation",
      contextKey: "metabolic_alkalosis_cases",
      contextLabel: "metabolic alkalosis cases",
      tip: commonMissPatternCopy.tipsByPattern["compensation::metabolic_alkalosis_cases"]
    });
  });

  it("does not surface diagnosis-related common miss patterns", () => {
    const viewModel = readyModel(Array.from({ length: MIN_COMMON_MISS_SAMPLE_SIZE }, (_, index) => createAttempt({
      id: `diagnosis-pattern-${index}`,
      clinicalPatternKey: "mixed_hagma_metabolic_alkalosis",
      stepResults: [
        { key: "diagnosis", correct: false },
        { key: "final_diagnosis", correct: false }
      ]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern.state).toBe("none");
  });

  it("uses only the most recent 50 attempts for common miss patterns", () => {
    const viewModel = readyModel([
      ...Array.from({ length: 10 }, (_, index) => createAttempt({
        id: `older-miss-${index}`,
        completedAt: `2026-04-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
        stepResults: [{ key: "compensation", correct: false }]
      })),
      ...Array.from({ length: INSIGHTS_COMMON_MISS_WINDOW }, (_, index) => createAttempt({
        id: `recent-correct-${String(index).padStart(2, "0")}`,
        completedAt: "2026-05-30T00:00:00.000Z",
        stepResults: [{ key: "compensation", correct: true }]
      }))
    ]);

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern.state).toBe("none");
  });

  it("drops a previously detected pattern after recent improvement", () => {
    const priorPattern = readyModel(Array.from({ length: 10 }, (_, index) => createAttempt({
      id: `prior-${index}`,
      completedAt: `2026-05-${String(20 + index).padStart(2, "0")}T00:00:00.000Z`,
      stepResults: [{ key: "compensation", correct: index >= 5 }]
    })));
    const improved = readyModel([
      ...Array.from({ length: 10 }, (_, index) => createAttempt({
        id: `older-prior-${index}`,
        completedAt: `2026-04-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
        stepResults: [{ key: "compensation", correct: false }]
      })),
      ...Array.from({ length: INSIGHTS_COMMON_MISS_WINDOW }, (_, index) => createAttempt({
        id: `recent-improved-${String(index).padStart(2, "0")}`,
        completedAt: "2026-05-30T00:00:00.000Z",
        stepResults: [{ key: "compensation", correct: index < INSIGHTS_COMMON_MISS_WINDOW - 1 }]
      }))
    ]);

    expect(priorPattern.state).toBe("ready");
    expect(improved.state).toBe("ready");
    if (priorPattern.state !== "ready" || improved.state !== "ready") return;
    expect(priorPattern.commonMissPattern.state).toBe("available");
    expect(improved.commonMissPattern.state).toBe("insufficient_data");
  });

  it("counts common miss sample size only when the step is present and answerable", () => {
    const viewModel = readyModel([
      ...Array.from({ length: MIN_COMMON_MISS_SAMPLE_SIZE }, (_, index) => createAttempt({
        id: `answerable-${index}`,
        stepResults: [
          { key: "compensation", correct: index >= MIN_COMMON_MISS_COUNT },
          { key: "ph_status", correct: true }
        ]
      })),
      ...Array.from({ length: 10 }, (_, index) => createAttempt({
        id: `not-answerable-${index}`,
        stepResults: [{ key: "ph_status", correct: true }]
      }))
    ]);

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern).toMatchObject({
      state: "available",
      stepKey: "compensation",
      missCount: MIN_COMMON_MISS_COUNT,
      sampleSize: MIN_COMMON_MISS_SAMPLE_SIZE
    });
  });

  it("requires the common miss rate threshold inside the recent window", () => {
    const lowRate = readyModel(Array.from({ length: INSIGHTS_COMMON_MISS_WINDOW }, (_, index) => createAttempt({
      id: `low-rate-${String(index).padStart(2, "0")}`,
      completedAt: "2026-05-30T00:00:00.000Z",
      stepResults: [{ key: "compensation", correct: index >= MIN_COMMON_MISS_COUNT }]
    })));
    const highRate = readyModel(Array.from({ length: 10 }, (_, index) => createAttempt({
      id: `high-rate-${index}`,
      stepResults: [{ key: "compensation", correct: index >= 4 }]
    })));

    expect(lowRate.state).toBe("ready");
    expect(highRate.state).toBe("ready");
    if (lowRate.state !== "ready" || highRate.state !== "ready") return;
    expect(lowRate.commonMissPattern.state).toBe("insufficient_data");
    expect(highRate.commonMissPattern).toMatchObject({
      state: "available",
      missRatePercent: 40
    });
    expect((highRate.commonMissPattern.missRatePercent ?? 0)).toBeGreaterThanOrEqual(MIN_COMMON_MISS_RATE_PERCENT);
  });

  it("uses broad acid-base contexts and does not expose diagnosis-specific labels for common miss patterns", () => {
    const viewModel = readyModel(Array.from({ length: 10 }, (_, index) => createAttempt({
      id: `broad-context-${index}`,
      clinicalPatternKey: "uraemia",
      stepResults: [{ key: "anion_gap", correct: index >= 4 }]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern).toMatchObject({
      state: "available",
      contextLabel: "metabolic acidosis cases"
    });
    expect(JSON.stringify(viewModel.commonMissPattern)).not.toContain("uraemia");
    expect(JSON.stringify(viewModel.commonMissPattern)).not.toContain("Uraemia");
    expect(JSON.stringify(viewModel.commonMissPattern)).not.toContain("Diabetic ketoacidosis");
    expect(JSON.stringify(viewModel.commonMissPattern)).not.toContain("Salicylate");
  });

  it("prefers clinically useful priority patterns over less useful qualifying pairs", () => {
    const viewModel = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `priority-${index}`,
      clinicalPatternKey: "simple_respiratory_acidosis",
      stepResults: [
        { key: "compensation", correct: index >= 2 },
        { key: "future_edge_step", correct: false }
      ]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern).toMatchObject({
      state: "available",
      stepKey: "compensation",
      contextLabel: "respiratory cases",
      tip: commonMissPatternCopy.tipsByPattern["compensation::respiratory_cases"]
    });
  });

  it("ignores unmapped attempts for common miss patterns", () => {
    const viewModel = readyModel(Array.from({ length: 10 }, (_, index) => createAttempt({
      id: `unmapped-common-miss-${index}`,
      clinicalPatternKey: "unmapped_secret_pattern",
      stepResults: [{ key: "compensation", correct: false }]
    })));

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.commonMissPattern.state).toBe("none");
  });

  it("uses display-safe clinical pattern labels and never exposes raw internal pattern keys", () => {
    const viewModel = readyModel([
      ...Array.from({ length: 3 }, (_, index) => createAttempt({
        id: `mapped-${index}`,
        clinicalPatternKey: "dka_vomiting"
      })),
      ...Array.from({ length: 2 }, (_, index) => createAttempt({
        id: `unmapped-${index}`,
        clinicalPatternKey: "unmapped_secret_pattern"
      }))
    ], {
      availableCases: [
        {
          case_id: "A",
          difficulty_label: "beginner",
          archetype: "dka_vomiting",
          display: {
            gas_summary: {
              main: "Mixed Disorder",
              sub: "HAGMA + Metabolic Alkalosis"
            }
          }
        },
        { case_id: "B", difficulty_label: "beginner", archetype: "unseen_secret_pattern" }
      ]
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.clinicalPatternCoverage.totalCount).toBe(2);
    expect(viewModel.clinicalPatternCoverage.encounteredPatterns).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "HAGMA + Metabolic Alkalosis" }),
      expect.objectContaining({ label: "Featured Case" })
    ]));
    expect(JSON.stringify(viewModel)).not.toContain("dka_vomiting");
    expect(JSON.stringify(viewModel)).not.toContain("unmapped_secret_pattern");
    expect(JSON.stringify(viewModel)).not.toContain("unseen_secret_pattern");
    expect(JSON.stringify(viewModel)).not.toContain("archetype");
  });

  it("scopes clinical pattern coverage to the current displayed difficulty", () => {
    const viewModel = readyModel([
      ...Array.from({ length: 3 }, (_, index) => createAttempt({
        id: `advanced-pattern-${index}`,
        difficulty: "advanced",
        difficultyLevel: 3,
        clinicalPatternKey: "dka"
      })),
      createAttempt({
        id: "advanced-pattern-3",
        difficulty: "advanced",
        difficultyLevel: 3,
        clinicalPatternKey: "uraemia"
      }),
      createAttempt({
        id: "beginner-pattern",
        difficulty: "beginner",
        difficultyLevel: 1,
        clinicalPatternKey: "simple_nagma"
      })
    ], {
      userState: {
        intermediateUnlockedAt: "2026-05-01T00:00:00.000Z",
        advancedUnlockedAt: "2026-05-02T00:00:00.000Z",
        unlockedDifficulties: ["beginner", "intermediate", "advanced"]
      },
      availableCases: [
        {
          case_id: "A",
          difficulty_label: "advanced",
          archetype: "dka",
          display: {
            gas_summary: {
              main: "HAGMA",
              sub: "Diabetic Ketoacidosis"
            }
          }
        },
        {
          case_id: "B",
          difficulty_label: "advanced",
          archetype: "uraemia",
          display: {
            gas_summary: {
              main: "HAGMA",
              sub: "Uraemic acidosis"
            }
          }
        },
        {
          case_id: "C",
          difficulty_label: "beginner",
          archetype: "simple_nagma",
          display: {
            gas_summary: {
              main: "Metabolic acidosis",
              sub: "GI bicarbonate loss"
            }
          }
        }
      ]
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.currentLevelLabel).toBe("Advanced");
    expect(viewModel.clinicalPatternCoverage.encounteredCount).toBe(2);
    expect(viewModel.clinicalPatternCoverage.totalCount).toBe(2);
    expect(viewModel.clinicalPatternCoverage.encounteredPatterns.map(pattern => pattern.label)).toEqual([
      "Diabetic Ketoacidosis",
      "Uraemic acidosis"
    ]);
    expect(JSON.stringify(viewModel.clinicalPatternCoverage)).not.toContain("Normal anion gap metabolic acidosis");
  });

  it("uses gas summary subheadings for recent case review labels", () => {
    const viewModel = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `recent-gas-label-${index}`,
      caseId: index === 0 ? "DKA_VOMIT_001" : `CASE_${index}`,
      completedAt: index === 0 ? "2026-05-31T00:00:00.000Z" : `2026-05-2${index}T00:00:00.000Z`,
      clinicalPatternKey: index === 0 ? "dka_vomiting" : "dka"
    })), {
      availableCases: [
        {
          case_id: "DKA_VOMIT_001",
          archetype: "dka_vomiting",
          display: {
            gas_summary: {
              main: "Mixed Disorder",
              sub: "HAGMA + Metabolic Alkalosis"
            }
          }
        }
      ]
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.recentCaseReview[0]?.clinicalPatternLabel).toBe("HAGMA + Metabolic Alkalosis");
  });

  it("uses archetype-matched gas summary subheadings for recent cases when exact case id is unavailable", () => {
    const viewModel = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `recent-archetype-gas-label-${index}`,
      caseId: index === 0 ? "RESP_ACID_HAGMA_999" : `CASE_${index}`,
      difficulty: index === 0 ? "master" : "beginner",
      difficultyLevel: index === 0 ? 4 : 1,
      completedAt: index === 0 ? "2026-05-31T00:00:00.000Z" : `2026-05-2${index}T00:00:00.000Z`,
      clinicalPatternKey: index === 0 ? "respiratory_acidosis_hagma" : "dka"
    })), {
      availableCases: [
        {
          case_id: "RESP_ACID_HAGMA_001",
          difficulty_label: "master",
          archetype: "respiratory_acidosis_hagma",
          display: {
            gas_summary: {
              main: "Mixed Disorder",
              sub: "HAGMA + Respiratory Acidosis"
            }
          }
        }
      ]
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.recentCaseReview[0]?.clinicalPatternLabel).toBe("HAGMA + Respiratory Acidosis");
  });

  it("adds display metadata for recent authored ABG cases from the available case catalogue", () => {
    const viewModel = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `metadata-${index}`,
      caseId: index === 0 ? "AUTHORED_ABG_001" : `CASE_${index}`,
      completedAt: index === 0 ? "2026-05-31T00:00:00.000Z" : `2026-05-2${index}T00:00:00.000Z`
    })), {
      availableCases: [
        {
          case_id: "AUTHORED_ABG_001",
          source_type: "authored",
          case_features: ["true_abg", "oxygenation_focus"]
        }
      ]
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.recentCaseReview[0]).toMatchObject({
      caseId: "AUTHORED_ABG_001",
      caseMetadata: {
        source_type: "authored",
        case_features: ["true_abg", "oxygenation_focus"]
      }
    });
  });

  it("adds authored metadata from protected-runtime case ids when the case catalogue is empty", () => {
    const authored = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `authored-runtime-${index}`,
      caseId: index === 0 ? "authored_001" : `CASE_${index}`,
      completedAt: index === 0 ? "2026-05-31T00:00:00.000Z" : `2026-05-2${index}T00:00:00.000Z`
    })), {
      availableCases: []
    });
    const authoredAbg = readyModel(Array.from({ length: 5 }, (_, index) => createAttempt({
      id: `authored-abg-runtime-${index}`,
      caseId: index === 0 ? "AUTHORED_005" : `CASE_${index}`,
      completedAt: index === 0 ? "2026-05-31T00:00:00.000Z" : `2026-05-2${index}T00:00:00.000Z`
    })), {
      availableCases: []
    });

    expect(authored.state).toBe("ready");
    expect(authoredAbg.state).toBe("ready");
    if (authored.state !== "ready" || authoredAbg.state !== "ready") return;
    expect(authored.recentCaseReview[0]?.caseMetadata).toEqual({ source_type: "authored" });
    expect(authoredAbg.recentCaseReview[0]?.caseMetadata).toEqual({
      source_type: "authored",
      case_features: ["true_abg", "oxygenation_focus"]
    });
  });

  it("groups difficulty progress without requiring every difficulty", () => {
    const viewModel = readyModel([
      ...Array.from({ length: 3 }, (_, index) => createAttempt({
        id: `beginner-${index}`,
        difficulty: "beginner",
        correctSteps: 4,
        totalSteps: 4
      })),
      ...Array.from({ length: 2 }, (_, index) => createAttempt({
        id: `advanced-${index}`,
        difficulty: "advanced",
        correctSteps: 2,
        totalSteps: 4
      }))
    ]);

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.difficultyProgress).toEqual([
      expect.objectContaining({ difficulty: "beginner", completedCount: 3, allTimeAccuracyPercent: 100, enoughData: true }),
      expect.objectContaining({ difficulty: "advanced", completedCount: 2, allTimeAccuracyPercent: 50, enoughData: false })
    ]);
    expect(viewModel.difficultyProgress.some(item => item.difficulty === "master")).toBe(false);
  });

  it("aligns unlock readiness with recent eligible attempts in deterministic order", () => {
    const progressionConfig: ProgressionConfig = {
      difficulty_unlock_levels: { 3: 10, 4: 15 },
      performance_unlock_requirements: {
        advanced: { lastCases: 5, minStepAccuracyPercent: 75, requiredDifficulty: "any_practice" }
      },
      xp_required_per_level: { 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 100, 8: 100, 9: 100, 10: 100 }
    };
    const attempts = [
      ...Array.from({ length: 5 }, (_, index) => createAttempt({
        id: `new-${index}`,
        correctSteps: 4,
        totalSteps: 4,
        completedAt: "2026-05-30T00:00:00.000Z"
      })),
      ...Array.from({ length: 5 }, (_, index) => createAttempt({
        id: `old-${index}`,
        correctSteps: 0,
        totalSteps: 4,
        completedAt: "2026-05-20T00:00:00.000Z"
      }))
    ];
    const viewModel = readyModel(attempts, {
      userState: { xp: 899, level: 9 },
      progressionConfig
    });

    expect(viewModel.state).toBe("ready");
    if (viewModel.state !== "ready") return;
    expect(viewModel.unlockReadiness).toMatchObject({
      state: "available",
      nextDifficulty: "advanced",
      currentPercent: 100,
      requiredPercent: 75,
      eligibleAttemptsUsed: 5,
      requiredAttempts: 5,
      status: "ready"
    });
  });

  it("fetches attempts with the same filters and deterministic ordering used by insights", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const query = {
      select: vi.fn((...args: unknown[]) => {
        calls.push(["select", ...args]);
        return query;
      }),
      eq: vi.fn((...args: unknown[]) => {
        calls.push(["eq", ...args]);
        return query;
      }),
      not: vi.fn((...args: unknown[]) => {
        calls.push(["not", ...args]);
        return query;
      }),
      order: vi.fn((...args: unknown[]) => {
        calls.push(["order", ...args]);
        return query;
      }),
      limit: vi.fn(async (...args: unknown[]) => {
        calls.push(["limit", ...args]);
        return {
          data: [createAttempt({
            id: "attempt-001",
            caseId: "CASE_001"
          })].map(attempt => ({
            id: attempt.id,
            case_id: attempt.caseId,
            archetype: attempt.clinicalPatternKey,
            difficulty_label: attempt.difficulty,
            difficulty_level: attempt.difficultyLevel,
            correct_steps: attempt.correctSteps,
            total_steps: attempt.totalSteps,
            accuracy_percent: attempt.accuracyPercent,
            final_diagnosis_correct: attempt.finalDiagnosisCorrect,
            step_results_json: attempt.stepResults,
            completed_at: attempt.completedAt,
            content_version: attempt.contentVersion
          })),
          error: null,
          count: 1
        };
      })
    };
    const supabase = {
      from: vi.fn((table: string) => {
        calls.push(["from", table]);
        return query;
      })
    };

    const result = await fetchInsightsAttempts({
      supabase: supabase as never,
      userId: "user-1",
      progressionConfig: { version: "v9", beta_release_number: 7 }
    });

    expect(result.totalAttemptCount).toBe(1);
    expect(calls).toEqual(expect.arrayContaining([
      ["from", "attempts"],
      ["eq", "user_id", "user-1"],
      ["eq", "mode", "practice"],
      ["eq", "progression_version", "v9"],
      ["eq", "beta_release_number", 7],
      ["not", "completed_at", "is", null],
      ["order", "completed_at", { ascending: false }],
      ["order", "id", { ascending: false }]
    ]));
  });
});
