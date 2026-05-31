// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainNav } from "./MainNav";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MainNav", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onToggleMobile = vi.fn();
  const onCloseMobile = vi.fn();
  const onOpenStayUpdated = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onToggleMobile.mockReset();
    onCloseMobile.mockReset();
    onOpenStayUpdated.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderNav(initialEntries = ["/dashboard"]) {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={initialEntries}>
          <MainNav
            mobileOpen={false}
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            onOpenStayUpdated={onOpenStayUpdated}
            learnEnabled
            showBetaBadge={false}
          />
        </MemoryRouter>
      );
    });
  }

  function renderNavWithLearnDisabled() {
    act(() => {
      root.render(
        <MemoryRouter>
          <MainNav
            mobileOpen={false}
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            onOpenStayUpdated={onOpenStayUpdated}
            learnEnabled={false}
            showBetaBadge={false}
          />
        </MemoryRouter>
      );
    });
  }

  it("renders desktop and mobile stay updated triggers", () => {
    renderNav();

    const buttons = Array.from(container.querySelectorAll("button"));
    const desktopButton = buttons.find((button) => button.textContent?.includes("Stay Updated"));
    const mobileButton = buttons.find((button) => button.getAttribute("aria-label") === "Stay Updated");
    const menuButton = buttons.find((button) => button.getAttribute("aria-label") === "Open navigation menu");

    expect(desktopButton).toBeTruthy();
    expect(desktopButton?.className).toContain("main-nav__stay-updated");
    expect(mobileButton).toBeTruthy();
    expect(menuButton).toBeTruthy();
  });

  it("uses the same open handler for desktop and mobile stay updated buttons", () => {
    renderNav();

    const buttons = Array.from(container.querySelectorAll("button"));
    const desktopButton = buttons.find((button) => button.textContent?.includes("Stay Updated"));
    const mobileButton = buttons.find((button) => button.getAttribute("aria-label") === "Stay Updated");

    act(() => {
      desktopButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      mobileButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenStayUpdated).toHaveBeenCalledTimes(2);
  });

  it("points the brand and dashboard links to /dashboard and includes insights", () => {
    renderNav();

    const links = Array.from(container.querySelectorAll("a"));
    const brandLink = links.find((link) => link.className.includes("main-nav__brand"));
    const dashboardLink = links.find((link) => link.textContent?.includes("Dashboard"));
    const insightsLink = links.find((link) => link.textContent?.includes("Insights"));

    expect(brandLink?.getAttribute("href")).toBe("/dashboard");
    expect(dashboardLink?.getAttribute("href")).toBe("/dashboard");
    expect(insightsLink?.getAttribute("href")).toBe("/insights");
  });

  it("marks insights active on the insights route", () => {
    renderNav(["/insights"]);

    const insightsLink = Array.from(container.querySelectorAll("a"))
      .find((link) => link.textContent?.includes("Insights"));

    expect(insightsLink?.className).toContain("is-active");
  });

  it("shows learn as a disabled item when learn is disabled", () => {
    renderNavWithLearnDisabled();

    expect(container.textContent).toContain("Learn");
    const learnLink = Array.from(container.querySelectorAll("a")).find((link) => link.getAttribute("href") === "/learn?all=1");
    const disabledLearnItem = Array.from(container.querySelectorAll("span")).find((item) => item.textContent?.includes("Learn"));

    expect(learnLink).toBeUndefined();
    expect(disabledLearnItem?.className).toContain("is-disabled");
  });

  it("keeps only stay updated visible in the calibration nav", () => {
    renderNav(["/calibration"]);

    expect(container.querySelector(".main-nav")?.className).toContain("main-nav--minimal");
    expect(container.textContent).not.toContain("Insights");
    expect(container.textContent).not.toContain("Learn");
    expect(container.textContent).not.toContain("Practice");
    expect(container.textContent).toContain("Stay Updated");
    expect(container.querySelector(".main-nav__toggle")).toBeNull();
  });
});
