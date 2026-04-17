// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPEED_CHECK_QUESTIONS, SpeedCheckGame } from "./SpeedCheckGame";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SpeedCheckGame", () => {
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

  function renderGame(onComplete = vi.fn()) {
    act(() => {
      root.render(<SpeedCheckGame onComplete={onComplete} />);
    });

    return onComplete;
  }

  it("starts the game, awards xp, and shows answer feedback", () => {
    renderGame();

    const startButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Start speed check"));
    act(() => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Question 1 / 10");

    const acidButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Acidaemia"));
    act(() => {
      acidButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("+20 XP");
    expect(container.textContent).toContain("20 / 200 XP");
  });

  it("completes all questions and calls continue on the results screen", () => {
    const onComplete = renderGame();

    const startButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Start speed check"));
    act(() => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    for (const question of SPEED_CHECK_QUESTIONS) {
      const answerButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes(question.correct));
      act(() => {
        answerButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      act(() => {
        now += 500;
        vi.advanceTimersByTime(500);
      });
    }

    expect(container.textContent).toContain("Speed check complete");
    expect(container.textContent).toContain("200 / 200 XP");

    const continueButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Continue learning"));
    act(() => {
      continueButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
