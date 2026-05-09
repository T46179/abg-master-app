import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCalibrationStep,
  getNextCalibrationPhase,
  isResultPhase
} from "./calibrationConfig";
import { AnalysingSampleCalibrationStep } from "./AnalysingSampleCalibrationStep";
import { BuildAGasCalibrationStep } from "./BuildAGasCalibrationStep";
import { CalibrationBloodGasBlitzStep } from "./CalibrationBloodGasBlitzStep";
import { CalibrationProgressHeader } from "./CalibrationProgressHeader";
import { CalibrationStepShell } from "./CalibrationStepShell";
import { CalibrationSummaryStep } from "./CalibrationSummaryStep";
import { CompensationCheckCalibrationStep } from "./CompensationCheckCalibrationStep";
import { MixedProcessCalibrationStep } from "./MixedProcessCalibrationStep";
import type { CalibrationPhase } from "./calibrationTypes";
import {
  scoreCalibration,
  type BuildAGasCalibrationSelection,
  type CalibrationPlacement,
  type CalibrationScoringInput
} from "./calibrationScoring";
import type { BloodGasBlitzAttemptResult } from "../minigames/BloodGasBlitz";

export function CalibrationScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<CalibrationPhase>("blood-gas-blitz");
  const [canContinueCurrentStep, setCanContinueCurrentStep] = useState(false);
  const [bloodGasBlitzResult, setBloodGasBlitzResult] = useState<BloodGasBlitzAttemptResult | null>(null);
  const [buildAGasSelection, setBuildAGasSelection] = useState<BuildAGasCalibrationSelection>({});
  const [compensationFitSelection, setCompensationFitSelection] = useState<string | null>(null);
  const [finalDiagnosisSelection, setFinalDiagnosisSelection] = useState<string | null>(null);
  const [calibrationResults, setCalibrationResults] = useState<CalibrationScoringInput>({});
  const [placement, setPlacement] = useState<CalibrationPlacement>("intermediate");
  const [phaseStartedAt, setPhaseStartedAt] = useState(() => Date.now());
  const step = getCalibrationStep(phase);
  const nextPhase = getNextCalibrationPhase(phase);
  const requiresAnswerToContinue = (
    phase === "build-a-gas" ||
    phase === "compensation-check" ||
    phase === "mixed-process-challenge"
  );
  const canUseContinueCta = !requiresAnswerToContinue || canContinueCurrentStep;

  const handleCanContinueChange = useCallback((canContinue: boolean) => {
    setCanContinueCurrentStep(canContinue);
  }, []);

  useEffect(() => {
    setCanContinueCurrentStep(false);
    setPhaseStartedAt(Date.now());
  }, [phase]);

  function handleContinue() {
    const elapsedMs = Date.now() - phaseStartedAt;

    if (phase === "build-a-gas") {
      setCalibrationResults(results => ({
        ...results,
        buildAGas: {
          selectedValues: buildAGasSelection,
          elapsedMs
        }
      }));
    }

    if (phase === "compensation-check" && compensationFitSelection) {
      setCalibrationResults(results => ({
        ...results,
        compensationFit: {
          selectedAnswer: compensationFitSelection,
          elapsedMs
        }
      }));
    }

    if (phase === "mixed-process-challenge" && finalDiagnosisSelection) {
      const nextResults: CalibrationScoringInput = {
        ...calibrationResults,
        bloodGasBlitz: bloodGasBlitzResult,
        finalDiagnosis: {
          selectedAnswer: finalDiagnosisSelection,
          elapsedMs
        }
      };

      setCalibrationResults(nextResults);
      setPlacement(scoreCalibration(nextResults).placement);
    }

    if (nextPhase) setPhase(nextPhase);
  }

  function handleReturnToPractice() {
    navigate("/practice");
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
            setBloodGasBlitzResult(result);
            setCalibrationResults(results => ({
              ...results,
              bloodGasBlitz: result
            }));
          }}
          onComplete={handleContinue}
        />
      );
    }

    if (phase === "build-a-gas") {
      return (
        <BuildAGasCalibrationStep
          onCanContinueChange={handleCanContinueChange}
          onSelectionChange={setBuildAGasSelection}
        />
      );
    }
    if (phase === "compensation-check") {
      return (
        <CompensationCheckCalibrationStep
          onCanContinueChange={handleCanContinueChange}
          onSelectionChange={setCompensationFitSelection}
        />
      );
    }
    if (phase === "mixed-process-challenge") {
      return (
        <MixedProcessCalibrationStep
          onCanContinueChange={handleCanContinueChange}
          onSelectionChange={setFinalDiagnosisSelection}
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
        {phase === "build-a-gas" ? (
          <p className="calibration-screen__subtitle">Select the cards below to build a Metabolic Acidosis</p>
        ) : null}
        {phase === "mixed-process-challenge" ? (
          <p className="calibration-screen__subtitle">Use the values below to choose the best answer</p>
        ) : null}
        <CalibrationStepShell>
          {renderStepContent()}
          <div className="calibration-screen__actions">
            {!isResultPhase(phase) && phase !== "blood-gas-blitz" ? (
              <button
                className="figma-button calibration-screen__button"
                type="button"
                disabled={!canUseContinueCta}
                onClick={handleContinue}
              >
                Continue
              </button>
            ) : null}
            {phase === "blood-gas-blitz" ? (
              <button className="figma-button calibration-screen__button" type="button" onClick={handleContinue}>
                Temporary next
              </button>
            ) : null}
            {isResultPhase(phase) ? (
              <button className="figma-button calibration-screen__button" type="button" onClick={handleReturnToPractice}>
                Return to practice
              </button>
            ) : null}
          </div>
        </CalibrationStepShell>
      </div>
    </main>
  );
}
