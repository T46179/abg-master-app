import type { CalibrationCompletionRecord, CalibrationPlacement } from "./types";

export const CALIBRATION_COMPLETION_VERSION = 1;

export function createCalibrationCompletionRecord(placement: CalibrationPlacement): CalibrationCompletionRecord {
  return {
    completed: true,
    placement,
    version: CALIBRATION_COMPLETION_VERSION
  };
}
