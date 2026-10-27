import type { CalibrationCompletionRecord, CalibrationRecommendation } from "./types";

export const CALIBRATION_COMPLETION_VERSION = 3;

export function createCalibrationCompletionRecord(recommendation: CalibrationRecommendation): CalibrationCompletionRecord {
  return {
    completed: true,
    placement: recommendation === "master" ? "advanced" : recommendation,
    recommendation,
    version: CALIBRATION_COMPLETION_VERSION
  };
}

export function getCalibrationCompletionUserFields(completion: CalibrationCompletionRecord) {
  return {
    calibrationCompleted: true,
    calibrationPlacement: completion.placement,
    calibrationRecommendation: completion.recommendation ?? completion.placement,
    calibrationVersion: completion.version
  };
}
