// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remoteStatus: "absent" as "absent" | "loading",
  patchSessionState: vi.fn(),
}));
vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      practiceState: { syncState: "idle", currentCase: null, lastCaseSummary: null, pendingSubmission: null },
      payload: { progressionConfig: null, dashboardState: null, defaultUserState: null, cases: [] },
      userState: {},
      appStatus: { warnings: {} },
      calibrationState: {
        localCompletion: null, remoteCompletion: null, effectiveCompletion: null,
        remoteStatus: mocks.remoteStatus, completionSource: "none",
      },
      storage: { loadSeenCaseState: () => ({}), saveAppAreaVisited: vi.fn() },
    },
    patchSessionState: mocks.patchSessionState,
    retryPendingSubmissionNow: vi.fn(), discardPendingSubmission: vi.fn(),
  }),
}));
vi.mock("./MainNav", () => ({ MainNav: () => null }));
vi.mock("./LaunchNotifyModal", () => ({ LaunchNotifyModal: () => null }));
vi.mock("../../app/seo", () => ({ SeoMetadata: () => null }));
vi.mock("../../core/analytics", () => ({ trackEvent: vi.fn(), trackPageView: vi.fn() }));
import { AppShell } from "./AppShell";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mocks.remoteStatus = "absent";
  mocks.patchSessionState.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
});
function renderAt(pathname: string, mode: string) {
  vi.stubEnv("MODE", mode);
  act(() => root.render(<MemoryRouter initialEntries={[pathname]}>
    <Routes><Route element={<AppShell />}>
      <Route path="/exam" element={<p>Pilot sign-in</p>} />
      <Route path="/dev/exam-pilot" element={<Navigate to="/exam" replace />} />
      <Route path="/practice" element={<p>Practice screen</p>} />
      <Route path="/dashboard" element={<p>Dashboard screen</p>} />
      <Route path="/calibration" element={<p>Calibration screen</p>} />
    </Route></Routes>
  </MemoryRouter>));
}
it.each(["/exam", "/exam/", "/dev/exam-pilot"])("opens hosted pilot %s for a fresh browser without calibration", pathname => {
  renderAt(pathname, "exam-pilot");
  expect(container.textContent).toContain("Pilot sign-in");
  expect(container.textContent).not.toContain("Calibration screen");
});
it("opens the hosted pilot while Practice calibration status is still loading", () => {
  mocks.remoteStatus = "loading";
  renderAt("/exam", "exam-pilot");
  expect(container.textContent).toContain("Pilot sign-in");
});
it.each(["production", "development"])("keeps /exam calibration required in %s mode", mode => {
  renderAt("/exam", mode);
  expect(container.textContent).toContain("Calibration screen");
  expect(container.textContent).not.toContain("Pilot sign-in");
});
it.each(["/practice", "/dashboard"])("still requires calibration for %s in the hosted pilot build", pathname => {
  renderAt(pathname, "exam-pilot");
  expect(container.textContent).toContain("Calibration screen");
});
it("still holds normal production Exam while calibration status is loading", () => {
  mocks.remoteStatus = "loading";
  renderAt("/exam", "production");
  expect(container.textContent).not.toContain("Pilot sign-in");
  expect(container.textContent).not.toContain("Calibration screen");
});
