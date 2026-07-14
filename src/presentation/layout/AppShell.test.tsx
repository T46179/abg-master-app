// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retryPendingSubmissionNow = vi.fn();
const discardPendingSubmission = vi.fn();
const patchSessionState = vi.fn();
const saveAppAreaVisited = vi.fn();
const trackEvent = vi.fn();
const trackPageView = vi.fn();

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      practiceState: {
        syncState: "pending_retry",
        syncMessage: "Your answers are saved. We'll finish when you're back online.",
        lastCaseSummary: null,
        pendingSubmission: {
          caseToken: "token-1"
        }
      },
      payload: {
        progressionConfig: null,
        dashboardState: null,
        defaultUserState: null,
        cases: []
      },
      userState: {},
      appStatus: {
        warnings: {}
      },
      calibrationState: {
        localCompletion: null,
        remoteCompletion: null,
        remoteStatus: "unavailable",
        effectiveCompletion: null,
        completionSource: "none"
      },
      storage: {
        saveAppAreaVisited,
        loadSeenCaseState: () => ({})
      }
    },
    patchSessionState,
    retryPendingSubmissionNow,
    discardPendingSubmission
  })
}));

vi.mock("./MainNav", () => ({
  MainNav: () => null
}));

vi.mock("../../core/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  trackPageView: (...args: unknown[]) => trackPageView(...args)
}));

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    retryPendingSubmissionNow.mockReset();
    discardPendingSubmission.mockReset();
    patchSessionState.mockReset();
    saveAppAreaVisited.mockReset();
    trackEvent.mockReset();
    trackPageView.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("shows retry and discard actions plus the sync message", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Your answers are saved. We'll finish when you're back online.");
    expect(container.textContent).toContain("Retry now");
    expect(container.textContent).toContain("Discard this unsaved case");
  });

  it("marks dashboard and learn routes as app-area visits", () => {
    act(() => {
      root.render(
        <MemoryRouter key="dashboard" initialEntries={["/dashboard"]}>
          <AppShell />
        </MemoryRouter>
      );
    });

    expect(saveAppAreaVisited).toHaveBeenCalledWith(true);

    saveAppAreaVisited.mockReset();

    act(() => {
      root.render(
        <MemoryRouter key="learn" initialEntries={["/learn"]}>
          <AppShell />
        </MemoryRouter>
      );
    });

    expect(saveAppAreaVisited).toHaveBeenCalledWith(true);
    expect(trackEvent).toHaveBeenCalledWith("learn_opened", {});
  });

  it("does not mark the landing route as an app-area visit", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <AppShell />
        </MemoryRouter>
      );
    });

    expect(saveAppAreaVisited).not.toHaveBeenCalled();
  });

  it("wires retry and discard buttons to the pending submission actions", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const retryButton = buttons.find((button) => button.textContent === "Retry now");
    const discardButton = buttons.find((button) => button.textContent === "Discard this unsaved case");

    expect(retryButton).toBeTruthy();
    expect(discardButton).toBeTruthy();

    act(() => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      discardButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(retryPendingSubmissionNow).toHaveBeenCalledTimes(1);
    expect(discardPendingSubmission).toHaveBeenCalledTimes(1);
  });
});
