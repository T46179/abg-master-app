import type { BloodGasBlitzQuestion } from "./bloodGasBlitzTypes";
import { getPlayableBloodGasBlitzConfig } from "./bloodGasBlitzConfig";
import type { BloodGasBlitzPlayableVersionId } from "./bloodGasBlitzTypes";

function randomUniqueValueInRange(range: { min: number; max: number }, usedHundredths: Set<number>) {
  const minHundredths = Math.ceil(range.min * 100 - 1e-9);
  const maxHundredths = Math.floor(range.max * 100 + 1e-9);
  const availableHundredths: number[] = [];

  for (let value = minHundredths; value <= maxHundredths; value += 1) {
    if (!usedHundredths.has(value)) {
      availableHundredths.push(value);
    }
  }

  if (!availableHundredths.length) {
    throw new Error(
      `Blood Gas Blitz cannot generate another unique value in the configured range ${range.min.toFixed(2)}-${range.max.toFixed(2)}.`
    );
  }

  const selectedHundredths = availableHundredths[Math.floor(Math.random() * availableHundredths.length)];
  usedHundredths.add(selectedHundredths);
  return selectedHundredths / 100;
}

function shuffleQuestions(questions: BloodGasBlitzQuestion[]) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function generateBloodGasBlitzQuestions(versionId: BloodGasBlitzPlayableVersionId = "ph-classification-v1"): BloodGasBlitzQuestion[] {
  const config = getPlayableBloodGasBlitzConfig(versionId);
  const usedHundredths = new Set<number>();

  return shuffleQuestions(
    config.pattern.slice(0, config.questionCount).map((expectedAnswer, index) => ({
      id: `${config.versionId}-q${index + 1}-${expectedAnswer.toLowerCase()}`,
      value: randomUniqueValueInRange(config.ranges[expectedAnswer], usedHundredths),
      expectedAnswer
    }))
  );
}

export const BLOOD_GAS_BLITZ_QUESTIONS: BloodGasBlitzQuestion[] = generateBloodGasBlitzQuestions();
