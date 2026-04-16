// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { Outlet, createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../presentation/layout/AppShell", () => ({
  AppShell: () => <div>APP SHELL<Outlet /></div>
}));

vi.mock("../presentation/screens/LandingScreen", () => ({
  LandingScreen: () => <div>LANDING SCREEN</div>
}));

vi.mock("../presentation/screens/DashboardScreen", () => ({
  DashboardScreen: () => <div>DASHBOARD SCREEN</div>
}));

vi.mock("../presentation/screens/PracticeScreen", () => ({
  PracticeScreen: () => <div>PRACTICE SCREEN</div>
}));

vi.mock("../presentation/screens/LearnScreen", () => ({
  LearnScreen: () => <div>LEARN OVERVIEW SCREEN</div>
}));

vi.mock("../presentation/screens/LearnLessonScreen", () => ({
  LearnLessonScreen: () => <div>LEARN LESSON SCREEN</div>
}));

vi.mock("../presentation/screens/ExamScreen", () => ({
  ExamScreen: () => <div>EXAM SCREEN</div>
}));

vi.mock("../presentation/screens/LeaderboardScreen", () => ({
  LeaderboardScreen: () => <div>LEADERBOARD SCREEN</div>
}));

import { appRoutes } from "./routes";

describe("app routes", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderPath(path: string) {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: [path]
    });

    act(() => {
      root.render(<RouterProvider router={router} />);
    });
  }

  it("renders the landing screen at /", () => {
    renderPath("/");

    expect(container.textContent).toContain("LANDING SCREEN");
  });

  it("renders the dashboard screen at /dashboard", () => {
    renderPath("/dashboard");

    expect(container.textContent).toContain("APP SHELL");
    expect(container.textContent).toContain("DASHBOARD SCREEN");
  });

  it("renders the learn overview at /learn", () => {
    renderPath("/learn");

    expect(container.textContent).toContain("APP SHELL");
    expect(container.textContent).toContain("LEARN OVERVIEW SCREEN");
  });

  it("renders a nested learn lesson route at /learn/beginner", () => {
    renderPath("/learn/beginner");

    expect(container.textContent).toContain("APP SHELL");
    expect(container.textContent).toContain("LEARN LESSON SCREEN");
  });
});
