// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockState = vi.hoisted(() => ({
  payload: { progressionConfig: null },
  userState: {
    xp: 0,
    level: 1,
    casesCompleted: 0,
    abandonedCases: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    recentResults: [],
    recentPracticeAttempts: [],
    appliedProtectedCaseTokens: []
  },
  practiceState: {
    currentCase: null,
    lastCaseSummary: null,
    pendingSubmission: null,
    syncState: "idle",
    syncMessage: null
  },
  appStatus: { blocking: null, warnings: {} },
  storage: {
    loadSeenCaseState: () => ({}),
    saveAppAreaVisited: vi.fn()
  },
  calibrationState: {
    localCompletion: null as null | { completed: true; placement: "beginner"; version: number },
    remoteCompletion: null,
    remoteStatus: "absent" as "loading" | "loaded" | "absent" | "unavailable",
    effectiveCompletion: null as null | { completed: true; placement: "beginner"; version: number },
    completionSource: "none" as "none" | "local" | "remote"
  }
}));

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: mockState,
    patchSessionState: vi.fn(),
    retryPendingSubmissionNow: vi.fn(),
    discardPendingSubmission: vi.fn()
  })
}));

vi.mock("./MainNav", () => ({ MainNav: () => null }));
vi.mock("./LaunchNotifyModal", () => ({ LaunchNotifyModal: () => null }));
vi.mock("../../core/analytics", () => ({ trackEvent: vi.fn(), trackPageView: vi.fn() }));

import { AppShell } from "./AppShell";

describe("AppShell calibration guard", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockState.calibrationState.localCompletion = null;
    mockState.calibrationState.remoteCompletion = null;
    mockState.calibrationState.remoteStatus = "absent";
    mockState.calibrationState.effectiveCompletion = null;
    mockState.calibrationState.completionSource = "none";
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderPath(pathname: string) {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[pathname]}>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route path="*" element={<main>Learner content mounted</main>} />
            </Route>
            <Route path="/calibration" element={<main>Calibration destination</main>} />
          </Routes>
        </MemoryRouter>
      );
    });
  }

  it.each([
    "/dashboard",
    "/practice",
    "/learn",
    "/learn/intermediate",
    "/insights",
    "/exam",
    "/leaderboard"
  ])("redirects %s without mounting learner content", pathname => {
    renderPath(pathname);

    expect(container.textContent).toContain("Calibration destination");
    expect(container.textContent).not.toContain("Learner content mounted");
  });

  it("leaves newly introduced routes unguarded by default", () => {
    renderPath("/new-route");
    expect(container.textContent).toContain("Learner content mounted");
  });

  it("permits local completion while remote state is still loading", () => {
    const completion = { completed: true as const, placement: "beginner" as const, version: 1 };
    mockState.calibrationState.localCompletion = completion;
    mockState.calibrationState.effectiveCompletion = completion;
    mockState.calibrationState.completionSource = "local";
    mockState.calibrationState.remoteStatus = "loading";

    renderPath("/practice");
    expect(container.textContent).toContain("Learner content mounted");
  });
});
