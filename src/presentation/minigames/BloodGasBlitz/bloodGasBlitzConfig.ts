import type { BloodGasBlitzAnswerLabel, BloodGasBlitzPlayableVersionId, BloodGasBlitzVersionId } from "./bloodGasBlitzTypes";

interface BloodGasBlitzPlayableVersionConfig {
  status: "playable";
  versionId: BloodGasBlitzPlayableVersionId;
  questionCount: number;
  prompt: string;
  rangeLabel: string;
  answers: BloodGasBlitzAnswerLabel[];
  pattern: BloodGasBlitzAnswerLabel[];
  ranges: Record<BloodGasBlitzAnswerLabel, { min: number; max: number }>;
}

interface BloodGasBlitzPlannedVersionConfig {
  status: "planned";
  versionId: Exclude<BloodGasBlitzVersionId, BloodGasBlitzPlayableVersionId>;
}

export type BloodGasBlitzVersionConfig = BloodGasBlitzPlayableVersionConfig | BloodGasBlitzPlannedVersionConfig;

export const BLOOD_GAS_BLITZ_XP_PER_CORRECT = 3;
export const BLOOD_GAS_BLITZ_ADVANCE_DELAY_MS = 560;
export const BLOOD_GAS_BLITZ_FINAL_REVEAL_DELAY_MS = 960;
export const BLOOD_GAS_BLITZ_CORRECT_FEEDBACK = ["Correct", "Nice!", "Clean read", "Quick call!"] as const;
export const BLOOD_GAS_BLITZ_INCORRECT_FEEDBACK = ["Not quite", "Reset and try again"] as const;

export const bloodGasBlitzVersions: Record<BloodGasBlitzVersionId, BloodGasBlitzVersionConfig> = {
  "ph-classification-v1": {
    status: "playable",
    versionId: "ph-classification-v1",
    questionCount: 10,
    prompt: "Classify the pH",
    rangeLabel: "Normal range: 7.35 to 7.45",
    answers: ["Acidaemia", "Normal", "Alkalaemia"],
    ranges: {
      Acidaemia: { min: 7.1, max: 7.3 },
      Normal: { min: 7.37, max: 7.43 },
      Alkalaemia: { min: 7.5, max: 7.6 }
    },
    pattern: [
      "Acidaemia",
      "Normal",
      "Alkalaemia",
      "Acidaemia",
      "Normal",
      "Alkalaemia",
      "Acidaemia",
      "Normal",
      "Alkalaemia",
      "Acidaemia"
    ]
  },
  "co2-classification-v1": {
    status: "planned",
    versionId: "co2-classification-v1"
  }
};

export function getPlayableBloodGasBlitzConfig(versionId: BloodGasBlitzPlayableVersionId) {
  const config = bloodGasBlitzVersions[versionId];
  if (config.status !== "playable") {
    throw new Error(`Blood Gas Blitz version ${versionId} is not playable.`);
  }
  return config;
}
