// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { appRoutes } from "./routes";

describe("app routes", () => {
  it("renders the landing screen at /", () => {
    const landingRoute = appRoutes.find((route) => route.path === "/" && route.children == null);

    expect(landingRoute).toBeTruthy();
  });

  it("keeps dashboard and practice available inside the app shell", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const childPaths = shellRoute?.children?.map((route) => route.path);

    expect(childPaths).toContain("dashboard");
    expect(childPaths).toContain("practice");
  });

  it("renders the learn overview at /learn", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnIndexRoute = learnRoute?.children?.find((route) => route.index);

    expect(learnIndexRoute?.element).toBeTruthy();
    expect(learnIndexRoute?.element?.type?.name).toBe("LearnScreen");
  });

  it("renders nested learn lesson routes", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnLessonRoute = learnRoute?.children?.find((route) => route.path === ":difficulty");

    expect(learnLessonRoute?.element).toBeTruthy();
    expect(learnLessonRoute?.element?.type?.name).toBe("LearnLessonScreen");
  });

  it("redirects unknown nested learn lesson routes back to /learn", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnWildcardRoute = learnRoute?.children?.find((route) => route.path === "*");

    expect(learnWildcardRoute?.element?.props.to).toBe("/learn");
    expect(learnWildcardRoute?.element?.props.replace).toBe(true);
  });
});
