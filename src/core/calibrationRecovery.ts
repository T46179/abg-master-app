import type { BrowserStorageLike } from "./storage";
import type { CalibrationPlacement } from "./types";

const PENDING_CALIBRATION_STORAGE_KEY = "abgmaster_pendingCalibrationCompletion";

export interface PendingCalibrationCompletion {
  operationId: string;
  placement: CalibrationPlacement;
  calibrationVersion: number;
  progressionVersion: string;
  betaReleaseNumber: number;
  source: "skip_intro";
  createdAt: string;
  lastAttemptAt: string | null;
}

function sanitizePendingCalibrationCompletion(source: unknown): PendingCalibrationCompletion | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const placement = String(record.placement ?? "").toLowerCase();
  const sourceName = String(record.source ?? "");
  const calibrationVersion = Number(record.calibrationVersion);
  const betaReleaseNumber = Number(record.betaReleaseNumber);

  if (!String(record.operationId ?? "").trim()) return null;
  if (placement !== "beginner") return null;
  if (sourceName !== "skip_intro") return null;
  if (!Number.isFinite(calibrationVersion) || calibrationVersion < 1) return null;
  if (!Number.isFinite(betaReleaseNumber) || betaReleaseNumber < 1) return null;
  if (!String(record.progressionVersion ?? "").trim()) return null;
  if (!Number.isFinite(Date.parse(String(record.createdAt ?? "")))) return null;

  return {
    operationId: String(record.operationId),
    placement: "beginner",
    calibrationVersion,
    progressionVersion: String(record.progressionVersion),
    betaReleaseNumber,
    source: "skip_intro",
    createdAt: String(record.createdAt),
    lastAttemptAt: Number.isFinite(Date.parse(String(record.lastAttemptAt ?? "")))
      ? String(record.lastAttemptAt)
      : null
  };
}

export function loadPendingCalibrationCompletion(storage: BrowserStorageLike): PendingCalibrationCompletion | null {
  try {
    const raw = storage.getItem(PENDING_CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    const sanitized = sanitizePendingCalibrationCompletion(JSON.parse(raw));
    if (!sanitized) storage.removeItem(PENDING_CALIBRATION_STORAGE_KEY);
    return sanitized;
  } catch {
    return null;
  }
}

export function savePendingCalibrationCompletion(
  storage: BrowserStorageLike,
  pending: PendingCalibrationCompletion
): void {
  storage.setItem(PENDING_CALIBRATION_STORAGE_KEY, JSON.stringify(pending));
}

export function clearPendingCalibrationCompletion(storage: BrowserStorageLike): void {
  storage.removeItem(PENDING_CALIBRATION_STORAGE_KEY);
}

export function createPendingCalibrationCompletion(input: {
  operationId: string;
  calibrationVersion: number;
  progressionVersion: string;
  betaReleaseNumber: number;
  now?: Date;
}): PendingCalibrationCompletion {
  const createdAt = (input.now ?? new Date()).toISOString();
  return {
    operationId: input.operationId,
    placement: "beginner",
    calibrationVersion: input.calibrationVersion,
    progressionVersion: input.progressionVersion,
    betaReleaseNumber: input.betaReleaseNumber,
    source: "skip_intro",
    createdAt,
    lastAttemptAt: null
  };
}
