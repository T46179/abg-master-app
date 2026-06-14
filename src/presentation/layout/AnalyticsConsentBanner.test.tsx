// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const clarity = vi.hoisted(() => ({
  denyClarityConsent: vi.fn(),
  initClarity: vi.fn(),
  loadAnalyticsConsent: vi.fn<() => "granted" | "denied" | null>(),
  saveAnalyticsConsent: vi.fn()
}));

vi.mock("../../core/clarity", () => clarity);

import { AnalyticsConsentBanner, OPEN_ANALYTICS_CHOICES_EVENT } from "./AnalyticsConsentBanner";

describe("AnalyticsConsentBanner", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    clarity.denyClarityConsent.mockReset();
    clarity.initClarity.mockReset();
    clarity.loadAnalyticsConsent.mockReset();
    clarity.saveAnalyticsConsent.mockReset();
    clarity.loadAnalyticsConsent.mockReturnValue(null);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("asks first-time visitors for analytics consent", () => {
    act(() => root.render(<AnalyticsConsentBanner />));

    expect(container.textContent).toContain("Help improve ABG Master");
    expect(container.textContent).toContain("This helps identify confusing screens, bugs, and areas for improvement.");
    expect(container.textContent).toContain("You can change this choice later.");
    expect(container.textContent).toContain("Allow analytics");
  });

  it("initializes Clarity after analytics are allowed", () => {
    act(() => root.render(<AnalyticsConsentBanner />));

    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find(button => button.textContent === "Allow analytics")
        ?.click();
    });

    expect(clarity.saveAnalyticsConsent).toHaveBeenCalledWith("granted");
    expect(clarity.initClarity).toHaveBeenCalledOnce();
    expect(container.textContent).toBe("");
  });

  it("allows an existing choice to be revisited and declined", () => {
    clarity.loadAnalyticsConsent.mockReturnValue("granted");
    act(() => root.render(<AnalyticsConsentBanner />));

    act(() => window.dispatchEvent(new Event(OPEN_ANALYTICS_CHOICES_EVENT)));
    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find(button => button.textContent === "Decline")
        ?.click();
    });

    expect(clarity.saveAnalyticsConsent).toHaveBeenCalledWith("denied");
    expect(clarity.denyClarityConsent).toHaveBeenCalledOnce();
  });
});
