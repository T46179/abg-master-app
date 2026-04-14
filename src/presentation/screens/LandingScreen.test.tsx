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

  it("switches the mobile showcase content when a dot is selected", () => {
    renderScreen();

    expect(container.textContent).toContain("Detailed Explanations");
    expect(container.textContent).not.toContain("Interactive Case Workflow");

    const buttons = Array.from(container.querySelectorAll("button"));
    const interactiveDot = buttons.find(button => button.getAttribute("aria-label") === "Show Interactive Case Workflow");

    act(() => {
      interactiveDot?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Interactive Case Workflow");
    expect(container.textContent).not.toContain("Detailed Explanations");
  });
});
