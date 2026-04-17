// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const initMonitoringMock = vi.fn();
const initAnalyticsMock = vi.fn();

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock
}));

vi.mock("./core/monitoring", () => ({
  initMonitoring: initMonitoringMock
}));

vi.mock("./core/analytics", () => ({
  initAnalytics: initAnalyticsMock
}));

vi.mock("./app/AppProvider", () => ({
  AppProvider: ({ children }: { children: unknown }) => children
}));

vi.mock("./app/App", () => ({
  App: () => <div>APP</div>
}));

describe("main entrypoint", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockReset();
    createRootMock.mockClear();
    initMonitoringMock.mockClear();
    initAnalyticsMock.mockClear();
    vi.resetModules();
  });

  it("initializes monitoring and analytics before rendering the app", async () => {
    await import("./main");

    expect(initMonitoringMock).toHaveBeenCalledTimes(1);
    expect(initAnalyticsMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
