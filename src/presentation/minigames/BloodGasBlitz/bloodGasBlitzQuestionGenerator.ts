import type { BloodGasBlitzQuestion } from "./bloodGasBlitzTypes";
import { getPlayableBloodGasBlitzConfig } from "./bloodGasBlitzConfig";
import type { BloodGasBlitzPlayableVersionId } from "./bloodGasBlitzTypes";

function randomValueInRange(range: { min: number; max: number }) {
  const value = range.min + Math.random() * (range.max - range.min);
  return Number(value.toFixed(2));
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

  return shuffleQuestions(
    config.pattern.slice(0, config.questionCount).map((expectedAnswer, index) => ({
      id: `${config.versionId}-q${index + 1}-${expectedAnswer.toLowerCase()}`,
      value: randomValueInRange(config.ranges[expectedAnswer]),
      expectedAnswer
    }))
  );
}

export const BLOOD_GAS_BLITZ_QUESTIONS: BloodGasBlitzQuestion[] = generateBloodGasBlitzQuestions();
