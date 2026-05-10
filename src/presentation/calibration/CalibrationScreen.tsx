import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { createCalibrationCompletionRecord } from "../../core/calibration";
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
import type { CalibrationScoringInput } from "./calibrationScoring";
import { useCalibrationFlow } from "./useCalibrationFlow";

export function CalibrationScreen() {
  const { state, setUserState } = useAppContext();
  const navigate = useNavigate();
  const calibrationFlow = useCalibrationFlow();
  const { phase, placement, step, canUseContinueCta } = calibrationFlow;
  const subtitle = getCalibrationSubtitle(phase);

  useEffect(() => {
    const completion = state.storage?.loadCalibrationCompletion();
    if (!completion) return;
    navigate(`/practice?difficulty=${completion.placement}`, { replace: true });
  }, [navigate, state.storage]);

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

  function handleContinue() {
    const completion = calibrationFlow.continueCurrentPhase();
    if (completion) void syncCalibrationCompletion(completion.placement, completion.results);
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
          onResult={(result) => {
            calibrationFlow.recordBloodGasBlitzResult(result);
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
                disabled={!canUseContinueCta}
                onClick={handleContinue}
              >
                Continue
              </button>
            ) : null}
          </div>
        </CalibrationStepShell>
      </div>
    </main>
  );
}
