// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BloodGasBlitzGame,
  BLOOD_GAS_BLITZ_GAME_ID,
  bloodGasBlitzVersions,
  generateBloodGasBlitzQuestions,
  getPlayableBloodGasBlitzConfig
} from "./index";
import type { BloodGasBlitzAttemptResult } from "./index";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("BloodGasBlitzGame", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let now = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    now = 0;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function renderGame(onComplete = vi.fn(), onXpAwarded = vi.fn(), onResult = vi.fn()) {
    act(() => {
      root.render(
        <BloodGasBlitzGame
          onComplete={onComplete}
          onResult={onResult}
          onXpAwarded={onXpAwarded}
          placement="learn-foundations"
          xpProgressLabel="0 / 200 XP"
        />
      );
    });

    return { onComplete, onXpAwarded, onResult };
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.includes(label));
    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  function startGame() {
    clickButton("Begin");

    act(() => {
      now += 3000;
      vi.advanceTimersByTime(3000);
    });
  }

  function getVisibleQuestionAnswer() {
    const ph = Number(container.querySelector(".speed-check__question strong")?.textContent);
    expect(Number.isFinite(ph)).toBe(true);

    if (ph < 7.35) return "Acidaemia";
    if (ph > 7.45) return "Alkalaemia";
    return "Normal";
  }

  it("starts the game, awards xp, and shows answer feedback", () => {
    const { onXpAwarded } = renderGame();

    startGame();

    expect(container.textContent).toContain("Classify the pH");
    expect(container.textContent).toContain("Normal range: 7.35 to 7.45");
    expect(container.querySelectorAll(".speed-check__progress-dot")).toHaveLength(10);

    clickButton(getVisibleQuestionAnswer());

    expect(container.textContent).toContain("+3 XP");
    expect(container.textContent).toContain("0 / 200 XP");
    expect(onXpAwarded).toHaveBeenCalledWith(3);
  });

  it("completes all questions and calls continue on the results screen", () => {
    const { onComplete } = renderGame();

    startGame();

    for (let index = 0; index < 10; index += 1) {
      clickButton(getVisibleQuestionAnswer());
      act(() => {
        const delay = index === 9 ? 960 : 560;
        now += delay;
        vi.advanceTimersByTime(delay);
      });
    }

    expect(container.textContent).toContain("Perfect!");
    expect(container.textContent).toContain("10/10");
    expect(container.textContent).toContain("Correct answers");

    clickButton("Continue");

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("emits a future-ready attempt result while preserving existing fields", () => {
    const { onResult } = renderGame();

    startGame();

    for (let index = 0; index < 10; index += 1) {
      clickButton(getVisibleQuestionAnswer());
      act(() => {
        const delay = index === 9 ? 960 : 560;
        now += delay;
        vi.advanceTimersByTime(delay);
      });
    }

    expect(onResult).toHaveBeenCalledTimes(1);
    const result = onResult.mock.calls[0][0] as BloodGasBlitzAttemptResult;

    expect(result).toMatchObject({
      gameId: BLOOD_GAS_BLITZ_GAME_ID,
      versionId: "ph-classification-v1",
      placement: "learn-foundations",
      correctCount: 10,
      totalQuestions: 10,
      accuracy: 100,
      maxStreak: 10
    });
    expect(result.elapsedMs).toBeGreaterThan(0);
    expect(result.averageMsPerQuestion).toBe(Math.round(result.elapsedMs / 10));
    expect(Date.parse(result.startedAt)).not.toBeNaN();
    expect(Date.parse(result.completedAt)).not.toBeNaN();
    expect(result.startedAt).not.toBe(result.completedAt);
    expect(result.answers).toHaveLength(10);
    expect(result.answers[0]).toEqual(expect.objectContaining({
      questionId: expect.any(String),
      questionIndex: expect.any(Number),
      value: expect.any(Number),
      expectedAnswer: expect.any(String),
      selectedAnswer: expect.any(String),
      isCorrect: true,
      answeredAtMs: expect.any(Number)
    }));
  });

  it("keeps pH v1 playable and CO2 v1 planned-only", () => {
    const questions = generateBloodGasBlitzQuestions("ph-classification-v1");

    expect(questions).toHaveLength(10);
    expect(new Set(questions.map(question => question.expectedAnswer))).toEqual(new Set(["Acidaemia", "Normal", "Alkalaemia"]));
    expect(getPlayableBloodGasBlitzConfig("ph-classification-v1").status).toBe("playable");
    expect(bloodGasBlitzVersions["co2-classification-v1"]).toMatchObject({ status: "planned" });
  });
});
