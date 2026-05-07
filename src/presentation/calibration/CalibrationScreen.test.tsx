// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderScreen() {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/calibration"]}>
          <Routes>
            <Route path="/calibration" element={<CalibrationScreen />} />
            <Route path="/practice" element={<main>Practice route</main>} />
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

  it("renders the intro first", () => {
    renderScreen();

    expect(container.textContent).toContain("Let's find your starting level");
    expect(container.textContent).toContain("Start calibration");
    expect(container.textContent).not.toContain("Back");
  });

  it("starts on Blood Gas Blitz after the intro", () => {
    renderScreen();

    clickButton("Start calibration");

    expect(container.textContent).toContain("Blood Gas Blitz");
    expect(container.textContent).toContain("Mock Blood Gas Blitz Game");
    expect(container.textContent).toContain("Back");
    expect(container.textContent).not.toContain("Continue");
    expect(container.textContent).toContain("Temporary next");
    expect(latestBloodGasBlitzProps.value).toMatchObject({
      placement: "onboarding-calibration",
      versionId: "ph-classification-v1",
      xpProgressLabel: ""
    });
  });

  it("continues through the ordered calibration phases", () => {
    renderScreen();

    clickButton("Start calibration");
    clickButton("Mock finish blitz");
    expect(container.textContent).toContain("Build a Gas");

    clickButton("Continue");
    expect(container.textContent).toContain("Is the compensation appropriate?");

    clickButton("Continue");
    expect(container.textContent).toContain("Mixed Process Challenge");

    clickButton("Continue");
    expect(container.textContent).toContain("Analysing sample");

    clickButton("Continue");
    expect(container.textContent).toContain("Calibration result");
    expect(container.textContent).toContain("Return to practice");
  });

  it("shows the Build a Gas metabolic acidosis scaffold", () => {
    renderScreen();

    clickButton("Start calibration");
    clickButton("Mock finish blitz");

    expect(container.textContent).toContain("Build a Gas");
    expect(container.textContent).toContain("7.28");
    expect(container.textContent).toContain("28");
    expect(container.textContent).toContain("14");
    expect(container.textContent).toContain("Your build");
    expect(container.textContent).toContain("pH 7.28");
    expect(container.textContent).toContain("CO2 28");
    expect(container.textContent).toContain("HCO3 14");
    expect(container.querySelectorAll(".calibration-build-gas__choice.is-selected")).toHaveLength(3);
  });

  it("shows the Compensation Check scaffold", () => {
    renderScreen();

    clickButton("Start calibration");
    clickButton("Mock finish blitz");
    clickButton("Continue");

    expect(container.textContent).toContain("Is the compensation appropriate?");
    expect(container.textContent).toContain("Use the blood gas values below and pick the best fit.");
    expect(container.textContent).toContain("ABG Values");
    expect(container.textContent).toContain("Answers");
    expect(container.textContent).toContain("7.25");
    expect(container.textContent).toContain("26");
    expect(container.textContent).toContain("mmHg");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("mmol/L");
    expect(container.textContent).toContain("Appropriate compensation");
    expect(container.textContent).toContain("Expected PaCO2 fits the measured value");
    expect(container.textContent).toContain("Additional respiratory acidosis");
    expect(container.textContent).toContain("PaCO2 is higher than expected");
    expect(container.textContent).toContain("Additional respiratory alkalosis");
    expect(container.textContent).toContain("PaCO2 is lower than expected");
  });

  it("moves back to the previous phase", () => {
    renderScreen();

    clickButton("Start calibration");
    clickButton("Mock finish blitz");
    expect(container.textContent).toContain("Build a Gas");

    clickButton("Back");
    expect(container.textContent).toContain("Blood Gas Blitz");

    clickButton("Back");
    expect(container.textContent).toContain("Let's find your starting level");
  });

  it("returns to practice from the result", () => {
    renderScreen();

    clickButton("Start calibration");
    clickButton("Mock finish blitz");
    clickButton("Continue");
    clickButton("Continue");
    clickButton("Continue");
    clickButton("Continue");
    clickButton("Return to practice");

    expect(container.textContent).toContain("Practice route");
  });

  it("accepts a Blood Gas Blitz result without advancing", () => {
    renderScreen();

    clickButton("Start calibration");
    clickButton("Mock emit result");

    expect(container.textContent).toContain("Blood Gas Blitz");
    expect(container.textContent).toContain("Mock Blood Gas Blitz Game");
  });

  it("temporarily allows skipping Blood Gas Blitz during calibration development", () => {
    renderScreen();

    clickButton("Start calibration");
    clickButton("Temporary next");

    expect(container.textContent).toContain("Build a Gas");
  });
});
