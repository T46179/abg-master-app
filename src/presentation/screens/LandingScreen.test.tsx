// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./LandingScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      status: "ready",
      supabase: null,
      supabaseEnabled: false
    }
  })
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
    vi.stubGlobal("IntersectionObserver", vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => [])
    })));
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

  it("renders the landing hero and routes primary ctas to practice", () => {
    renderScreen();

    expect(container.textContent).toContain("Master Blood Gas Interpretation");

    const links = Array.from(container.querySelectorAll("a"));
    const primaryLink = links.find(link => link.textContent?.includes("Begin Your First Case"));
    const headerLink = links.find(link => link.textContent?.includes("Dashboard"));

    expect(primaryLink?.getAttribute("href")).toBe("/practice");
    expect(headerLink?.getAttribute("href")).toBe("/dashboard");
  });

  it("shows learn as disabled in navigation while keeping launch content visible", () => {
    renderScreen();

    expect(container.textContent).toContain("Four Levels of Mastery");

    const learnLink = Array.from(container.querySelectorAll("a")).find(link => link.getAttribute("href") === "/learn");
    const disabledLearnItem = Array.from(container.querySelectorAll("span")).find(item => item.textContent?.includes("Learn"));

    expect(learnLink).toBeUndefined();
    expect(disabledLearnItem?.className).toContain("is-disabled");
  });
});
