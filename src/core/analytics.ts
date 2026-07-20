import posthog, { type CaptureOptions } from "posthog-js";

let initialized = false;

function getCommonEventProperties() {
  const browserProperties = typeof window === "undefined"
    ? {}
    : {
        current_path: window.location.pathname,
        current_search: window.location.search
      };

  return {
    app: "abg_master",
    environment: import.meta.env.MODE,
    ...browserProperties
  };
}

export function initAnalytics() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
  const apiHost = import.meta.env.VITE_POSTHOG_HOST?.trim();

  if (!apiKey || !apiHost || initialized) return;

  posthog.init(apiKey, {
    api_host: apiHost,
    capture_pageview: false,
    capture_pageleave: true
  });

  initialized = true;
}

export function trackEvent(
  name: string,
  params: Record<string, unknown> = {},
  options?: Pick<CaptureOptions, "uuid">
) {
  if (!initialized) return;
  posthog.capture(name, {
    ...getCommonEventProperties(),
    ...params
  }, options);
}

export function trackPageView(viewName: string) {
  if (!initialized) return;
  const commonProperties = getCommonEventProperties();

  posthog.capture("$pageview", {
    ...commonProperties,
    page_title: viewName,
    page_name: viewName,
    page_path: typeof commonProperties.current_path === "string" ? commonProperties.current_path : `/${viewName}`
  });
}
