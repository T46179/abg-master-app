// @vitest-environment jsdom

import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { appRoutes } from "./routes";

function getElementName(element: unknown) {
  return isValidElement(element) && typeof element.type === "function"
    ? element.type.name
    : null;
}

function getElementProps(element: unknown) {
  return isValidElement(element) ? element.props as { to?: string; replace?: boolean } : {};
}

describe("app routes", () => {
  it("renders the landing screen at /", () => {
    const landingRoute = appRoutes.find((route) => route.path === "/" && route.children == null);

    expect(landingRoute).toBeTruthy();
  });

  it("renders the privacy notice at /privacy", () => {
    const privacyRoute = appRoutes.find((route) => route.path === "/privacy");

    expect(privacyRoute?.element).toBeTruthy();
    expect(getElementName(privacyRoute?.element)).toBe("PrivacyScreen");
  });

  it("renders the blood gas compensation rules page outside the app shell", () => {
    const compensationRoute = appRoutes.find((route) => route.path === "/blood-gas-compensation-rules");

    expect(compensationRoute?.element).toBeTruthy();
    expect(getElementName(compensationRoute?.element)).toBe("BloodGasCompensationRulesScreen");
  });

  it("renders the delta ratio page outside the app shell", () => {
    const deltaRatioRoute = appRoutes.find((route) => route.path === "/delta-ratio");

    expect(deltaRatioRoute?.element).toBeTruthy();
    expect(getElementName(deltaRatioRoute?.element)).toBe("DeltaRatioScreen");
  });

  it("renders the ABG interpretation page outside the app shell", () => {
    const abgInterpretationRoute = appRoutes.find((route) => route.path === "/abg-interpretation");

    expect(abgInterpretationRoute?.element).toBeTruthy();
    expect(getElementName(abgInterpretationRoute?.element)).toBe("AbgInterpretationScreen");
  });

  it("keeps dashboard, practice, and calibration available inside the app shell", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const childPaths = shellRoute?.children?.map((route) => route.path);

    expect(childPaths).toContain("dashboard");
    expect(childPaths).toContain("practice");
    expect(childPaths).toContain("calibration");
    expect(childPaths).toContain("case-preview/:caseId");
    expect(childPaths).toContain("dev/authored-cases");
  });

  it("renders the calibration scaffold at /calibration", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const calibrationRoute = shellRoute?.children?.find((route) => route.path === "calibration");

    expect(calibrationRoute?.element).toBeTruthy();
    expect(getElementName(calibrationRoute?.element)).toBe("CalibrationScreen");
  });

  it("renders the learn overview at /learn", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnIndexRoute = learnRoute?.children?.find((route) => route.index);

    expect(learnIndexRoute?.element).toBeTruthy();
    expect(getElementName(learnIndexRoute?.element)).toBe("LearnScreen");
  });

  it("renders nested learn lesson routes", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnLessonRoute = learnRoute?.children?.find((route) => route.path === ":difficulty");

    expect(learnLessonRoute?.element).toBeTruthy();
    expect(getElementName(learnLessonRoute?.element)).toBe("LearnLessonScreen");
  });

  it("redirects unknown nested learn lesson routes back to /learn", () => {
    const shellRoute = appRoutes.find((route) => route.children != null);
    const learnRoute = shellRoute?.children?.find((route) => route.path === "learn");
    const learnWildcardRoute = learnRoute?.children?.find((route) => route.path === "*");
    const wildcardProps = getElementProps(learnWildcardRoute?.element);

    expect(wildcardProps.to).toBe("/learn");
    expect(wildcardProps.replace).toBe(true);
  });
});
