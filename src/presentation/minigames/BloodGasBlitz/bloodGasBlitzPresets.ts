import type { BloodGasBlitzPlacement } from "./bloodGasBlitzTypes";

export type BloodGasBlitzPresetId = "learn-foundations" | "onboarding-calibration";

interface BloodGasBlitzPresetConfig {
  placement: BloodGasBlitzPlacement;
  showXp: boolean;
  awardXp: boolean;
}

export const bloodGasBlitzPresets: Record<BloodGasBlitzPresetId, BloodGasBlitzPresetConfig> = {
  "learn-foundations": {
    placement: "learn-foundations",
    showXp: true,
    awardXp: true
  },
  "onboarding-calibration": {
    placement: "onboarding-calibration",
    showXp: false,
    awardXp: false
  }
};

export function getBloodGasBlitzPreset(preset: BloodGasBlitzPresetId) {
  return bloodGasBlitzPresets[preset];
}
