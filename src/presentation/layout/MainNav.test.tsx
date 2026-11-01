// @vitest-environment jsdom

import { act, useState } from "react";
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
  const mobileProgress = {
    level: 14,
    tier: "Advanced",
    progressPercent: 94,
    isBlocked: false,
    remainingLabel: "15 XP until Level 15",
    versionLabel: "Beta build · v1.4"
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onToggleMobile.mockReset();
    onCloseMobile.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllEnvs();
  });

  function renderNav(initialEntries = ["/dashboard"]) {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={initialEntries}>
          <MainNav
            mobileOpen={false}
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            learnEnabled
            showBetaBadge={false}
            mobileProgress={mobileProgress}
          />
        </MemoryRouter>
      );
    });
  }

  it.each(["exam-pilot", "account-staging", "production"])("keeps account preview controls out of %s navigation", mode => {
    vi.stubEnv("MODE", mode);
    renderNav(["/dev/exam-pilot"]);
    expect(container.querySelector("#exam-account-nav-slot")).toBeNull();
    expect(container.querySelector('a[href="/exam"]')).toBeTruthy();
  });
  it("keeps local Exam navigation at the unified pilot and provides its profile slot", () => {
    vi.stubEnv("MODE", "development");
    renderNav(["/dev/exam-pilot"]);
    expect(container.querySelector("#exam-account-nav-slot")).toBeTruthy();
    expect(container.querySelector('a[href="/dev/exam-pilot"]')).toBeTruthy();
  });

  function renderNavWithLearnDisabled() {
    act(() => {
      root.render(
        <MemoryRouter>
          <MainNav
            mobileOpen={false}
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            learnEnabled={false}
            showBetaBadge={false}
            mobileProgress={mobileProgress}
          />
        </MemoryRouter>
      );
    });
  }

  it("places Settings before the mobile menu trigger", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <MainNav
            mobileOpen={false}
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            learnEnabled
            showBetaBadge={false}
            mobileProgress={mobileProgress}
            settingsOpen={false}
            pressureUnit="mmHg"
            onToggleSettings={vi.fn()}
            onCloseSettings={vi.fn()}
            onPressureUnitChange={vi.fn()}
          />
        </MemoryRouter>
      );
    });

    const controls = container.querySelector(".main-nav__controls");
    expect(Array.from(controls?.children ?? [], child => child.className)).toEqual([
      "main-nav__settings",
      "main-nav__toggle"
    ]);
  });

  it.each(["/sign-in", "/create-account", "/forgot-password"])("does not highlight Exam on %s", pathname => {
    renderNav([pathname]);
    expect(container.querySelector(".main-nav__desktop a.is-active")).toBeNull();
    expect(container.querySelector(".main-nav__active-indicator.is-ready")).toBeNull();
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

  it("always renders Learn as a routed drawer item", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <MainNav
            mobileOpen
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            learnEnabled={false}
            showBetaBadge={false}
            mobileProgress={mobileProgress}
          />
        </MemoryRouter>
      );
    });

    expect(document.body.querySelector('a[href="/learn?all=1"]')).toBeTruthy();
  });

  it("renders the open drawer with the active NavLink pill and live progress", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/insights"]}>
          <MainNav
            mobileOpen
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            learnEnabled
            showBetaBadge
            mobileProgress={mobileProgress}
          />
        </MemoryRouter>
      );
    });

    const drawer = document.getElementById("mobile-navigation-drawer");
    const insightsLink = drawer?.querySelector('a[href="/insights"]');
    expect(drawer?.getAttribute("role")).toBe("dialog");
    expect(drawer?.getAttribute("aria-modal")).toBe("true");
    expect(insightsLink?.className).toContain("is-active");
    expect(drawer?.textContent).toContain("Level 14 · Advanced");
    expect(drawer?.textContent).toContain("15 XP until Level 15");
  });

  it("focuses the close button, traps focus, locks scrolling, and restores focus after Escape", async () => {
    function InteractiveNav() {
      const [mobileOpen, setMobileOpen] = useState(false);
      return (
        <MainNav
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen(value => !value)}
          onCloseMobile={() => setMobileOpen(false)}
          learnEnabled
          showBetaBadge={false}
          mobileProgress={mobileProgress}
        />
      );
    }

    act(() => {
      root.render(<MemoryRouter><InteractiveNav /></MemoryRouter>);
    });

    const trigger = container.querySelector<HTMLButtonElement>(".main-nav__toggle");
    act(() => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const drawer = document.getElementById("mobile-navigation-drawer");
    const closeButton = drawer?.querySelector<HTMLButtonElement>(".mobile-nav-drawer__close");
    const lastLink = drawer?.querySelector<HTMLAnchorElement>("nav a:last-child");
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => {
      await new Promise(resolve => window.setTimeout(resolve, 20));
    });
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      lastLink?.focus();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes the drawer from its backdrop", () => {
    function InteractiveNav() {
      const [mobileOpen, setMobileOpen] = useState(true);
      return (
        <MainNav
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen(value => !value)}
          onCloseMobile={() => setMobileOpen(false)}
          learnEnabled
          showBetaBadge={false}
          mobileProgress={mobileProgress}
        />
      );
    }

    act(() => {
      root.render(<MemoryRouter><InteractiveNav /></MemoryRouter>);
    });

    const backdrop = document.body.querySelector<HTMLDivElement>(".mobile-nav-drawer__backdrop");
    expect(document.body.querySelector(".mobile-nav-drawer")?.className).toContain("is-open");
    expect(document.body.style.overflow).toBe("hidden");
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps Settings available in the minimal calibration nav", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/calibration"]}>
          <MainNav
            mobileOpen={false}
            onToggleMobile={onToggleMobile}
            onCloseMobile={onCloseMobile}
            learnEnabled
            showBetaBadge={false}
            mobileProgress={mobileProgress}
            settingsOpen={false}
            pressureUnit="mmHg"
            onToggleSettings={vi.fn()}
            onCloseSettings={vi.fn()}
            onPressureUnitChange={vi.fn()}
          />
        </MemoryRouter>
      );
    });

    expect(container.querySelector(".main-nav")?.className).toContain("main-nav--minimal");
    expect(container.textContent).not.toContain("Insights");
    expect(container.textContent).not.toContain("Learn");
    expect(container.textContent).not.toContain("Practice");
    expect(container.querySelector(".main-nav__controls")?.firstElementChild?.className).toBe("main-nav__settings");
    expect(container.querySelector(".main-nav__toggle")).toBeNull();
  });
});
