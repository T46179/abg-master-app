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

  function renderNav() {
    act(() => {
      root.render(
        <MemoryRouter>
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
});
