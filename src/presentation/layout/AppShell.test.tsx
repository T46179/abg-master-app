// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retryPendingSubmissionNow = vi.fn();
const discardPendingSubmission = vi.fn();
const patchSessionState = vi.fn();

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      practiceState: {
        syncState: "pending_retry",
        syncMessage: "We're retrying your submission.",
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

    expect(container.textContent).toContain("Sorry, your case hasn't finished saving yet. Please wait.");
    expect(container.textContent).toContain("We're retrying your submission.");
    expect(container.textContent).toContain("Retry now");
    expect(container.textContent).toContain("Discard this unsaved case");
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
