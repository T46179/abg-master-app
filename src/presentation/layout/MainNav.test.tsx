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
  const onOpenStayUpdated = vi.fn();
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
            mobileProgress={mobileProgress}
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
            mobileProgress={mobileProgress}
          />
        </MemoryRouter>
      );
    });
  }

  it("keeps Stay Updated in the desktop header and out of the mobile header", () => {
    renderNav();

    const buttons = Array.from(container.querySelectorAll("button"));
    const desktopButton = buttons.find((button) => button.textContent?.includes("Stay Updated"));
    const menuButton = buttons.find((button) => button.getAttribute("aria-label") === "Open navigation menu");

    expect(desktopButton).toBeTruthy();
    expect(desktopButton?.className).toContain("main-nav__stay-updated");
    expect(container.querySelector(".main-nav__mobile-stay-updated")).toBeNull();
    expect(menuButton).toBeTruthy();
  });

  it("keeps the desktop Stay Updated handler", () => {
    renderNav();

    const buttons = Array.from(container.querySelectorAll("button"));
    const desktopButton = buttons.find((button) => button.textContent?.includes("Stay Updated"));

    act(() => {
      desktopButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenStayUpdated).toHaveBeenCalledTimes(1);
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
            onOpenStayUpdated={onOpenStayUpdated}
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
            onOpenStayUpdated={onOpenStayUpdated}
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
          onOpenStayUpdated={onOpenStayUpdated}
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
    const stayUpdatedButton = drawer?.querySelector<HTMLButtonElement>(".mobile-nav-drawer__stay-updated");
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => {
      await new Promise(resolve => window.setTimeout(resolve, 20));
    });
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      stayUpdatedButton?.focus();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes the drawer from its backdrop and opens Stay Updated from its footer", () => {
    function InteractiveNav() {
      const [mobileOpen, setMobileOpen] = useState(true);
      return (
        <MainNav
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen(value => !value)}
          onCloseMobile={() => setMobileOpen(false)}
          onOpenStayUpdated={() => {
            onOpenStayUpdated();
            setMobileOpen(false);
          }}
          learnEnabled
          showBetaBadge={false}
          mobileProgress={mobileProgress}
        />
      );
    }

    act(() => {
      root.render(<MemoryRouter><InteractiveNav /></MemoryRouter>);
    });

    const drawer = document.getElementById("mobile-navigation-drawer");
    const footerButton = drawer?.querySelector<HTMLButtonElement>(".mobile-nav-drawer__stay-updated");
    act(() => {
      footerButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenStayUpdated).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("");

    act(() => {
      root.render(<MemoryRouter><InteractiveNav key="backdrop" /></MemoryRouter>);
    });
    const backdrop = document.body.querySelector<HTMLDivElement>(".mobile-nav-drawer__backdrop");
    expect(document.body.querySelector(".mobile-nav-drawer")?.className).toContain("is-open");
    expect(document.body.style.overflow).toBe("hidden");
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");
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
