import Clarity from "@microsoft/clarity";

export type AnalyticsConsent = "granted" | "denied";

const ANALYTICS_CONSENT_KEY = "abg-master:analytics-consent";
const CLARITY_PROJECT_ID = "vx0d7elkcg";

let initialized = false;

export function loadAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;

  const consent = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return consent === "granted" || consent === "denied" ? consent : null;
}

export function saveAnalyticsConsent(consent: AnalyticsConsent) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  }
}

export function initClarity() {
  if (typeof window === "undefined") return;

  if (!initialized) {
    Clarity.init(CLARITY_PROJECT_ID);
    initialized = true;
  }
  Clarity.consentV2({
    ad_Storage: "denied",
    analytics_Storage: "granted"
  });
}

export function denyClarityConsent() {
  if (!initialized) return;

  Clarity.consentV2({
    ad_Storage: "denied",
    analytics_Storage: "denied"
  });
  Clarity.consent(false);
}
