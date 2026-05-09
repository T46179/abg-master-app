import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCalibrationStep,
  getNextCalibrationPhase,
  getPreviousCalibrationPhase,
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
import type { BloodGasBlitzAttemptResult } from "../minigames/BloodGasBlitz";

export function CalibrationScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<CalibrationPhase>("blood-gas-blitz");
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

  function handleStartIntermediate() {
    navigate("/practice?difficulty=intermediate");
  }

  function handleStartBeginner() {
    navigate("/practice?difficulty=beginner");
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
          onStartIntermediate={handleStartIntermediate}
          onStartBeginner={handleStartBeginner}
        />
      </main>
    );
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
    if (phase === "mixed-process-challenge") return <MixedProcessCalibrationStep />;

    return <div className="calibration-screen__placeholder" aria-label={`${step.title} placeholder`} />;
  }

  return (
    <main className="app-shell__page calibration-screen">
      <div className="calibration-screen__container">
        <CalibrationProgressHeader
          phase={phase}
          onBack={handleBack}
          showBack={Boolean(previousPhase)}
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
