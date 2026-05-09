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
    onResult?: (result: BloodGasBlitzAttemptResult) => void;
    onXpAwarded?: (amount: number) => void;
    placement?: string;
    preset?: string;
    versionId?: string;
    xpProgressLabel?: string;
  }
}));

vi.mock("../minigames/BloodGasBlitz", () => ({
  BloodGasBlitzGame: (props: typeof latestBloodGasBlitzProps.value) => {
    latestBloodGasBlitzProps.value = props;
    return (
      <section data-testid="blood-gas-blitz-game">
        <p>Mock Blood Gas Blitz Game</p>
        <button type="button" onClick={props?.onComplete}>Mock finish blitz</button>
        <button
          type="button"
          onClick={() => props?.onResult?.({
            gameId: "blood-gas-blitz",
            versionId: "ph-classification-v1",
            placement: "onboarding-calibration",
            startedAt: "2026-05-06T00:00:00.000Z",
            completedAt: "2026-05-06T00:00:10.000Z",
            correctCount: 9,
            totalQuestions: 10,
            elapsedMs: 10000,
            accuracy: 0.9,
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
    latestBloodGasBlitzProps.value = null;
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
        <MemoryRouter initialEntries={["/calibration"]}>
          <Routes>
            <Route path="/calibration" element={<CalibrationScreen />} />
            <Route path="/practice" element={<PracticeRouteProbe />} />
          </Routes>
        </MemoryRouter>
      );
    });
  }

  function clickButton(label: string) {
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
    expect(container.textContent).toContain("Temporary next");
    expect(latestBloodGasBlitzProps.value).toMatchObject({
      preset: "onboarding-calibration",
      versionId: "ph-classification-v1"
    });
    expect(latestBloodGasBlitzProps.value?.onXpAwarded).toBeUndefined();
    expect(latestBloodGasBlitzProps.value?.xpProgressLabel).toBeUndefined();
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
    expect(getButton("Continue").disabled).toBe(true);

    clickButton("Raised anion gap metabolic acidosis");
    expect(getButton("Continue").disabled).toBe(false);
    clickButton("Continue");
    expect(container.textContent).toContain("ABG Master");
    expect(container.textContent).not.toContain("4 of 4");

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(container.textContent).toContain("Calibration complete");
    expect(container.textContent).toContain("Intermediate unlocked");
    expect(container.textContent).toContain("Beginner");
    expect(container.textContent).toContain("Intermediate");
    expect(container.textContent).toContain("Advanced");
    expect(container.textContent).toContain("Master");
    expect(container.textContent).toContain("Start intermediate");
    expect(container.textContent).toContain("Requires level 15 and consistent performance in Advanced cases");
  });

  it("shows the analyser transition without calibration chrome and advances automatically", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    clickButton("Raised anion gap metabolic acidosis");
    clickButton("Continue");

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

    expect(container.textContent).toContain("Calibration complete");
    expect(container.textContent).toContain("Intermediate unlocked");
    expect(container.textContent).toContain("Start intermediate");
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

    clickButton("Temporary next");
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

  it("starts an intermediate practice case from the result", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    clickButton("Raised anion gap metabolic acidosis");
    clickButton("Continue");
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    clickButton("Start intermediate");

    expect(container.textContent).toContain("Practice route");
    expect(container.textContent).toContain("?difficulty=intermediate");
  });

  it("starts the selected easier practice case from the result", () => {
    vi.useFakeTimers();
    renderScreen();

    clickButton("Mock finish blitz");
    completeBuildAGasStep();
    clickButton("Continue");
    clickButton("Appropriate compensation");
    clickButton("Continue");
    clickButton("Raised anion gap metabolic acidosis");
    clickButton("Continue");
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

  it("temporarily allows skipping Blood Gas Blitz during calibration development", () => {
    renderScreen();

    clickButton("Temporary next");

    expect(container.textContent).toContain("Build a Gas");
  });
});
