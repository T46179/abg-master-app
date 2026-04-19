// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./LandingScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const trackEvent = vi.fn();
const trackPageView = vi.fn();

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      status: "ready",
      supabase: null,
      supabaseEnabled: false
    }
  })
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

  it("renders the landing hero and routes primary ctas to practice", () => {
    renderScreen();

    expect(trackPageView).toHaveBeenCalledWith("landing");
    expect(container.textContent).toContain("Master Blood Gas Interpretation");

    const links = Array.from(container.querySelectorAll("a"));
    const primaryLink = links.find(link => link.textContent?.includes("Begin Your First Case"));
    const headerLink = links.find(link => link.textContent?.includes("Dashboard"));

    expect(primaryLink?.getAttribute("href")).toBe("/practice");
    expect(headerLink?.getAttribute("href")).toBe("/dashboard");
  });

  it("shows learn in navigation while keeping launch content visible", () => {
    renderScreen();

    expect(container.textContent).toContain("Four Levels of Mastery");

    const learnLink = Array.from(container.querySelectorAll("a")).find(link => link.getAttribute("href") === "/learn");

    expect(learnLink).toBeTruthy();
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
