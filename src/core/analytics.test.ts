// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn()
}));

vi.mock("posthog-js", () => ({
  default: posthog
}));

describe("analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_POSTHOG_KEY", "test-key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://posthog.example");
    posthog.capture.mockReset();
    posthog.init.mockReset();
    window.history.replaceState(null, "", "/learn?source=nav");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not capture events before analytics is initialized", async () => {
    const { trackEvent } = await import("./analytics");

    trackEvent("beta_event");

    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("adds common properties to custom events", async () => {
    const { initAnalytics, trackEvent } = await import("./analytics");

    initAnalytics();
    trackEvent("beta_event", { source: "test" });

    expect(posthog.capture).toHaveBeenCalledWith("beta_event", expect.objectContaining({
      app: "abg_master",
      environment: expect.any(String),
      current_path: "/learn",
      current_search: "?source=nav",
      source: "test"
    }));
  });

  it("enables automatic pageleave tracking without automatic pageviews", async () => {
    const { initAnalytics } = await import("./analytics");

    initAnalytics();

    expect(posthog.init).toHaveBeenCalledWith("test-key", expect.objectContaining({
      api_host: "https://posthog.example",
      capture_pageview: false,
      capture_pageleave: true
    }));
  });

  it("adds common properties to explicit pageviews", async () => {
    const { initAnalytics, trackPageView } = await import("./analytics");

    initAnalytics();
    trackPageView("learn");

    expect(posthog.capture).toHaveBeenCalledWith("$pageview", expect.objectContaining({
      app: "abg_master",
      environment: expect.any(String),
      current_path: "/learn",
      current_search: "?source=nav",
      page_name: "learn",
      page_path: "/learn",
      page_title: "learn"
    }));
  });
});
