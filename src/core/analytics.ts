import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
  const apiHost = import.meta.env.VITE_POSTHOG_HOST?.trim();

  if (!apiKey || !apiHost || initialized) return;

  posthog.init(apiKey, {
    api_host: apiHost,
    capture_pageview: false
  });

  initialized = true;
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!initialized) return;
  posthog.capture(name, params);
}

export function trackPageView(viewName: string) {
  if (!initialized) return;
  posthog.capture("$pageview", {
    page_title: viewName,
    page_path: `/${viewName}`
  });
}
