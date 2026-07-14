import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { CALIBRATION_COMPLETION_VERSION, createCalibrationCompletionRecord } from "../../core/calibration";
import { trackEvent } from "../../core/analytics";
import { mapProgressRowToUserState, syncUserStateDerivedFields } from "../../core/progression";
import { completeCalibrationProgress } from "../../core/progressionSync";
import type { CalibrationPlacement } from "../../core/types";
import { getCalibrationSubtitle } from "./calibrationConfig";
import { AnalysingSampleCalibrationStep } from "./AnalysingSampleCalibrationStep";
import { BuildAGasCalibrationStep } from "./BuildAGasCalibrationStep";
import { CalibrationBloodGasBlitzStep } from "./CalibrationBloodGasBlitzStep";
import { CalibrationProgressHeader } from "./CalibrationProgressHeader";
import { CalibrationStepShell } from "./CalibrationStepShell";
import { CalibrationSummaryStep } from "./CalibrationSummaryStep";
import { CompensationCheckCalibrationStep } from "./CompensationCheckCalibrationStep";
import { MixedProcessCalibrationStep } from "./MixedProcessCalibrationStep";
import { scoreCalibration, type CalibrationScoringInput } from "./calibrationScoring";
import type { CalibrationPhase } from "./calibrationTypes";
import { useCalibrationFlow } from "./useCalibrationFlow";

const CALIBRATION_ANALYTICS_VERSION = "1";
const CALIBRATION_TOTAL_SCORE_MAX = 12;
const CALIBRATION_SUBMIT_DELAY_MS = 800;
const CALIBRATION_PLACEMENTS: CalibrationPlacement[] = ["beginner", "intermediate", "advanced"];

const CALIBRATION_ANALYTICS_STEPS: Partial<Record<CalibrationPhase, {
  stepId: string;
  stepNumber: number;
  maxScore: number;
}>> = {
  "blood-gas-blitz": { stepId: "blood_gas_blitz", stepNumber: 1, maxScore: 2 },
  "build-a-gas": { stepId: "build_a_gas", stepNumber: 2, maxScore: 3 },
  "compensation-check": { stepId: "compensation_check", stepNumber: 3, maxScore: 3 },
  "mixed-process-challenge": { stepId: "mixed_process", stepNumber: 4, maxScore: 4 }
};

function createCalibrationAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function roundPercent(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function roundSeconds(elapsedMs: number | undefined): number | null {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs)) return null;
  return Math.round(Math.max(0, elapsedMs) / 10) / 100;
}

export function CalibrationScreen() {
  const { state, setUserState } = useAppContext();
  const navigate = useNavigate();
  const calibrationFlow = useCalibrationFlow();
  const { phase, placement, step, canUseContinueCta } = calibrationFlow;
  const subtitle = getCalibrationSubtitle(phase);
  const startedEventFiredRef = useRef(false);
  const completedStepIdsRef = useRef(new Set<string>());
  const completedEventFiredRef = useRef(false);
  const calibrationAttemptIdRef = useRef<string | null>(null);
  const submitDelayTimerRef = useRef<number | null>(null);
  const [isSubmittingFinalStep, setIsSubmittingFinalStep] = useState(false);

  function createCurrentCalibrationAttemptId() {
    calibrationAttemptIdRef.current ??= createCalibrationAttemptId();
    return calibrationAttemptIdRef.current;
  }

  function buildCalibrationAnalyticsPayload() {
    const calibrationAttemptId = calibrationAttemptIdRef.current;
    if (!calibrationAttemptId) return null;

    return {
      version: CALIBRATION_ANALYTICS_VERSION,
      placement_version: String(CALIBRATION_COMPLETION_VERSION),
      calibration_attempt_id: calibrationAttemptId
    };
  }

  function trackCalibrationStarted() {
    if (startedEventFiredRef.current) return;
    createCurrentCalibrationAttemptId();
    const payload = buildCalibrationAnalyticsPayload();
    if (!payload) return;

    startedEventFiredRef.current = true;
    trackEvent("calibration_started", payload);
  }

  function trackCalibrationStepCompleted(
    completedPhase: CalibrationPhase,
    options: { scorePercent?: number | null; elapsedMs?: number | null } = {}
  ) {
    const stepMeta = CALIBRATION_ANALYTICS_STEPS[completedPhase];
    if (!stepMeta || completedStepIdsRef.current.has(stepMeta.stepId)) return;

    const payload = buildCalibrationAnalyticsPayload();
    if (!payload) return;

    const nextPayload: Record<string, unknown> = {
      ...payload,
      step_id: stepMeta.stepId,
      step_number: stepMeta.stepNumber
    };
    const scorePercent = typeof options.scorePercent === "number" ? roundPercent(options.scorePercent) : null;
    const timeTakenSeconds = roundSeconds(options.elapsedMs ?? undefined);

    if (typeof options.scorePercent === "number") {
      if (scorePercent === null) return;
      nextPayload.score_percent = scorePercent;
    }

    if (typeof options.elapsedMs === "number") {
      if (timeTakenSeconds === null) return;
      nextPayload.time_taken_seconds = timeTakenSeconds;
    }

    completedStepIdsRef.current.add(stepMeta.stepId);
    trackEvent("calibration_step_completed", nextPayload);
  }

  function getSingleStepScorePercent(completedPhase: CalibrationPhase, results: CalibrationScoringInput) {
    const stepMeta = CALIBRATION_ANALYTICS_STEPS[completedPhase];
    if (!stepMeta) return null;

    const totalScore = scoreCalibration(results).totalScore;
    if (!Number.isFinite(totalScore)) return null;

    return (totalScore / stepMeta.maxScore) * 100;
  }

  function trackCalibrationCompleted(nextPlacement: CalibrationPlacement, nextResults: CalibrationScoringInput) {
    if (completedEventFiredRef.current || !CALIBRATION_PLACEMENTS.includes(nextPlacement)) return;
    const payload = buildCalibrationAnalyticsPayload();
    if (!payload) return;

    const score = scoreCalibration(nextResults);
    if (!Number.isFinite(score.totalScore)) return;
    const scorePercent = roundPercent((score.totalScore / CALIBRATION_TOTAL_SCORE_MAX) * 100);
    if (scorePercent === null) return;

    completedEventFiredRef.current = true;
    trackEvent("calibration_completed", {
      ...payload,
      placement: nextPlacement,
      score_total: score.totalScore,
      score_percent: scorePercent
    });
  }

  useEffect(() => {
    const completion = state.storage?.loadCalibrationCompletion();
    if (!completion) return;
    navigate(`/practice?difficulty=${completion.placement}`, { replace: true });
  }, [navigate, state.storage]);

  useEffect(() => () => {
    if (submitDelayTimerRef.current !== null) {
      window.clearTimeout(submitDelayTimerRef.current);
    }
  }, []);

  async function syncCalibrationCompletion(nextPlacement: CalibrationPlacement, nextResults: CalibrationScoringInput) {
    const completion = createCalibrationCompletionRecord(nextPlacement);

    state.storage?.saveCalibrationCompletion(completion);
    if (!state.supabase) return;

    try {
      const progress = await completeCalibrationProgress({
        supabase: state.supabase,
        progressionConfig: state.payload?.progressionConfig ?? null,
        placement: nextPlacement,
        completion,
        attemptPayload: {
          bloodGasBlitz: nextResults.bloodGasBlitz,
          buildAGas: nextResults.buildAGas,
          compensationFit: nextResults.compensationFit,
          finalDiagnosis: nextResults.finalDiagnosis
        }
      });
      const progressPatch = mapProgressRowToUserState(progress);
      if (progressPatch) {
        await setUserState(syncUserStateDerivedFields({
          ...state.userState,
          ...progressPatch
        }, state.payload?.progressionConfig ?? null));
      }
    } catch {
      // Keep the local calibration completion so users can continue if sync is temporarily unavailable.
    }
  }

  function completeCurrentPhase(completedAt?: number) {
    const completedPhase = phase;
    const completion = calibrationFlow.continueCurrentPhase(completedAt);
    if (completedPhase === "build-a-gas") {
      const buildAGasResult = {
        selectedValues: calibrationFlow.buildAGasSelection,
        elapsedMs: Date.now() - calibrationFlow.phaseStartedAt
      };
      trackCalibrationStepCompleted(completedPhase, {
        scorePercent: getSingleStepScorePercent(completedPhase, { buildAGas: buildAGasResult }),
        elapsedMs: buildAGasResult.elapsedMs
      });
    } else if (completedPhase === "compensation-check" && calibrationFlow.compensationFitSelection) {
      const compensationFitResult = {
        selectedAnswer: calibrationFlow.compensationFitSelection,
        elapsedMs: Date.now() - calibrationFlow.phaseStartedAt
      };
      trackCalibrationStepCompleted(completedPhase, {
        scorePercent: getSingleStepScorePercent(completedPhase, { compensationFit: compensationFitResult }),
        elapsedMs: compensationFitResult.elapsedMs
      });
    } else if (completedPhase === "mixed-process-challenge" && completion?.results.finalDiagnosis) {
      trackCalibrationStepCompleted(completedPhase, {
        scorePercent: getSingleStepScorePercent(completedPhase, { finalDiagnosis: completion.results.finalDiagnosis }),
        elapsedMs: completion.results.finalDiagnosis.elapsedMs
      });
    }

    if (completion) {
      trackCalibrationCompleted(completion.placement, completion.results);
      void syncCalibrationCompletion(completion.placement, completion.results);
    }
  }

  function handleContinue() {
    completeCurrentPhase();
  }

  function handleFinalSubmit() {
    if (isSubmittingFinalStep || !canUseContinueCta) return;

    const submittedAt = Date.now();
    setIsSubmittingFinalStep(true);
    submitDelayTimerRef.current = window.setTimeout(() => {
      submitDelayTimerRef.current = null;
      completeCurrentPhase(submittedAt);
    }, CALIBRATION_SUBMIT_DELAY_MS);
  }

  function handleStartDifficulty(difficulty: string) {
    navigate(`/practice?difficulty=${difficulty}`);
  }

  if (phase === "analysing-sample") {
    return (
      <main className="app-shell__page calibration-screen calibration-screen--empty">
        <AnalysingSampleCalibrationStep onComplete={handleContinue} />
      </main>
    );
  }

  if (phase === "result") {
    return (
      <main className="app-shell__page calibration-screen calibration-screen--empty">
        <CalibrationSummaryStep
          placement={placement}
          onStartDifficulty={handleStartDifficulty}
        />
      </main>
    );
  }

  function renderStepContent() {
    if (phase === "blood-gas-blitz") {
      return (
        <CalibrationBloodGasBlitzStep
          onPhaseChange={(nextPhase) => {
            if (nextPhase === "countdown" || nextPhase === "playing") trackCalibrationStarted();
          }}
          onResult={(result) => {
            calibrationFlow.recordBloodGasBlitzResult(result);
            const scorePercent = result.totalQuestions > 0
              ? (result.correctCount / result.totalQuestions) * 100
              : null;
            trackCalibrationStepCompleted("blood-gas-blitz", {
              scorePercent,
              elapsedMs: result.elapsedMs
            });
          }}
          onComplete={handleContinue}
        />
      );
    }

    if (phase === "build-a-gas") {
      return (
        <BuildAGasCalibrationStep
          onCanContinueChange={calibrationFlow.setCanContinueCurrentStep}
          onSelectionChange={calibrationFlow.setBuildAGasSelection}
        />
      );
    }
    if (phase === "compensation-check") {
      return (
        <CompensationCheckCalibrationStep
          onCanContinueChange={calibrationFlow.setCanContinueCurrentStep}
          onSelectionChange={calibrationFlow.setCompensationFitSelection}
        />
      );
    }
    if (phase === "mixed-process-challenge") {
      return (
        <MixedProcessCalibrationStep
          disabled={isSubmittingFinalStep}
          onCanContinueChange={calibrationFlow.setCanContinueCurrentStep}
          onSelectionChange={calibrationFlow.setFinalDiagnosisSelection}
        />
      );
    }

    return <div className="calibration-screen__placeholder" aria-label={`${step.title} placeholder`} />;
  }

  return (
    <main className="app-shell__page calibration-screen">
      <div className="calibration-screen__container">
        <CalibrationProgressHeader
          phase={phase}
        />
        <h1 className="calibration-screen__title">{step.title}</h1>
        {subtitle ? <p className="calibration-screen__subtitle">{subtitle}</p> : null}
        <CalibrationStepShell className={phase === "blood-gas-blitz" ? "calibration-step-shell--blood-gas-blitz" : undefined}>
          {renderStepContent()}
          <div className="calibration-screen__actions">
            {phase !== "blood-gas-blitz" ? (
              <button
                className="figma-button calibration-screen__button"
                type="button"
                disabled={!canUseContinueCta || isSubmittingFinalStep}
                onClick={phase === "mixed-process-challenge" ? handleFinalSubmit : handleContinue}
              >
                {phase === "mixed-process-challenge" && isSubmittingFinalStep ? (
                  <>
                    <span className="figma-button__spinner" aria-hidden="true" />
                    <span>Submitting</span>
                  </>
                ) : phase === "mixed-process-challenge" ? (
                  "Submit"
                ) : (
                  "Continue"
                )}
              </button>
            ) : null}
          </div>
        </CalibrationStepShell>
      </div>
    </main>
  );
}
