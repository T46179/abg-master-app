// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "./DashboardScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const trackEvent = vi.hoisted(() => vi.fn());

vi.mock("../../core/analytics", () => ({
  trackEvent
}));

const mockStorage = vi.hoisted(() => ({
  resetUserState: vi.fn(async () => undefined),
  saveSeenCaseState: vi.fn(),
  savePracticeIntroSeen: vi.fn(),
  saveAppAreaVisited: vi.fn(),
  saveAdvancedRangesPreference: vi.fn(),
  clearCalibrationCompletion: vi.fn(),
  loadLastPracticeDifficulty: vi.fn((): string | null => null),
  saveLastPracticeDifficulty: vi.fn()
}));

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      status: "ready",
      errorMessage: null,
      payload: {
        progressionConfig: {
          release_flags: { enable_all_difficulties: true },
          difficulty_labels: { 1: "beginner", 2: "intermediate", 3: "advanced", 4: "master" }
        },
        dashboardState: null,
        defaultUserState: null,
        cases: []
      },
      userState: {
        xp: 0,
        level: 1,
        casesCompleted: 0,
        abandonedCases: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        streak: 0,
        dailyCasesUsed: 0,
        lastCaseDate: null,
        unlockedDifficulties: ["beginner"],
        isPremium: false,
        badges: [],
        recentResults: [],
        recentPracticeAttempts: [
          { difficulty: "beginner", correctSteps: 1, totalSteps: 4 },
          { difficulty: "beginner", correctSteps: 3, totalSteps: 4 },
          { difficulty: "intermediate", correctSteps: 4, totalSteps: 4 }
        ],
        appliedProtectedCaseTokens: [],
        learnProgress: {
          foundations: {
            completedLessonCount: 2,
            completed: false
          }
        }
      },
      storage: mockStorage
    }
  })
}));

vi.mock("../../app/useFeaturedCaseStatus", () => ({
  useFeaturedCaseStatus: () => ({
    loading: false,
    status: {
      state: "completed",
      releaseId: "featured-authored-001-r1",
      ctaEligible: false,
      opened: true,
      comparison: {
        status: "available",
        canonicalScore: 100,
        cohortSize: 10,
        percentileBand: 100,
        isTopScore: true
      }
    }
  })
}));

describe("DashboardScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let originalLocation: Location;

  beforeEach(() => {
    trackEvent.mockReset();
    window.localStorage.clear();
    mockStorage.resetUserState.mockClear();
    mockStorage.saveSeenCaseState.mockClear();
    mockStorage.savePracticeIntroSeen.mockClear();
    mockStorage.saveAppAreaVisited.mockClear();
    mockStorage.saveAdvancedRangesPreference.mockClear();
    mockStorage.clearCalibrationCompletion.mockClear();
    mockStorage.loadLastPracticeDifficulty.mockClear();
    mockStorage.loadLastPracticeDifficulty.mockReturnValue(null);
    mockStorage.saveLastPracticeDifficulty.mockClear();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    originalLocation = window.location;
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: Pick<Location, "assign"> }).location = {
      assign: vi.fn()
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    (window as unknown as { location: Location }).location = originalLocation;
  });

  it("resets learn module resume state and warns that learning progress is included", async () => {
    window.localStorage.setItem("abg-master:learn:last-module", "foundations");
    window.localStorage.setItem("abg-master:learn:foundations:lesson-index", "3");
    window.localStorage.setItem("abg-master:learn:beginner:lesson-index", "1");
    window.localStorage.setItem("abg-master:unrelated", "keep");

    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const resetButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Reset progress"));
    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("learning module progress"));
    expect(mockStorage.resetUserState).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("abg-master:learn:last-module")).toBeNull();
    expect(window.localStorage.getItem("abg-master:learn:foundations:lesson-index")).toBeNull();
    expect(window.localStorage.getItem("abg-master:learn:beginner:lesson-index")).toBeNull();
    expect(window.localStorage.getItem("abg-master:unrelated")).toBe("keep");
  });

  it("links resume practice to the remembered practice difficulty", () => {
    mockStorage.loadLastPracticeDifficulty.mockReturnValue("advanced");

    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const nextCaseLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"))
      .find(link => link.textContent?.includes("Resume Practice"));

    expect(nextCaseLink?.getAttribute("href")).toBe("/practice?difficulty=advanced");
  });

  it("uses the same arrow asset for Resume Practice and Featured Case", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.dashboard-resume-button"));
    const resumeLink = links.find(link => link.textContent?.includes("Resume Practice"));
    const featuredLink = links.find(link => link.textContent?.includes("Retry Featured Case"));

    expect(featuredLink?.querySelector("img")?.getAttribute("src"))
      .toBe(resumeLink?.querySelector("img")?.getAttribute("src"));
    expect(featuredLink?.querySelector("svg")).toBeNull();
  });

  it("tracks the visible Featured entry and its retry click with tagged attribution", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const featuredLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"))
      .find(link => link.textContent?.includes("Retry Featured Case"));

    expect(featuredLink?.getAttribute("href"))
      .toBe("/featured-case?source=dashboard&action=retry&replay=1");
    expect(trackEvent).toHaveBeenCalledWith(
      "featured_case_entry_viewed",
      expect.objectContaining({
        release_id: "featured-authored-001-r1",
        entry_source: "dashboard",
        action: "retry",
        learner_level: 1,
        normal_cases_completed: 0,
        is_replay: true
      })
    );

    act(() => {
      featuredLink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trackEvent).toHaveBeenCalledWith(
      "featured_case_entry_clicked",
      expect.objectContaining({
        release_id: "featured-authored-001-r1",
        entry_source: "dashboard",
        action: "retry",
        is_replay: true
      })
    );
  });

  it("styles the completed Featured Case status with its completed modifier", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const status = container.querySelector(".dashboard-coming-soon");

    expect(status?.textContent?.trim()).toBe("Completed");
    expect(status?.classList.contains("is-completed")).toBe(true);
  });

  it("shows a separate neutral rank pill for a completed Featured Case", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const completedStatus = container.querySelector(".dashboard-coming-soon");
    const comparisonRank = container.querySelector(".dashboard-comparison-rank");

    expect(completedStatus?.textContent?.trim()).toBe("Completed");
    expect(completedStatus?.classList.contains("is-completed")).toBe(true);
    expect(comparisonRank?.textContent?.trim()).toBe("Top score");
    expect(comparisonRank?.classList.contains("is-completed")).toBe(false);
  });

  it("shows live progress values and recent step accuracy", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const performanceCard = Array.from(container.querySelectorAll<HTMLElement>(".stat-card"))
      .find(card => card.textContent?.includes("Accuracy"));

    expect(performanceCard?.querySelector(".stat-card__value")?.textContent).toBe("67%");
    expect(performanceCard?.textContent).toContain("Last 10 cases");
    expect(performanceCard?.querySelector(".stat-card__meta-trigger")).toBeNull();
    expect(container.textContent).toContain("Level 1");
    expect(container.textContent).toContain("Cases Solved");
    expect(container.textContent).toContain("Daily Streak");
    expect(container.textContent).toContain("Beginner");
  });

  it("renders the learning path, featured cases, and clinical pearl actions", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Learning Progress");
    expect(container.textContent).toContain("Foundations");
    expect(container.textContent).toContain("Featured Case");
    expect(container.textContent).toContain("Clinical Pearl");
    expect(container.textContent).toContain("Beta build · v1.4");
    const footerLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>(".dashboard-page-footer__navigation a"));
    expect(footerLinks.map(link => `${link.textContent}:${link.getAttribute("href")}`)).toEqual([
      "Updates:/updates",
      "Resources:/resources",
      "Contact:/contact",
      "About:/about",
      "Privacy:/privacy"
    ]);
    const privacyLink = container.querySelector<HTMLAnchorElement>(".dashboard-page-footer__privacy");
    expect(privacyLink?.getAttribute("href")).toBe("/privacy");
    expect(privacyLink?.getAttribute("target")).toBe("_blank");
    expect(privacyLink?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).toContain("Challenging and unique cases");
    expect(container.textContent).toContain("Based on real clinical scenarios");
    expect(container.textContent).not.toContain("Weekly themed sets");
    expect(container.textContent).not.toContain("Notify me when this launches");
    expect(container.querySelector<HTMLAnchorElement>('a[href="/learn/foundations?mode=continue"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Open Foundations module");
  });

  it("links all progress metric cards to insights", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const insightMetricLinks = container.querySelectorAll<HTMLAnchorElement>(".dashboard-stat-link");
    expect(insightMetricLinks).toHaveLength(4);
    insightMetricLinks.forEach(link => expect(link.getAttribute("href")).toBe("/insights"));
  });
});
