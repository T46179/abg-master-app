import { describe, expect, it, vi } from "vitest";
import { createEmptyUserState } from "./progression";
import {
  REMOTE_PROGRESS_TIMEOUT_MS,
  hasMeaningfulCalibrationProgress,
  isLearnerEntryRoute,
  resolveCalibrationState,
  settleWithTimeout,
  shouldHoldLearnerRouteForCalibration,
  shouldRedirectToCalibrationOnboarding,
  shouldShowCalibrationIntroduction
} from "./calibrationOnboarding";

const beginnerCompletion = { completed: true, placement: "beginner", version: 1 } as const;
const advancedCompletion = { completed: true, placement: "advanced", version: 2 } as const;

describe("calibration onboarding decisions", () => {
  it.each([
    "/dashboard",
    "/practice",
    "/learn",
    "/learn/intermediate",
    "/insights",
    "/exam",
    "/leaderboard"
  ])("guards the learner-entry route %s", pathname => {
    expect(isLearnerEntryRoute(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/calibration",
    "/privacy",
    "/case-preview/example",
    "/dev/authored-cases",
    "/new-unclassified-route"
  ])("leaves the unrelated route %s unguarded", pathname => {
    expect(isLearnerEntryRoute(pathname)).toBe(false);
  });

  it("permits valid local completion immediately while remote progress loads", () => {
    const calibration = resolveCalibrationState({
      localCompletion: beginnerCompletion,
      remoteCompletion: null,
      remoteStatus: "loading"
    });

    expect(shouldHoldLearnerRouteForCalibration({
      pathname: "/practice",
      calibration,
      hasMeaningfulProgress: false
    })).toBe(false);
    expect(shouldRedirectToCalibrationOnboarding({
      pathname: "/practice",
      calibration,
      hasMeaningfulProgress: false
    })).toBe(false);
    expect(shouldShowCalibrationIntroduction({
      calibration,
      hasMeaningfulProgress: false,
      hasSeenIntroduction: false,
      hasVisitedAppArea: false
    })).toBe(false);
  });

  it("uses remote placement when local and remote completions disagree", () => {
    const calibration = resolveCalibrationState({
      localCompletion: beginnerCompletion,
      remoteCompletion: advancedCompletion,
      remoteStatus: "loaded"
    });

    expect(calibration.effectiveCompletion).toEqual(advancedCompletion);
    expect(calibration.completionSource).toBe("remote");
  });

  it("holds a genuinely new learner route only while remote resolution is pending", () => {
    const loading = resolveCalibrationState({
      localCompletion: null,
      remoteCompletion: null,
      remoteStatus: "loading"
    });
    const unavailable = resolveCalibrationState({
      localCompletion: null,
      remoteCompletion: null,
      remoteStatus: "unavailable"
    });

    expect(shouldHoldLearnerRouteForCalibration({
      pathname: "/dashboard",
      calibration: loading,
      hasMeaningfulProgress: false
    })).toBe(true);
    expect(shouldRedirectToCalibrationOnboarding({
      pathname: "/dashboard",
      calibration: unavailable,
      hasMeaningfulProgress: false
    })).toBe(true);
  });

  it("keeps mandatory redirection independent from introduction flags", () => {
    const calibration = resolveCalibrationState({
      localCompletion: null,
      remoteCompletion: null,
      remoteStatus: "absent"
    });

    expect(shouldRedirectToCalibrationOnboarding({
      pathname: "/learn/anion-gap",
      calibration,
      hasMeaningfulProgress: false
    })).toBe(true);
    expect(shouldShowCalibrationIntroduction({
      calibration,
      hasMeaningfulProgress: false,
      hasSeenIntroduction: true,
      hasVisitedAppArea: true
    })).toBe(false);
  });

  it("suppresses mandatory onboarding for meaningful existing progress", () => {
    const userState = { ...createEmptyUserState(), casesCompleted: 1 };
    const calibration = resolveCalibrationState({
      localCompletion: null,
      remoteCompletion: null,
      remoteStatus: "absent"
    });
    const hasMeaningfulProgress = hasMeaningfulCalibrationProgress({ userState });

    expect(hasMeaningfulProgress).toBe(true);
    expect(shouldRedirectToCalibrationOnboarding({
      pathname: "/exam",
      calibration,
      hasMeaningfulProgress
    })).toBe(false);
  });
});

describe("bounded remote progress resolution", () => {
  it("resolves an unresolved request to timeout at the shared boundary", async () => {
    vi.useFakeTimers();
    const resultPromise = settleWithTimeout(new Promise<never>(() => undefined));

    await vi.advanceTimersByTimeAsync(REMOTE_PROGRESS_TIMEOUT_MS);
    await expect(resultPromise).resolves.toEqual({ status: "timeout" });
    vi.useRealTimers();
  });

  it("settles once so a late result cannot replace the timeout decision", async () => {
    vi.useFakeTimers();
    let resolveRemote!: (value: string) => void;
    const remote = new Promise<string>(resolve => { resolveRemote = resolve; });
    const resultPromise = settleWithTimeout(remote, 10);

    await vi.advanceTimersByTimeAsync(10);
    const result = await resultPromise;
    resolveRemote("late remote placement");
    await Promise.resolve();

    expect(result).toEqual({ status: "timeout" });
    vi.useRealTimers();
  });
});
