import {
  BloodGasBlitzGame,
  type BloodGasBlitzAttemptResult,
  type BloodGasBlitzPhase
} from "../minigames/BloodGasBlitz";

interface CalibrationBloodGasBlitzStepProps {
  onComplete: () => void;
  onPhaseChange?: (phase: BloodGasBlitzPhase) => void;
  onResult: (result: BloodGasBlitzAttemptResult) => void;
}

export function CalibrationBloodGasBlitzStep(props: CalibrationBloodGasBlitzStepProps) {
  return (
    <BloodGasBlitzGame
      preset="onboarding-calibration"
      versionId="ph-classification-v1"
      onResult={props.onResult}
      onComplete={props.onComplete}
      onPhaseChange={props.onPhaseChange}
    />
  );
}
