// @vitest-environment jsdom

import { Navigate } from "react-router-dom";
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

  it("redirects /learn to /practice", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnIndexRoute = learnRoute?.children?.find((route) => route.index);

    expect(learnIndexRoute?.element?.type).toBe(Navigate);
    expect(learnIndexRoute?.element?.props.to).toBe("/practice");
    expect(learnIndexRoute?.element?.props.replace).toBe(true);
  });

  it("redirects nested learn lesson routes to /practice", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnWildcardRoute = learnRoute?.children?.find((route) => route.path === "*");

    expect(learnWildcardRoute?.element?.type).toBe(Navigate);
    expect(learnWildcardRoute?.element?.props.to).toBe("/practice");
    expect(learnWildcardRoute?.element?.props.replace).toBe(true);
  });
});
