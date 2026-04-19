// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearnScreen } from "./LearnScreen";
import { LearnLessonScreen } from "./LearnLessonScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      status: "ready",
      errorMessage: null,
      userState: {
        level: 1
      }
    }
  })
}));

describe("Learn screens", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
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

  function renderPath(path: string) {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/learn" element={<LearnScreen />} />
            <Route path="/learn/:difficulty" element={<LearnLessonScreen />} />
          </Routes>
        </MemoryRouter>
      );
    });
  }

  it("renders all learn modules on the overview screen", () => {
    renderPath("/learn");

    expect(container.textContent).toContain("Foundations");
    expect(container.textContent).toContain("Master the basics");
    expect(container.textContent).toContain("Beginner");
    expect(container.textContent).toContain("Identify the primary disorder");
    expect(container.textContent).toContain("Intermediate");
    expect(container.textContent).toContain("Understand compensation");
    expect(container.textContent).toContain("Advanced");
    expect(container.textContent).toContain("Use the anion gap");
    expect(container.textContent).toContain("Master");
    expect(container.textContent).toContain("Detect mixed disorders");
    expect(container.textContent).toContain("Hidden");
    expect(container.textContent).toContain("Stewart analysis");
    expect(container.textContent).not.toContain("Build intuition about acid-base balance before you interpret full blood gases.");
    expect(container.textContent).not.toContain("Recognize pH status and name the main acid-base pattern fast.");
    expect(container.textContent).toContain("4 modules");
    expect(container.textContent).toContain("0% Complete");
    expect(container.textContent).not.toContain("Pre-beginner");
    expect(container.textContent).not.toContain("Module 1");
    expect(container.textContent).not.toContain("Secret");
    expect(container.textContent).not.toContain("Locked at Level 25");

    const moduleCards = container.querySelectorAll(".learn-level-card");
    const unlockedLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.learn-level-card__cta"));
    const lockedButton = container.querySelector<HTMLButtonElement>(".learn-level-card.is-locked .learn-level-card__cta");

    expect(moduleCards).toHaveLength(6);
    expect(unlockedLinks).toHaveLength(5);
    expect(unlockedLinks.map(link => link.getAttribute("href"))).toEqual([
      "/learn/foundations",
      "/learn/beginner",
      "/learn/intermediate",
      "/learn/advanced",
      "/learn/master"
    ]);
    expect(unlockedLinks.every(link => link.textContent?.includes("Start Learning"))).toBe(true);
    expect(lockedButton?.disabled).toBe(true);
    expect(lockedButton?.textContent).toContain("Locked");
    expect(container.querySelectorAll(".learn-level-card__progress .progress-bar__fill")).toHaveLength(6);
  });

  it("advances lesson content and updates progress dot states", () => {
    renderPath("/learn/foundations");

    expect(container.textContent).toContain("What is pH?");

    const nextButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Next"));
    act(() => {
      nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("CO2 and HCO3 are the two levers");

    const dots = Array.from(container.querySelectorAll("[data-state]"));
    expect(dots).toHaveLength(4);
    expect(dots[0]?.getAttribute("data-state")).toBe("complete");
    expect(dots[1]?.getAttribute("data-state")).toBe("current");
  });

  it("renders the speed check lesson inside the beginner deck", () => {
    renderPath("/learn/beginner");

    for (let index = 0; index < 4; index += 1) {
      const nextButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Next"));
      act(() => {
        nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    expect(container.textContent).toContain("Ready for a speed check?");
    expect(container.textContent).toContain("Finish the speed check to continue.");
  });
});
