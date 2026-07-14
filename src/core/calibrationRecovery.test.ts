import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./storage";
import {
  clearPendingCalibrationCompletion,
  createPendingCalibrationCompletion,
  loadPendingCalibrationCompletion,
  savePendingCalibrationCompletion
} from "./calibrationRecovery";

describe("pending calibration completion recovery", () => {
  it("persists one stable operation for retry", () => {
    const storage = createMemoryStorage();
    const pending = createPendingCalibrationCompletion({
      operationId: "skip-operation-1",
      calibrationVersion: 1,
      progressionVersion: "v2",
      betaReleaseNumber: 2,
      now: new Date("2026-07-14T00:00:00.000Z")
    });

    savePendingCalibrationCompletion(storage, pending);
    expect(loadPendingCalibrationCompletion(storage)).toEqual(pending);
    expect(loadPendingCalibrationCompletion(storage)?.operationId).toBe("skip-operation-1");
  });

  it("clears the pending operation during reset/reconciliation", () => {
    const storage = createMemoryStorage();
    savePendingCalibrationCompletion(storage, createPendingCalibrationCompletion({
      operationId: "skip-operation-1",
      calibrationVersion: 1,
      progressionVersion: "v2",
      betaReleaseNumber: 2
    }));

    clearPendingCalibrationCompletion(storage);
    expect(loadPendingCalibrationCompletion(storage)).toBeNull();
  });
});
