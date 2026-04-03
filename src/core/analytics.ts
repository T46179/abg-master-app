const GA_SCRIPT_ID = "ga4-script";

function getMeasurementId() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  return measurementId || null;
}

function ensureDataLayer() {
  const analyticsWindow = window as Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __abgAnalyticsInitialized?: boolean;
  };

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.gtag = analyticsWindow.gtag ?? function gtag(...args: unknown[]) {
    analyticsWindow.dataLayer?.push(args);
  };

  return analyticsWindow;
}

export function initAnalytics() {
  const measurementId = getMeasurementId();
  if (!measurementId) return;

  const analyticsWindow = ensureDataLayer();
  if (analyticsWindow.__abgAnalyticsInitialized) return;

  analyticsWindow.__abgAnalyticsInitialized = true;
  analyticsWindow.gtag?.("js", new Date());
  analyticsWindow.gtag?.("config", measurementId, {
    send_page_view: false
  });

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  const maybeGtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof maybeGtag === "function") {
    maybeGtag("event", name, params);
  }
}

export function trackPageView(viewName: string) {
  const maybeGtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof maybeGtag === "function") {
    maybeGtag("event", "page_view", {
      page_title: viewName,
      page_path: `/${viewName}`
    });
  }
}
