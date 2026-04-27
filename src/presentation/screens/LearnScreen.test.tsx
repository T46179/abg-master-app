// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearnScreen } from "./LearnScreen";
import { LearnLessonScreen } from "./LearnLessonScreen";
import { getLearnUnlockMilestoneForLevelTransition } from "../learn/content";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUserLevel = vi.hoisted(() => ({ value: 1 }));
const mockLearnProgress = vi.hoisted(() => ({ value: {} as Record<string, { completedLessonCount: number; completed: boolean }> }));
const setUserState = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      status: "ready",
      errorMessage: null,
      userState: {
        level: mockUserLevel.value,
        learnProgress: mockLearnProgress.value
      }
    },
    setUserState
  })
}));

describe("Learn screens", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockUserLevel.value = 1;
    mockLearnProgress.value = {};
    setUserState.mockClear();
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
        <MemoryRouter key={path} initialEntries={[path]}>
          <Routes>
            <Route path="/learn" element={<LearnScreen />} />
            <Route path="/learn/:difficulty" element={<LearnLessonScreen />} />
          </Routes>
        </MemoryRouter>
      );
    });
  }

  it("renders level 1 learn modules with intermediate available and later modules locked", () => {
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
    expect(container.textContent).not.toContain("Master +");
    expect(container.textContent).not.toContain("Stewart analysis");
    expect(container.textContent).not.toContain("Build intuition about acid-base balance before you interpret full blood gases.");
    expect(container.textContent).not.toContain("Recognize pH status and name the main acid-base pattern fast.");
    expect(container.textContent).toContain("6 lessons");
    expect(container.textContent).toContain("5 lessons");
    expect(container.textContent).not.toMatch(/\b0% Complete/);
    expect(container.textContent).not.toContain("Pre-beginner");
    expect(container.textContent).not.toContain("Module 1");
    expect(container.textContent).not.toContain("Secret");
    expect(container.textContent).not.toContain("Locked at Level 25");
    expect(container.textContent).toContain("Coming Soon");
    expect(container.textContent).not.toContain("Unlocks at Level 25");

    const moduleCards = Array.from(container.querySelectorAll<HTMLElement>(".learn-level-card"));
    const unlockedLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.learn-level-card__cta"));
    const lockedButtons = Array.from(container.querySelectorAll<HTMLButtonElement>(".learn-level-card.is-locked .learn-level-card__cta"));

    expect(moduleCards).toHaveLength(5);
    expect(moduleCards.every(card => card.classList.contains("is-accent-preview"))).toBe(true);
    expect(lockedButtons).toHaveLength(2);
    expect(unlockedLinks).toHaveLength(3);
    expect(unlockedLinks.map(link => link.getAttribute("href"))).toEqual([
      "/learn/foundations",
      "/learn/beginner",
      "/learn/intermediate"
    ]);
    expect(unlockedLinks.every(link => link.textContent?.includes("Start Learning"))).toBe(true);
    expect(container.querySelectorAll(".learn-level-card__progress .progress-bar__fill")).toHaveLength(0);
  });

  it("shows learn module progress pills only after a module has started", () => {
    mockLearnProgress.value = {
      foundations: {
        completedLessonCount: 1,
        completed: false
      }
    };

    renderPath("/learn");

    expect(container.textContent).toContain("6 lessons");
    expect(container.textContent).toContain("17% Complete");
    expect(container.querySelector<HTMLAnchorElement>('a[href="/learn/foundations"]')?.textContent).toContain("Continue");
    expect(container.textContent).not.toMatch(/\b0% Complete/);
    expect(container.querySelectorAll(".learn-level-card__pill")).toHaveLength(6);
  });

  it("changes the module CTA to Continue after the first module page has been seen", () => {
    mockLearnProgress.value = {
      foundations: {
        completedLessonCount: 0,
        completed: false
      }
    };

    renderPath("/learn");

    expect(container.querySelector<HTMLAnchorElement>('a[href="/learn/foundations"]')?.textContent).toContain("Continue");
    expect(container.textContent).not.toMatch(/\b0% Complete/);
  });

  it("shows full completion when a learn module is completed", () => {
    mockLearnProgress.value = {
      foundations: {
        completedLessonCount: 5,
        completed: true
      }
    };

    renderPath("/learn");

    expect(container.textContent).toContain("100% Complete");
    expect(container.querySelector<HTMLAnchorElement>('a[href="/learn/foundations"]')?.textContent).toContain("Review");
  });

  it("keeps advanced and master cards disabled as coming soon across higher levels while intermediate stays open", () => {
    const expectations = [
      { level: 5, links: ["/learn/foundations", "/learn/beginner", "/learn/intermediate"], hiddenVisible: false, comingSoonCount: 2 },
      { level: 10, links: ["/learn/foundations", "/learn/beginner", "/learn/intermediate"], hiddenVisible: false, comingSoonCount: 2 },
      { level: 20, links: ["/learn/foundations", "/learn/beginner", "/learn/intermediate"], hiddenVisible: false, comingSoonCount: 2 },
      { level: 25, links: ["/learn/foundations", "/learn/beginner", "/learn/intermediate", "/learn/hidden"], hiddenVisible: true, comingSoonCount: 2 }
    ];

    expectations.forEach(expectation => {
      mockUserLevel.value = expectation.level;
      renderPath("/learn");

      const unlockedLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.learn-level-card__cta"));
      const lockedButtons = Array.from(container.querySelectorAll<HTMLButtonElement>(".learn-level-card.is-locked .learn-level-card__cta"));
      expect(unlockedLinks.map(link => link.getAttribute("href"))).toEqual(expectation.links);
      expect(lockedButtons.filter(button => button.textContent?.includes("Coming Soon"))).toHaveLength(expectation.comingSoonCount);
      expect(container.textContent?.includes("Master +")).toBe(expectation.hiddenVisible);
    });
  });

  it("applies the configured palette variables to each learn module card", () => {
    mockUserLevel.value = 25;
    renderPath("/learn");

    const expectedPalettes = [
      ["#FFF9ED", "#FFEFD6", "#FFEFD6", "#FFE0B2"],
      ["#EFF8FF", "#DBEEFF", "#DBEEFF", "#B8DEFF"],
      ["#F0F9F4", "#DDF3E4", "#DDF3E4", "#B8E6CC"],
      ["#FFF5F0", "#FFE8DC", "#FFE8DC", "#FFCDB0"],
      ["#F5F0FF", "#EBE0FF", "#EBE0FF", "#D6C2FF"],
      ["#F8F0FF", "#F0E0FF", "#F0E0FF", "#D8B4FF"]
    ];

    const moduleCards = Array.from(container.querySelectorAll<HTMLElement>(".learn-level-card"));

    expect(moduleCards.map(card => [
      card.style.getPropertyValue("--learn-card-bg-start"),
      card.style.getPropertyValue("--learn-card-bg-end"),
      card.style.getPropertyValue("--learn-card-accent-light"),
      card.style.getPropertyValue("--learn-card-accent-dark")
    ])).toEqual(expectedPalettes);
  });

  it("applies each module accent color to the lesson progress indicator", () => {
    mockUserLevel.value = 25;

    const expectedAccents = [
      ["/learn/foundations", "#FFE0B2"],
      ["/learn/beginner", "#B8DEFF"],
      ["/learn/intermediate", "#B8E6CC"],
      ["/learn/advanced", "#FFCDB0"],
      ["/learn/master", "#D6C2FF"],
      ["/learn/hidden", "#D8B4FF"]
    ];

    expectedAccents.forEach(([path, accentDark]) => {
      renderPath(path);

      expect(container.querySelector<HTMLElement>(".learn-deck__surface")?.style.getPropertyValue("--learn-card-accent-dark")).toBe(accentDark);
    });
  });

  it("redirects direct lesson routes when the module is locked or hidden", () => {
    mockUserLevel.value = 1;
    renderPath("/learn/advanced");
    expect(container.querySelector(".learn-overview")).not.toBeNull();
    expect(container.querySelector(".learn-deck-screen")).toBeNull();

    mockUserLevel.value = 25;
    renderPath("/learn/advanced");
    expect(container.querySelector(".learn-overview")).not.toBeNull();
    expect(container.querySelector(".learn-deck-screen")).toBeNull();

    mockUserLevel.value = 24;
    renderPath("/learn/hidden");
    expect(container.querySelector(".learn-overview")).not.toBeNull();
    expect(container.querySelector(".learn-deck-screen")).toBeNull();
  });

  it("allows direct lesson routes after the module unlocks", () => {
    mockUserLevel.value = 5;
    renderPath("/learn/intermediate");
    expect(container.querySelector(".learn-deck-screen")).not.toBeNull();

    mockUserLevel.value = 25;
    renderPath("/learn/hidden");
    expect(container.querySelector(".learn-deck-screen")).not.toBeNull();
  });

  it("does not resume a stored module that is still coming soon", () => {
    mockUserLevel.value = 25;
    window.localStorage.setItem("abg-master:learn:last-module", "advanced");

    renderPath("/learn");

    expect(container.querySelector(".learn-overview")).not.toBeNull();
    expect(container.querySelector(".learn-deck-screen")).toBeNull();
  });

  it("allows direct lesson routes for intermediate now that the module is available", () => {
    mockUserLevel.value = 1;

    renderPath("/learn/intermediate");

    expect(container.querySelector(".learn-overview")).toBeNull();
    expect(container.querySelector(".learn-deck-screen")).not.toBeNull();
  });

  it("advances lesson content and updates progress dot states", () => {
    renderPath("/learn/foundations");

    expect(container.textContent).toContain("What is pH?");
    expect(setUserState).toHaveBeenCalledWith({
      level: 1,
      learnProgress: {
        foundations: {
          completedLessonCount: 0,
          completed: false
        }
      }
    });
    expect(container.querySelector(".learn-scale-card")).toBeNull();
    expect(container.querySelector(".learn-deck__body")?.textContent).not.toContain("Why this matters");
    expect(container.querySelector(".ph-scale-visualiser")).not.toBeNull();
    expect(container.querySelector(".learn-deck__body")?.textContent).toContain("Normal");
    expect(container.querySelector(".learn-deck__body")?.textContent).toContain("pH");
    expect(container.querySelector(".learn-deck__body")?.textContent).toContain("7.35");
    expect(container.querySelector(".learn-deck__body")?.textContent).toContain("7.45");
    expect(container.querySelector(".learn-deck__body")?.textContent).toContain("pH");
    expect(container.querySelector(".ph-scale-visualiser__key-idea")?.textContent).toContain("normal pH");
    expect(container.querySelector(".learn-deck__header")?.textContent).not.toContain("Master the basics");
    expect(container.textContent).toContain("All modules");
    expect(container.textContent).not.toContain("Back to modules");
    expect(Array.from(container.querySelectorAll("button")).some(button => button.textContent === "Back")).toBe(false);

    const nextButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Next"));
    act(() => {
      nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("The two levers");
    expect(container.querySelector(".learn-card-intro")?.textContent).toContain("pH is controlled by two systems");
    expect(container.querySelectorAll(".learn-two-levers-images img")).toHaveLength(2);
    expect(container.textContent).toContain("CO₂");
    expect(container.textContent).toContain("Produced by metabolism");
    expect(container.textContent).toContain("HCO₃⁻");
    expect(container.textContent).toContain("Regulated by the kidneys");
    expect(container.textContent).not.toContain("Think in systems");
    expect(container.querySelector(".learn-carbonic-equation")).toBeNull();
    expect(setUserState).toHaveBeenCalledWith({
      level: 1,
      learnProgress: {
        foundations: {
          completedLessonCount: 1,
          completed: false
        }
      }
    });
    expect(Array.from(container.querySelectorAll("button")).some(button => button.textContent === "Back")).toBe(true);

    const dots = Array.from(container.querySelectorAll("[data-state]"));
    expect(dots).toHaveLength(6);
    expect(dots[0]?.getAttribute("data-state")).toBe("complete");
    expect(dots[1]?.getAttribute("data-state")).toBe("current");
  });

  it("renders the speed check lesson inside the foundations deck", () => {
    renderPath("/learn/foundations");

    for (let index = 0; index < 3; index += 1) {
      const nextButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Next"));
      act(() => {
        nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    expect(container.textContent).toContain("Test your reflexes");
    expect(container.textContent).toContain("Classify the pH values as fast as you can");
    expect(container.textContent).toContain("Begin");
  });

  it("resumes the stored intermediate module when it is available", () => {
    mockUserLevel.value = 1;
    window.localStorage.setItem("abg-master:learn:last-module", "intermediate");

    renderPath("/learn");

    expect(container.querySelector(".learn-overview")).toBeNull();
    expect(container.querySelector(".learn-deck-screen")).not.toBeNull();
  });

  it("shows the requested intermediate pages in order while keeping the module chrome", () => {
    mockUserLevel.value = 1;
    renderPath("/learn/intermediate");

    const expectedTitles = [
      "Compensation",
      "The body fights back",
      "The compensation rules",
      "The compensation rules",
      "Expected vs measured",
      "Worked example",
      "When the number misses",
      "Compensation checklist",
      "Completed!"
    ];

    const expectedDotCount = 9;

    expect(container.querySelector(".learn-card-intro")?.textContent).toContain(
      "Learn how the body responds to an acid-base disorder, then decide whether that response is expected - or whether a second disorder is hiding"
    );

    expectedTitles.forEach((title, index) => {
      expect(container.querySelector(".learn-deck__eyebrow")?.textContent).toBe("Intermediate");
      expect(container.querySelector(".learn-deck__header h1")?.textContent).toBe(title);
      expect(container.querySelectorAll("[data-state]")).toHaveLength(expectedDotCount);

      if (title === "The body fights back") {
        expect(container.querySelector(".learn-section-heading")?.textContent).toBe("Compensation");
        expect(container.querySelector(".learn-carbonic-equation")?.textContent).toContain("\u21CC");
        expect(container.querySelector(".learn-deck__body .learn-body-fights-back-lesson")).not.toBeNull();
        expect(container.querySelector(".learn-key-message")?.textContent).toContain(
          "Compensation is a response, not a cure. It moves the pH back toward normal, but it does not remove the original disorder"
        );
      }

      if (title === "The compensation rules" && index === 2) {
        const bodyText = container.querySelector(".learn-deck__body")?.textContent ?? "";

        expect(container.querySelector(".learn-card-intro")?.textContent).toContain(
          "Identify the primary disorder, then use the matching rule to estimate the expected compensatory response"
        );
        expect(bodyText).toContain("Metabolic");
        expect(bodyText).toContain("When the primary problem is metabolic");
        expect(bodyText).toContain("Metabolic Acidosis");
        expect(bodyText).toContain("Metabolic Alkalosis");
        expect(bodyText).toContain("Acceptable range:");
        expect(bodyText).toContain("2 mmHg");
        expect(bodyText).toContain("3 mmHg");
        expect(container.querySelector('a[href="/blood-gas-compensation-rules"]')?.textContent).toContain("Why these rules?");
      }

      if (title === "The compensation rules" && index === 3) {
        const bodyText = container.querySelector(".learn-deck__body")?.textContent ?? "";

        expect(container.querySelector(".learn-card-intro")?.textContent).toContain(
          "Identify the primary disorder, then use the matching rule to estimate the expected compensatory response"
        );
        expect(bodyText).toContain("Respiratory");
        expect(bodyText).toContain("When the primary problem is respiratory");
        expect(bodyText).toContain("Acute Respiratory Acidosis");
        expect(bodyText).toContain("Chronic Respiratory Acidosis");
        expect(bodyText).toContain("Acute Respiratory Alkalosis");
        expect(bodyText).toContain("Chronic Respiratory Alkalosis");
        expect(bodyText).toContain("Acceptable range:");
        expect(bodyText).toContain("2 mmol/L");
        expect(container.querySelector('a[href="/blood-gas-compensation-rules"]')?.textContent).toContain("Why these rules?");
      }

      if (index < expectedTitles.length - 1) {
        const nextButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Next"));
        act(() => {
          nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
      } else {
        expect(Array.from(container.querySelectorAll("button")).some(button => button.textContent?.includes("Finish lesson"))).toBe(true);
      }
    });
  });
});
describe("learn unlock milestone detection for practice results", () => {
  it("detects the highest newly crossed learn unlock threshold", () => {
    expect(getLearnUnlockMilestoneForLevelTransition(4, 5)).toBeNull();
    expect(getLearnUnlockMilestoneForLevelTransition(9, 10)?.title).toBe("Advanced");
    expect(getLearnUnlockMilestoneForLevelTransition(19, 20)?.title).toBe("Master");
    expect(getLearnUnlockMilestoneForLevelTransition(24, 25)?.title).toBe("Master +");
  });

  it("does not produce an unlock milestone when already above the threshold", () => {
    expect(getLearnUnlockMilestoneForLevelTransition(5, 5)).toBeNull();
    expect(getLearnUnlockMilestoneForLevelTransition(10, 11)).toBeNull();
    expect(getLearnUnlockMilestoneForLevelTransition(25, 25)).toBeNull();
  });
});









