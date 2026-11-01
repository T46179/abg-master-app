// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retryPendingSubmissionNow = vi.fn();
const discardPendingSubmission = vi.fn();
const patchSessionState = vi.fn();
const savePressureUnitPreference = vi.fn();
const trackEvent = vi.fn();
const trackPageView = vi.fn();
const mockStorage = {
  loadSeenCaseState: () => ({}),
  loadPracticeIntroSeen: () => false,
  loadAppAreaVisited: () => false,
  savePressureUnitPreference
};

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      practiceState: {
        syncState: "idle",
        syncMessage: null,
        lastCaseSummary: null,
        pendingSubmission: null
      },
      payload: {
        progressionConfig: null,
        dashboardState: null,
        defaultUserState: null,
        cases: []
      },
      userState: {},
      sessionState: {
        pressureUnit: "mmHg"
      },
      storage: mockStorage,
      appStatus: {
        warnings: {},
        blocking: null
      }
    },
    patchSessionState,
    retryPendingSubmissionNow,
    discardPendingSubmission
  })
}));

vi.mock("../../core/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  trackPageView: (...args: unknown[]) => trackPageView(...args)
}));

import { AppShell } from "./AppShell";

describe("AppShell navigation settings", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    patchSessionState.mockReset();
    savePressureUnitPreference.mockReset();
    retryPendingSubmissionNow.mockReset();
    discardPendingSubmission.mockReset();
    trackEvent.mockReset();
    trackPageView.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn());
    if (!window.requestAnimationFrame) {
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
      vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle));
    }
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderShell() {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      );
    });
  }

  it("keeps Settings open while changing units and coordinates it with other navigation overlays", () => {
    renderShell();

    const settingsTrigger = container.querySelector<HTMLButtonElement>(".main-nav__settings-trigger");
    act(() => settingsTrigger?.click());
    expect(container.querySelector(".main-nav__settings-panel")).not.toBeNull();

    const kPaButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".main-nav__unit-option"))
      .find(button => button.textContent === "kPa");
    act(() => kPaButton?.click());

    expect(patchSessionState).toHaveBeenCalledWith({ pressureUnit: "kPa" });
    expect(savePressureUnitPreference).toHaveBeenCalledWith("kPa");
    expect(container.querySelector(".main-nav__settings-panel")).not.toBeNull();
    expect(trackEvent).not.toHaveBeenCalledWith(expect.stringContaining("unit"), expect.anything());

    act(() => container.querySelector<HTMLButtonElement>(".main-nav__toggle")?.click());

    expect(container.querySelector(".main-nav__settings-panel")).toBeNull();
    expect(document.body.querySelector(".mobile-nav-drawer")?.className).toContain("is-open");
  });

  it("closes Settings when navigation changes the location", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<Link to="/contact">Navigate</Link>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
    });

    act(() => container.querySelector<HTMLButtonElement>(".main-nav__settings-trigger")?.click());
    expect(container.querySelector(".main-nav__settings-panel")).not.toBeNull();

    act(() => container.querySelector<HTMLAnchorElement>('a[href="/contact"]')?.click());
    expect(container.querySelector(".main-nav__settings-panel")).toBeNull();
  });

});
