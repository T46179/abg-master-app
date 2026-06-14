// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clarity = vi.hoisted(() => ({
  consent: vi.fn(),
  consentV2: vi.fn(),
  init: vi.fn()
}));

vi.mock("@microsoft/clarity", () => ({
  default: clarity
}));

describe("clarity", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    clarity.consent.mockReset();
    clarity.consentV2.mockReset();
    clarity.init.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("persists and loads the analytics consent choice", async () => {
    const { loadAnalyticsConsent, saveAnalyticsConsent } = await import("./clarity");

    expect(loadAnalyticsConsent()).toBeNull();

    saveAnalyticsConsent("granted");

    expect(loadAnalyticsConsent()).toBe("granted");
  });

  it("initializes Clarity with analytics storage only", async () => {
    const { initClarity } = await import("./clarity");

    initClarity();
    initClarity();

    expect(clarity.init).toHaveBeenCalledOnce();
    expect(clarity.init).toHaveBeenCalledWith("vx0d7elkcg");
    expect(clarity.consentV2).toHaveBeenCalledWith({
      ad_Storage: "denied",
      analytics_Storage: "granted"
    });
  });

  it("withdraws consent after Clarity has initialized", async () => {
    const { denyClarityConsent, initClarity } = await import("./clarity");

    initClarity();
    denyClarityConsent();

    expect(clarity.consentV2).toHaveBeenLastCalledWith({
      ad_Storage: "denied",
      analytics_Storage: "denied"
    });
    expect(clarity.consent).toHaveBeenCalledWith(false);
  });
});
