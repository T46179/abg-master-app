import { describe, expect, it } from "vitest";
import type { BloodGasBlitzAttemptResult } from "../minigames/BloodGasBlitz";
import {
  calibrationFlowReducer,
  canUseCalibrationContinueCta,
  createInitialCalibrationFlowState,
  getCalibrationContinueOutcome
} from "./useCalibrationFlow";

const blitzResult: BloodGasBlitzAttemptResult = {
  gameId: "blood-gas-blitz",
  versionId: "ph-classification-v1",
  placement: "onboarding-calibration",
  startedAt: "2026-05-06T00:00:00.000Z",
  completedAt: "2026-05-06T00:00:10.000Z",
  correctCount: 9,
  totalQuestions: 10,
  elapsedMs: 10000,
  accuracy: 90,
  averageMsPerQuestion: 1000,
  maxStreak: 5,
  answers: []
};

describe("calibration flow", () => {
  it("starts on Blood Gas Blitz", () => {
    const state = createInitialCalibrationFlowState(1000);

    expect(state.phase).toBe("blood-gas-blitz");
    expect(state.phaseStartedAt).toBe(1000);
    expect(state.canContinueCurrentStep).toBe(false);
    expect(state.placement).toBe("intermediate");
    expect(canUseCalibrationContinueCta(state)).toBe(true);
  });

  it("advances phases in order", () => {
    let state = createInitialCalibrationFlowState(1000);

    state = calibrationFlowReducer(state, { type: "continue", now: 2000 });
    expect(state.phase).toBe("build-a-gas");

    state = calibrationFlowReducer(state, {
      type: "setBuildAGasSelection",
      selection: { pH: "7.28", PaCO2: "28", HCO3: "14" }
    });
    state = calibrationFlowReducer(state, { type: "continue", now: 3000 });
    expect(state.phase).toBe("compensation-check");

    state = calibrationFlowReducer(state, { type: "setCompensationFitSelection", answer: "Appropriate compensation" });
    state = calibrationFlowReducer(state, { type: "continue", now: 4000 });
    expect(state.phase).toBe("mixed-process-challenge");

    state = calibrationFlowReducer(state, { type: "setFinalDiagnosisSelection", answer: "Raised anion gap metabolic acidosis" });
    state = calibrationFlowReducer(state, { type: "continue", now: 5000 });
    expect(state.phase).toBe("analysing-sample");

    state = calibrationFlowReducer(state, { type: "continue", now: 6000 });
    expect(state.phase).toBe("result");
  });

  it("resets can-continue and phase timing on phase change", () => {
    let state = createInitialCalibrationFlowState(1000);

    state = calibrationFlowReducer(state, { type: "setCanContinue", canContinue: true });
    expect(state.canContinueCurrentStep).toBe(true);

    state = calibrationFlowReducer(state, { type: "continue", now: 2500 });

    expect(state.phase).toBe("build-a-gas");
    expect(state.canContinueCurrentStep).toBe(false);
    expect(state.phaseStartedAt).toBe(2500);
  });

  it("records step results without app side effects", () => {
    let state = createInitialCalibrationFlowState(1000);

    state = calibrationFlowReducer(state, { type: "recordBloodGasBlitzResult", result: blitzResult });
    expect(state.bloodGasBlitzResult).toBe(blitzResult);
    expect(state.calibrationResults.bloodGasBlitz).toBe(blitzResult);

    state = calibrationFlowReducer(state, { type: "continue", now: 2000 });
    state = calibrationFlowReducer(state, {
      type: "setBuildAGasSelection",
      selection: { pH: "7.28", PaCO2: "28", HCO3: "14" }
    });
    state = calibrationFlowReducer(state, { type: "continue", now: 4500 });

    expect(state.calibrationResults.buildAGas).toEqual({
      selectedValues: { pH: "7.28", PaCO2: "28", HCO3: "14" },
      elapsedMs: 2500
    });

    state = calibrationFlowReducer(state, { type: "setCompensationFitSelection", answer: "Appropriate compensation" });
    state = calibrationFlowReducer(state, { type: "continue", now: 6000 });

    expect(state.calibrationResults.compensationFit).toEqual({
      selectedAnswer: "Appropriate compensation",
      elapsedMs: 1500
    });
  });

  it("computes the same final placement as the current calibration path", () => {
    let state = createInitialCalibrationFlowState(1000);

    state = calibrationFlowReducer(state, { type: "continue", now: 2000 });
    state = calibrationFlowReducer(state, {
      type: "setBuildAGasSelection",
      selection: { pH: "7.28", PaCO2: "28", HCO3: "14" }
    });
    state = calibrationFlowReducer(state, { type: "continue", now: 3000 });
    state = calibrationFlowReducer(state, { type: "setCompensationFitSelection", answer: "Appropriate compensation" });
    state = calibrationFlowReducer(state, { type: "continue", now: 4000 });
    state = calibrationFlowReducer(state, { type: "setFinalDiagnosisSelection", answer: "Raised anion gap metabolic acidosis" });

    const outcome = getCalibrationContinueOutcome(state, 5000);

    expect(outcome.completion).toMatchObject({
      placement: "advanced",
      results: {
        finalDiagnosis: {
          selectedAnswer: "Raised anion gap metabolic acidosis",
          elapsedMs: 1000
        }
      }
    });
    expect(outcome.nextState.placement).toBe("advanced");
    expect(outcome.nextState.phase).toBe("analysing-sample");
  });
});
