// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalibrationScreen } from "./CalibrationScreen";
import type { BloodGasBlitzAttemptResult } from "../minigames/BloodGasBlitz";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const latestBloodGasBlitzProps = vi.hoisted(() => ({
  value: null as null | {
    onComplete: () => void;
    onPhaseChange?: (phase: "ready" | "countdown" | "playing" | "results") => void;
    onResult?: (result: BloodGasBlitzAttemptResult) => void;
    onXpAwarded?: (amount: number) => void;
    placement?: string;
    preset?: string;
    versionId?: string;
    xpProgressLabel?: string;
  }
}));

const storageAdapter = vi.hoisted(() => ({
  loadCalibrationCompletion: vi.fn(() => null),
  saveCalibrationCompletion: vi.fn(),
  loadSeenCaseState: vi.fn(() => ({})),
  loadPracticeIntroSeen: vi.fn(() => true),
  savePracticeIntroSeen: vi.fn(),
  loadAppAreaVisited: vi.fn(() => true),
  saveAppAreaVisited: vi.fn(),
  savePressureUnitPreference: vi.fn()
}));

const analytics = vi.hoisted(() => ({
  trackEvent: vi.fn()
}));
const saveLocalCalibrationCompletion = vi.hoisted(() => vi.fn(async () => undefined));
const skipCalibrationOnboarding = vi.hoisted(() => vi.fn(async () => undefined));
const setUserState = vi.hoisted(() => vi.fn(async () => undefined));
const calibrationSession = vi.hoisted(() => ({ pressureUnit: "mmHg" as "mmHg" | "kPa" }));
const patchSessionState = vi.hoisted(() => vi.fn((patch: { pressureUnit?: "mmHg" | "kPa" }) => {
  if (patch.pressureUnit) calibrationSession.pressureUnit = patch.pressureUnit;
}));
const calibrationState = vi.hoisted(() => ({
  localCompletion: null as null | { completed: true; placement: "beginner" | "intermediate" | "advanced"; version: number },
  remoteCompletion: null,
  remoteStatus: "unavailable" as "loading" | "loaded" | "absent" | "unavailable",
  effectiveCompletion: null as null | { completed: true; placement: "beginner" | "intermediate" | "advanced"; version: number },
  completionSource: "none" as "remote" | "local" | "none"
}));

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      status: "ready",
      sessionState: calibrationSession,
      storage: storageAdapter,
      supabase: null,
      payload: { progressionConfig: { release_flags: { enable_open_practice_access: true } } },
      userState: {
        xp: 0,
        level: 1,
        casesCompleted: 0,
        abandonedCases: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        recentResults: [],
        appliedProtectedCaseTokens: []
      },
      practiceState: {
        currentCase: null,
        lastCaseSummary: null,
        pendingSubmission: null
      },
      calibrationState
    },
    setUserState,
    patchSessionState,
    saveLocalCalibrationCompletion,
    skipCalibrationOnboarding
  })
}));

vi.mock("../../core/analytics", () => analytics);

vi.mock("../minigames/BloodGasBlitz", () => ({
  BloodGasBlitzGame: (props: typeof latestBloodGasBlitzProps.value) => {
    latestBloodGasBlitzProps.value = props;
    return (
      <section data-testid="blood-gas-blitz-game">
        <p>Mock Blood Gas Blitz Game</p>
        <button type="button" onClick={() => props?.onPhaseChange?.("countdown")}>Mock begin blitz</button>
        <button type="button" onClick={props?.onComplete}>Mock finish blitz</button>
        <button
          type="button"
          onClick={() => props?.onResult?.({
            gameId: "blood-gas-blitz",
            versionId: "ph-classification-calibration-v3",
            placement: "onboarding-calibration",
            startedAt: "2026-05-06T00:00:00.000Z",
            completedAt: "2026-05-06T00:00:10.000Z",
            correctCount: 5,
            totalQuestions: 6,
            elapsedMs: 10000,
            accuracy: 83,
            averageMsPerQuestion: 1000,
            maxStreak: 5,
            answers: []
          })}
        >
          Mock emit result
        </button>
      </section>
    );
  }
}));

describe("CalibrationScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    calibrationSession.pressureUnit = "mmHg";
    patchSessionState.mockClear();
    storageAdapter.savePressureUnitPreference.mockClear();
    latestBloodGasBlitzProps.value = null;
    analytics.trackEvent.mockClear();
    storageAdapter.loadCalibrationCompletion.mockReturnValue(null);
    storageAdapter.saveCalibrationCompletion.mockClear();
    storageAdapter.loadPracticeIntroSeen.mockReturnValue(true);
    storageAdapter.loadAppAreaVisited.mockReturnValue(true);
    storageAdapter.savePracticeIntroSeen.mockClear();
    storageAdapter.saveAppAreaVisited.mockClear();
    saveLocalCalibrationCompletion.mockClear();
    skipCalibrationOnboarding.mockClear();
    calibrationState.localCompletion = null;
    calibrationState.remoteCompletion = null;
    calibrationState.remoteStatus = "unavailable";
    calibrationState.effectiveCompletion = null;
    calibrationState.completionSource = "none";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderScreen() {
    function PracticeRouteProbe() {
      const location = useLocation();
      return <main>Practice route {location.search}</main>;
    }

    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/calibration?difficulty=master"]}>
          <Routes>
            <Route path="/calibration" element={<CalibrationScreen />} />
            <Route path="/practice" element={<PracticeRouteProbe />} />
          </Routes>
        </MemoryRouter>
      );
    });
  }

  function clickButton(label: string) {
    if (label === "Mock finish blitz") {
      const emit = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.includes("Mock emit result"));
      act(() => emit?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }
    const button = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.includes(label));
    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  function getButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.includes(label));
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  }

  function clickBuildAGasChoice(label: string) {
    const choice = container.querySelector(`[aria-label="${label}"]`);
    expect(choice).toBeTruthy();

    act(() => {
      choice?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  function completeBuildAGasStep() {
    clickBuildAGasChoice("pH 7.28 low");
    clickBuildAGasChoice("PaCO2 28 low");
    clickBuildAGasChoice("HCO3 14 low");
  }

  it("starts on Blood Gas Blitz", () => {
    renderScreen();

    expect(container.textContent).toContain("Blood Gas Blitz");
    expect(container.textContent).toContain("Mock Blood Gas Blitz Game");
    expect(container.textContent).not.toContain("Back");
    expect(container.textContent).toContain("1 of 4");
    expect(container.textContent).not.toContain("Continue");
    expect(latestBloodGasBlitzProps.value).toMatchObject({
      preset: "onboarding-calibration",
      versionId: "ph-classification-calibration-v3"
    });
    expect(latestBloodGasBlitzProps.value?.onXpAwarded).toBeUndefined();
    expect(latestBloodGasBlitzProps.value?.xpProgressLabel).toBeUndefined();
    expect(analytics.trackEvent).not.toHaveBeenCalledWith("calibration_started", expect.anything());
  });

  it("continues through the ordered calibration phases", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    expect(container.textContent).toContain("Build a Gas");
    expect(getButton("Continue").disabled).toBe(true);

    completeBuildAGasStep();
    expect(getButton("Continue").disabled).toBe(false);
    clickButton("Continue");
    expect(container.textContent).toContain("ABG Values");
    expect(getButton("Continue").disabled).toBe(true);

    clickButton("Appropriate compensation");
    expect(getButton("Continue").disabled).toBe(false);
    clickButton("Continue");
    expect(container.textContent).toContain("Almost There");
    expect(container.textContent).toContain("Use the values below to choose the best answer");
    expect(getButton("Submit").disabled).toBe(true);

    clickButton("raised anion gap metabolic acidosis");
    expect(getButton("Submit").disabled).toBe(false);
    clickButton("Submit");
    expect(getButton("Submitting").disabled).toBe(true);
    expect(container.querySelector(".figma-button__spinner")).toBeTruthy();
    expect(container.textContent).toContain("Almost There");
    expect(container.querySelectorAll(".calibration-compensation__option:disabled")).toHaveLength(4);

    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(container.textContent).toContain("Almost There");
    expect(container.textContent).not.toContain("ANALYSING SAMPLE");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.textContent).toContain("ABG Master");
    expect(container.textContent).not.toContain("4 of 4");

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(container.textContent).toContain("Suggested level");
    expect(container.querySelector("h1")?.textContent).toBe("Master");
    expect(container.textContent).toContain("Beginner");
    expect(container.textContent).toContain("Intermediate");
    expect(container.textContent).toContain("Advanced");
    expect(container.textContent).toContain("Master");
    expect(container.textContent).toContain("Start master");
    expect(container.textContent).not.toContain("Requires level 15 and consistent performance in Advanced cases");
  });

  it("shows the analyser transition without calibration chrome and advances automatically", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    clickButton("raised anion gap metabolic acidosis");
    clickButton("Submit");

    expect(container.textContent).toContain("Almost There");
    expect(container.textContent).toContain("Submitting");
    expect(container.textContent).not.toContain("ANALYSING SAMPLE");

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(container.textContent).toContain("ABG Master");
    expect(container.textContent).toContain("ANALYSING SAMPLE");
    expect(container.textContent).toContain("Cartridge 04");
    expect(container.textContent).toContain("Please wait");
    expect(container.textContent).not.toContain("Back");
    expect(container.textContent).not.toContain("Continue");
    expect(container.textContent).not.toContain("4 of 4");
    expect(container.querySelector(".calibration-progress-header")).toBeNull();
    expect(container.querySelector(".calibration-step-shell")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(container.textContent).toContain("Suggested level");
    expect(container.querySelector("h1")?.textContent).toBe("Master");
    expect(container.textContent).toContain("Start master");
  });

  it("does not redirect when the current session persists its calibration completion", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    clickButton("raised anion gap metabolic acidosis");
    clickButton("Submit");

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(container.textContent).toContain("ANALYSING SAMPLE");

    const completion = { completed: true as const, placement: "advanced" as const, version: 1 };
    calibrationState.localCompletion = completion;
    calibrationState.effectiveCompletion = completion;
    calibrationState.completionSource = "local";
    renderScreen();

    expect(container.textContent).toContain("ANALYSING SAMPLE");
    expect(container.textContent).not.toContain("Practice route");

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(container.textContent).toContain("Suggested level");
    expect(container.textContent).toContain("Start master");
    expect(container.textContent).not.toContain("Practice route");
  });

  it("shows the Build a Gas metabolic acidosis scaffold", () => {
    renderScreen();

    clickButton("Mock finish blitz");

    expect(container.textContent).toContain("Build a Gas");
    expect(container.textContent).toContain("Select the cards below to build a Metabolic Acidosis");
    expect(container.textContent).toContain("2 of 4");
    expect(container.textContent).toContain("7.28");
    expect(container.textContent).toContain("28");
    expect(container.textContent).toContain("14");
    expect(container.querySelectorAll(".calibration-build-gas__choice")).toHaveLength(9);
    expect(getButton("Continue").disabled).toBe(true);

    clickBuildAGasChoice("pH 7.28 low");
    expect(getButton("Continue").disabled).toBe(true);

    clickBuildAGasChoice("PaCO2 28 low");
    expect(getButton("Continue").disabled).toBe(true);

    clickBuildAGasChoice("HCO3 14 low");
    expect(getButton("Continue").disabled).toBe(false);
  });

  it("updates the calibration progress bar as phases advance", () => {
    renderScreen();

    const progressBar = () => container.querySelector(".calibration-progress-header__bar") as HTMLElement | null;

    expect(container.textContent).toContain("1 of 4");
    expect(progressBar()?.style.width).toBe("25%");

    clickButton("Mock finish blitz");
    expect(container.textContent).toContain("2 of 4");
    expect(progressBar()?.style.width).toBe("50%");
  });

  it("shows the Compensation Check scaffold", () => {
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");

    expect(container.textContent).toContain("ABG Values");
    expect(container.textContent).toContain("Answers");
    expect(container.textContent).toContain("7.25");
    expect(container.textContent).toContain("26");
    expect(container.textContent).toContain("mmHg");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("mmol/L");
    expect(container.textContent).toContain("Appropriate compensation");
    expect(container.textContent).toContain("Additional respiratory acidosis");
    expect(container.textContent).toContain("Additional respiratory alkalosis");
    expect(getButton("Continue").disabled).toBe(true);

    clickButton("Appropriate compensation");
    expect(getButton("Continue").disabled).toBe(false);
  });

  it("does not show a back control after advancing", () => {
    renderScreen();

    clickButton("Mock finish blitz");
    expect(container.textContent).toContain("Build a Gas");
    expect(container.textContent).not.toContain("Back");
  });

  it("starts the calibrated practice case from the result", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    expect(Array.from(container.querySelectorAll('.calibration-mixed-process .answer-option')).map(option => option.textContent)).toEqual([
      "normal anion gap metabolic acidosis",
      "raised anion gap metabolic acidosis",
      "respiratory acidosis",
      "mixed metabolic acidosis and respiratory alkalosis"
    ]);
    clickButton("raised anion gap metabolic acidosis");
    clickButton("Submit");
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    clickButton("Start master");

    expect(container.textContent).toContain("Practice route");
    expect(container.textContent).toContain("?difficulty=master");
  });

  it("starts the selected easier practice case from the result", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    clickButton("raised anion gap metabolic acidosis");
    clickButton("Submit");
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    clickButton("Beginner");
    clickButton("Start beginner");

    expect(container.textContent).toContain("Practice route");
    expect(container.textContent).toContain("?difficulty=beginner");
  });

  it("accepts a Blood Gas Blitz result without advancing", () => {
    renderScreen();

    clickButton("Mock emit result");

    expect(container.textContent).toContain("Blood Gas Blitz");
    expect(container.textContent).toContain("Mock Blood Gas Blitz Game");
  });

  it("still redirects users who enter calibration with an existing completion", () => {
    const completion = { completed: true as const, placement: "beginner" as const, version: 1 };
    calibrationState.localCompletion = completion;
    calibrationState.effectiveCompletion = completion;
    calibrationState.completionSource = "local";

    renderScreen();

    expect(container.textContent).toContain("Practice route ?difficulty=beginner");
  });

  it("tracks calibration analytics milestones once with a shared attempt id", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T00:00:00.000Z"));
    renderScreen();

    expect(analytics.trackEvent).not.toHaveBeenCalledWith("calibration_started", expect.anything());

    clickButton("Mock begin blitz");
    clickButton("Mock begin blitz");
    clickButton("Mock emit result");
    clickButton("Mock emit result");
    clickButton("Mock finish blitz");

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    completeBuildAGasStep();
    clickButton("Continue");

    act(() => {
      vi.advanceTimersByTime(23000);
    });
    clickButton("Appropriate compensation");
    clickButton("Continue");

    act(() => {
      vi.advanceTimersByTime(34000);
    });
    clickButton("raised anion gap metabolic acidosis");
    clickButton("Submit");
    clickButton("Submitting");

    expect(analytics.trackEvent.mock.calls.filter(([name]) => name === "calibration_completed")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    const events = analytics.trackEvent.mock.calls;
    const startedEvents = events.filter(([name]) => name === "calibration_started");
    const stepEvents = events.filter(([name]) => name === "calibration_step_completed");
    const completedEvents = events.filter(([name]) => name === "calibration_completed");

    expect(startedEvents).toHaveLength(1);
    expect(stepEvents).toHaveLength(4);
    expect(completedEvents).toHaveLength(1);

    const attemptIds = events.map(([, payload]) => payload.calibration_attempt_id);
    expect(new Set(attemptIds).size).toBe(1);
    expect(attemptIds[0]).toEqual(expect.any(String));

    events.forEach(([, payload]) => {
      expect(payload).toMatchObject({
        version: "3",
        placement_version: "3"
      });
    });

    expect(stepEvents.map(([, payload]) => ({
      step_id: payload.step_id,
      step_number: payload.step_number,
      score_percent: payload.score_percent,
      time_taken_seconds: payload.time_taken_seconds
    }))).toEqual([
      {
        step_id: "blood_gas_blitz",
        step_number: 1,
        score_percent: 83,
        time_taken_seconds: 10
      },
      {
        step_id: "build_a_gas",
        step_number: 2,
        score_percent: 100,
        time_taken_seconds: 12
      },
      {
        step_id: "compensation_check",
        step_number: 3,
        score_percent: 100,
        time_taken_seconds: 23
      },
      {
        step_id: "mixed_process",
        step_number: 4,
        score_percent: 100,
        time_taken_seconds: 34
      }
    ]);

    expect(completedEvents[0][1]).toMatchObject({
      placement: "master",
      score_total: 7.5,
      score_percent: 94
    });
  });

  it("shows the full-page introduction before Blood Gas Blitz for a genuinely new user", () => {
    storageAdapter.loadPracticeIntroSeen.mockReturnValue(false);
    storageAdapter.loadAppAreaVisited.mockReturnValue(false);
    renderScreen();

    expect(container.textContent).toContain("Welcome to ABG Master!");
    expect(container.textContent).toContain("Begin Calibration");
    expect(container.textContent).not.toContain("Mock Blood Gas Blitz Game");

    clickButton("Begin Calibration");

    expect(storageAdapter.savePracticeIntroSeen).toHaveBeenCalledWith(true);
    expect(storageAdapter.saveAppAreaVisited).toHaveBeenCalledWith(true);
    expect(container.textContent).toContain("Mock Blood Gas Blitz Game");
  });

  it("sets the global unit before starting and keeps kPa display independent of scoring", () => {
    vi.useFakeTimers();
    storageAdapter.loadPracticeIntroSeen.mockReturnValue(false);
    storageAdapter.loadAppAreaVisited.mockReturnValue(false);
    renderScreen();
    expect(container.querySelector('.main-nav__unit-option[aria-pressed="true"]')?.textContent).toBe("mmHg");
    expect(container.querySelector('.calibration-onboarding__header .main-nav__unit-control')).not.toBeNull();
    expect(container.querySelector('[aria-label="Skip calibration and start at Beginner"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\bUnit\b/);
    clickButton("kPa");
    expect(patchSessionState).toHaveBeenCalledWith({ pressureUnit: "kPa" });
    expect(storageAdapter.savePressureUnitPreference).toHaveBeenCalledWith("kPa");
    renderScreen();
    expect(container.querySelector('.main-nav__unit-option[aria-pressed="true"]')?.textContent).toBe("kPa");
    clickButton("Begin Calibration");
    clickButton("Mock begin blitz");
    clickButton("Mock finish blitz");
    expect(container.querySelector('.calibration-build-gas__row-unit')?.textContent).toBe("kPa");
    clickBuildAGasChoice("pH 7.28 low");
    clickBuildAGasChoice("PaCO2 3.7 low");
    clickBuildAGasChoice("HCO3 14 low");
    clickButton("Continue");
    expect(container.textContent).toContain("3.5kPa");
    expect(container.textContent).toContain("4.7 - 6.0 kPa");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    expect(container.textContent).toContain("3.6kPa");
    clickButton("raised anion gap metabolic acidosis");
    clickButton("Submit");
    act(() => vi.advanceTimersByTime(800));
    act(() => vi.advanceTimersByTime(20000));
    expect(container.querySelector("h1")?.textContent).toBe("Master");
    expect(saveLocalCalibrationCompletion).toHaveBeenCalledWith({ completed: true, placement: "advanced", recommendation: "master", version: 3 });
    expect(analytics.trackEvent).toHaveBeenCalledWith("calibration_completed", expect.objectContaining({ pressure_unit: "kPa", placement: "master" }));
  });

  it("honours a saved global kPa preference on the invitation", () => {
    calibrationSession.pressureUnit = "kPa";
    storageAdapter.loadPracticeIntroSeen.mockReturnValue(false);
    storageAdapter.loadAppAreaVisited.mockReturnValue(false);
    renderScreen();
    expect(container.querySelector('.main-nav__unit-option[aria-pressed="true"]')?.textContent).toBe("kPa");
    expect(storageAdapter.savePressureUnitPreference).not.toHaveBeenCalled();
  });

  it("resumes at Blood Gas Blitz after Begin followed by abandonment", () => {
    storageAdapter.loadPracticeIntroSeen.mockReturnValue(false);
    storageAdapter.loadAppAreaVisited.mockReturnValue(false);
    renderScreen();
    clickButton("Begin Calibration");

    act(() => root.unmount());
    root = createRoot(container);
    storageAdapter.loadPracticeIntroSeen.mockReturnValue(true);
    storageAdapter.loadAppAreaVisited.mockReturnValue(true);
    renderScreen();

    expect(container.textContent).not.toContain("Welcome to ABG Master!");
    expect(container.textContent).toContain("Mock Blood Gas Blitz Game");
  });

  it("persists Skip locally before opening Beginner Practice", async () => {
    let resolveSkip: (() => void) | null = null;
    skipCalibrationOnboarding.mockImplementationOnce(() => new Promise<undefined>((resolve) => {
      resolveSkip = () => resolve(undefined);
    }));
    storageAdapter.loadPracticeIntroSeen.mockReturnValue(false);
    storageAdapter.loadAppAreaVisited.mockReturnValue(false);
    renderScreen();

    const skipButton = getButton("Skip and start at Beginner");
    act(() => {
      skipButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(skipCalibrationOnboarding).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).not.toHaveBeenCalledWith("calibration_skipped", expect.anything());
    expect(container.textContent).not.toContain("Practice route");

    await act(async () => {
      resolveSkip?.();
      await Promise.resolve();
    });

    expect(analytics.trackEvent.mock.calls.filter(([name]) => name === "calibration_skipped")).toEqual([
      [
        "calibration_skipped",
        {
          version: "3",
          placement_version: "3",
          destination_difficulty: "beginner"
        }
      ]
    ]);
    expect(analytics.trackEvent).not.toHaveBeenCalledWith("calibration_started", expect.anything());
    expect(container.textContent).toContain("Practice route ?difficulty=beginner");
  });

});
