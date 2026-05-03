// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "./DashboardScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockStorage = vi.hoisted(() => ({
  resetUserState: vi.fn(async () => undefined),
  saveSeenCaseState: vi.fn(),
  savePracticeIntroSeen: vi.fn(),
  saveAppAreaVisited: vi.fn(),
  saveAdvancedRangesPreference: vi.fn(),
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

describe("DashboardScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let originalLocation: Location;

  beforeEach(() => {
    window.localStorage.clear();
    mockStorage.resetUserState.mockClear();
    mockStorage.saveSeenCaseState.mockClear();
    mockStorage.savePracticeIntroSeen.mockClear();
    mockStorage.saveAppAreaVisited.mockClear();
    mockStorage.saveAdvancedRangesPreference.mockClear();
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

  it("links next case to the remembered practice difficulty", () => {
    mockStorage.loadLastPracticeDifficulty.mockReturnValue("advanced");

    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardScreen />
        </MemoryRouter>
      );
    });

    const nextCaseLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"))
      .find(link => link.textContent?.includes("Next case"));

    expect(nextCaseLink?.getAttribute("href")).toBe("/practice?difficulty=advanced");
  });
});
