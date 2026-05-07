import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCalibrationStep,
  getNextCalibrationPhase,
  getPreviousCalibrationPhase,
  isIntroPhase,
  isResultPhase
} from "./calibrationConfig";
import { BuildAGasCalibrationStep } from "./BuildAGasCalibrationStep";
import { CalibrationBloodGasBlitzStep } from "./CalibrationBloodGasBlitzStep";
import { CalibrationStepShell } from "./CalibrationStepShell";
import { CompensationCheckCalibrationStep } from "./CompensationCheckCalibrationStep";
import type { CalibrationPhase } from "./calibrationTypes";
import type { BloodGasBlitzAttemptResult } from "../minigames/BloodGasBlitz";

export function CalibrationScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<CalibrationPhase>("intro");
  const [, setBloodGasBlitzResult] = useState<BloodGasBlitzAttemptResult | null>(null);
  const step = getCalibrationStep(phase);
  const previousPhase = getPreviousCalibrationPhase(phase);
  const nextPhase = getNextCalibrationPhase(phase);

  function handleBack() {
    if (previousPhase) setPhase(previousPhase);
  }

  function handleContinue() {
    if (nextPhase) setPhase(nextPhase);
  }

  function handleReturnToPractice() {
    navigate("/practice");
  }

  function renderStepContent() {
    if (phase === "blood-gas-blitz") {
      return (
        <CalibrationBloodGasBlitzStep
          onResult={setBloodGasBlitzResult}
          onComplete={handleContinue}
        />
      );
    }

    if (phase === "build-a-gas") return <BuildAGasCalibrationStep />;
    if (phase === "compensation-check") return <CompensationCheckCalibrationStep />;

    return (
      // TODO: Replace these placeholders with Figma-derived step components.
      <div className="calibration-screen__placeholder" aria-label={`${step.title} placeholder`} />
    );
  }

  return (
    <main className="app-shell__page calibration-screen">
      <div className="calibration-screen__container">
        <CalibrationStepShell
          eyebrow={step.eyebrow}
          stepLabel={step.stepLabel}
          title={step.title}
          description={step.description}
        >
          {renderStepContent()}
          <div className="calibration-screen__actions">
            {!isIntroPhase(phase) ? (
              <button className="figma-button figma-button--secondary calibration-screen__button" type="button" onClick={handleBack}>
                Back
              </button>
            ) : null}
            {isIntroPhase(phase) ? (
              <button className="figma-button calibration-screen__button" type="button" onClick={handleContinue}>
                Start calibration
              </button>
            ) : null}
            {!isIntroPhase(phase) && !isResultPhase(phase) && phase !== "blood-gas-blitz" ? (
              <button className="figma-button calibration-screen__button" type="button" onClick={handleContinue}>
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
