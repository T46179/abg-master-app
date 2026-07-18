// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./LandingScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const trackEvent = vi.fn();
const trackPageView = vi.fn();
const patchPracticeState = vi.fn();
const preloadProtectedPracticeSlots = vi.fn();
let currentState: Record<string, unknown>;

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: currentState,
    patchPracticeState
  })
}));

vi.mock("../../app/protectedPracticeSlots", () => ({
  preloadProtectedPracticeSlots: (...args: unknown[]) => preloadProtectedPracticeSlots(...args)
}));

vi.mock("../../core/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  trackPageView: (...args: unknown[]) => trackPageView(...args)
}));

describe("LandingScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let animationTime = 1000;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    animationTime = 1000;
    trackEvent.mockReset();
    trackPageView.mockReset();
    patchPracticeState.mockReset();
    preloadProtectedPracticeSlots.mockReset();
    preloadProtectedPracticeSlots.mockResolvedValue({});
    currentState = {
      status: "ready",
      supabase: null,
      supabaseEnabled: false,
      runtimeConfig: null,
      payload: null,
      storage: null,
      userId: null,
      userState: {
        xp: 0,
        level: 1,
        abandonedCases: 0,
        recentResults: [],
        casesCompleted: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        streak: 0,
        dailyCasesUsed: 0,
        lastCaseDate: null,
        unlockedDifficulties: ["beginner"],
        isPremium: false,
        badges: [],
        appliedProtectedCaseTokens: []
      },
      practiceState: {
        practiceSlotsByDifficulty: {}
      }
    };
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })));
    class IntersectionObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    }

    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const timeoutId = window.setTimeout(() => {
        animationTime += 1000;
        callback(animationTime);
      }, 0);

      return timeoutId;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      window.clearTimeout(handle);
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderScreen() {
    act(() => {
      root.render(
        <MemoryRouter>
          <LandingScreen />
        </MemoryRouter>
      );
    });
  }

  async function flushEffects() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("renders the landing hero and routes primary ctas to practice", () => {
    renderScreen();

    expect(trackPageView).toHaveBeenCalledWith("landing");
    expect(trackEvent).toHaveBeenCalledWith("landing_viewed", {
      source: "landing"
    });
    expect(container.textContent).toContain("Master Blood Gas Interpretation");

    const links = Array.from(container.querySelectorAll("a"));
    const primaryLink = links.find(link => link.textContent?.includes("Start Your First Case"));
    const headerLink = links.find(link => link.textContent?.includes("Dashboard"));

    expect(primaryLink?.getAttribute("href")).toBe("/practice");
    expect(headerLink?.getAttribute("href")).toBe("/dashboard");
  });

  it("tracks prominent landing cta clicks into practice", () => {
    renderScreen();

    const practiceLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href="/practice"]'))
      .filter(link => link.textContent?.includes("Start Your First Case"));

    expect(practiceLinks).toHaveLength(2);

    act(() => {
      practiceLinks.forEach(link => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    });

    expect(trackEvent).toHaveBeenCalledWith("landing_cta_clicked", {
      cta_label: "Start Your First Case",
      destination: "/practice",
      source: "landing"
    });

    const learnNavLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href="/learn?all=1"]'))
      .find(link => link.textContent?.trim() === "Learn");
    const practiceNavLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href="/practice"]'))
      .find(link => link.textContent?.trim() === "Practice");

    act(() => {
      learnNavLink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      practiceNavLink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trackEvent).toHaveBeenCalledWith("landing_cta_clicked", {
      cta_label: "Learn",
      destination: "/learn?all=1",
      source: "landing"
    });
    expect(trackEvent).toHaveBeenCalledWith("landing_cta_clicked", {
      cta_label: "Practice",
      destination: "/practice",
      source: "landing"
    });
    expect(trackEvent.mock.calls.filter(call => call[0] === "landing_cta_clicked")).toHaveLength(4);
  });

  it("shows learn in navigation while keeping launch content visible", () => {
    renderScreen();

    expect(container.textContent).toContain("Four Levels of Mastery");

    const learnLink = Array.from(container.querySelectorAll("a")).find(link => link.getAttribute("href") === "/learn?all=1");

    expect(learnLink).toBeTruthy();
  });

  it("preloads the highest accessible practice difficulty before background slots", async () => {
    const storage = {
      loadSeenCaseState: vi.fn(() => ({ advanced: ["seen-case"] }))
    };
    const primarySlots = { advanced: { caseToken: "advanced-token" } };
    const backgroundSlots = {
      ...primarySlots,
      beginner: { caseToken: "beginner-token" },
      intermediate: { caseToken: "intermediate-token" }
    };
    preloadProtectedPracticeSlots
      .mockResolvedValueOnce(primarySlots)
      .mockResolvedValueOnce(backgroundSlots);
    currentState = {
      ...currentState,
      supabase: {},
      runtimeConfig: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon"
      },
      payload: {
        deliveryMode: "protected_runtime",
        contentVersion: "beta-1",
        progressionConfig: {
          difficulty_unlock_levels: { 1: 1, 2: 5, 3: 10, 4: 20 },
          release_flags: {}
        },
        dashboardState: null,
        defaultUserState: null
      },
      storage,
      userId: "user-1",
      userState: {
        ...(currentState.userState as Record<string, unknown>),
        isPremium: true,
        level: 10,
        advancedUnlockedAt: "2026-05-10T00:00:00Z"
      }
    };

    renderScreen();
    await flushEffects();

    expect(preloadProtectedPracticeSlots).toHaveBeenCalledTimes(2);
    expect(preloadProtectedPracticeSlots.mock.calls[0]?.[0]).toMatchObject({
      contentVersion: "beta-1",
      userId: "user-1",
      difficulties: ["advanced"],
      selectionHints: {
        seenCaseIdsByDifficulty: { advanced: ["seen-case"] }
      }
    });
    expect(preloadProtectedPracticeSlots.mock.calls[1]?.[0]).toMatchObject({
      difficulties: ["beginner", "intermediate"]
    });
    expect(patchPracticeState).toHaveBeenLastCalledWith({
      practiceSlotsByDifficulty: backgroundSlots
    });
  });

  it("tracks stay updated submits from the landing page", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true
    } as Response);

    renderScreen();

    const openButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Stay Updated"));
    expect(openButton).toBeTruthy();

    act(() => {
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const emailInput = container.querySelector<HTMLInputElement>("#launch-notify-email");
    expect(emailInput).toBeTruthy();
    if (!emailInput) return;

    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(emailInput, "test@example.com");
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));

    const form = container.querySelector("form");
    expect(form).toBeTruthy();

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(trackEvent).toHaveBeenCalledWith("launch_notify_submitted");
  });
});
