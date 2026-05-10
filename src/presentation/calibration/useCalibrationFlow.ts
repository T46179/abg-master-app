import { useCallback, useReducer } from "react";
import type { CalibrationPlacement } from "../../core/types";
import type { BloodGasBlitzAttemptResult } from "../minigames/BloodGasBlitz";
import {
  getCalibrationStep,
  getNextCalibrationPhase,
  requiresCalibrationAnswerToContinue
} from "./calibrationConfig";
import {
  scoreCalibration,
  type CalibrationScoringInput
} from "./calibrationScoring";
import type { BuildAGasCalibrationSelection, CalibrationPhase } from "./calibrationTypes";

export interface CalibrationCompletionOutcome {
  placement: CalibrationPlacement;
  results: CalibrationScoringInput;
}

export interface CalibrationFlowState {
  phase: CalibrationPhase;
  canContinueCurrentStep: boolean;
  bloodGasBlitzResult: BloodGasBlitzAttemptResult | null;
  buildAGasSelection: BuildAGasCalibrationSelection;
  compensationFitSelection: string | null;
  finalDiagnosisSelection: string | null;
  calibrationResults: CalibrationScoringInput;
  placement: CalibrationPlacement;
  phaseStartedAt: number;
}

type CalibrationFlowAction =
  | { type: "setCanContinue"; canContinue: boolean }
  | { type: "recordBloodGasBlitzResult"; result: BloodGasBlitzAttemptResult }
  | { type: "setBuildAGasSelection"; selection: BuildAGasCalibrationSelection }
  | { type: "setCompensationFitSelection"; answer: string | null }
  | { type: "setFinalDiagnosisSelection"; answer: string | null }
  | { type: "continue"; now: number };

export function createInitialCalibrationFlowState(now = Date.now()): CalibrationFlowState {
  return {
    phase: "blood-gas-blitz",
    canContinueCurrentStep: false,
    bloodGasBlitzResult: null,
    buildAGasSelection: {},
    compensationFitSelection: null,
    finalDiagnosisSelection: null,
    calibrationResults: {},
    placement: "intermediate",
    phaseStartedAt: now
  };
}

export function canUseCalibrationContinueCta(state: Pick<CalibrationFlowState, "phase" | "canContinueCurrentStep">): boolean {
  return !requiresCalibrationAnswerToContinue(state.phase) || state.canContinueCurrentStep;
}

function advanceCalibrationPhase(state: CalibrationFlowState, now: number): CalibrationFlowState {
  const nextPhase = getNextCalibrationPhase(state.phase);
  if (!nextPhase) return state;

  return {
    ...state,
    phase: nextPhase,
    canContinueCurrentStep: false,
    phaseStartedAt: now
  };
}

export function getCalibrationContinueOutcome(
  state: CalibrationFlowState,
  now: number
): { nextState: CalibrationFlowState; completion: CalibrationCompletionOutcome | null } {
  const elapsedMs = now - state.phaseStartedAt;

  if (state.phase === "build-a-gas") {
    return {
      nextState: advanceCalibrationPhase({
        ...state,
        calibrationResults: {
          ...state.calibrationResults,
          buildAGas: {
            selectedValues: state.buildAGasSelection,
            elapsedMs
          }
        }
      }, now),
      completion: null
    };
  }

  if (state.phase === "compensation-check" && state.compensationFitSelection) {
    return {
      nextState: advanceCalibrationPhase({
        ...state,
        calibrationResults: {
          ...state.calibrationResults,
          compensationFit: {
            selectedAnswer: state.compensationFitSelection,
            elapsedMs
          }
        }
      }, now),
      completion: null
    };
  }

  if (state.phase === "mixed-process-challenge" && state.finalDiagnosisSelection) {
    const nextResults: CalibrationScoringInput = {
      ...state.calibrationResults,
      bloodGasBlitz: state.bloodGasBlitzResult,
      finalDiagnosis: {
        selectedAnswer: state.finalDiagnosisSelection,
        elapsedMs
      }
    };
    const nextPlacement = scoreCalibration(nextResults).placement;

    return {
      nextState: advanceCalibrationPhase({
        ...state,
        calibrationResults: nextResults,
        placement: nextPlacement
      }, now),
      completion: {
        placement: nextPlacement,
        results: nextResults
      }
    };
  }

  return {
    nextState: advanceCalibrationPhase(state, now),
    completion: null
  };
}

export function calibrationFlowReducer(
  state: CalibrationFlowState,
  action: CalibrationFlowAction
): CalibrationFlowState {
  if (action.type === "setCanContinue") {
    return {
      ...state,
      canContinueCurrentStep: action.canContinue
    };
  }

  if (action.type === "recordBloodGasBlitzResult") {
    return {
      ...state,
      bloodGasBlitzResult: action.result,
      calibrationResults: {
        ...state.calibrationResults,
        bloodGasBlitz: action.result
      }
    };
  }

  if (action.type === "setBuildAGasSelection") {
    return {
      ...state,
      buildAGasSelection: action.selection
    };
  }

  if (action.type === "setCompensationFitSelection") {
    return {
      ...state,
      compensationFitSelection: action.answer
    };
  }

  if (action.type === "setFinalDiagnosisSelection") {
    return {
      ...state,
      finalDiagnosisSelection: action.answer
    };
  }

  return getCalibrationContinueOutcome(state, action.now).nextState;
}

export function useCalibrationFlow() {
  const [flowState, dispatch] = useReducer(
    calibrationFlowReducer,
    undefined,
    () => createInitialCalibrationFlowState()
  );

  const setCanContinueCurrentStep = useCallback((canContinue: boolean) => {
    dispatch({ type: "setCanContinue", canContinue });
  }, []);

  const recordBloodGasBlitzResult = useCallback((result: BloodGasBlitzAttemptResult) => {
    dispatch({ type: "recordBloodGasBlitzResult", result });
  }, []);

  const setBuildAGasSelection = useCallback((selection: BuildAGasCalibrationSelection) => {
    dispatch({ type: "setBuildAGasSelection", selection });
  }, []);

  const setCompensationFitSelection = useCallback((answer: string | null) => {
    dispatch({ type: "setCompensationFitSelection", answer });
  }, []);

  const setFinalDiagnosisSelection = useCallback((answer: string | null) => {
    dispatch({ type: "setFinalDiagnosisSelection", answer });
  }, []);

  const continueCurrentPhase = useCallback(() => {
    const now = Date.now();
    const outcome = getCalibrationContinueOutcome(flowState, now);
    dispatch({ type: "continue", now });
    return outcome.completion;
  }, [flowState]);

  return {
    ...flowState,
    step: getCalibrationStep(flowState.phase),
    canUseContinueCta: canUseCalibrationContinueCta(flowState),
    setCanContinueCurrentStep,
    recordBloodGasBlitzResult,
    setBuildAGasSelection,
    setCompensationFitSelection,
    setFinalDiagnosisSelection,
    continueCurrentPhase
  };
}
