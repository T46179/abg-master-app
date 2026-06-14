import { useEffect, useState } from "react";
import {
  AnalyticsConsent,
  denyClarityConsent,
  initClarity,
  loadAnalyticsConsent,
  saveAnalyticsConsent
} from "../../core/clarity";

export const OPEN_ANALYTICS_CHOICES_EVENT = "abg-master:open-analytics-choices";

export function AnalyticsConsentBanner() {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(() => loadAnalyticsConsent());
  const [open, setOpen] = useState(() => loadAnalyticsConsent() === null);

  useEffect(() => {
    if (consent === "granted") {
      initClarity();
    }
  }, [consent]);

  useEffect(() => {
    function handleOpenChoices() {
      setOpen(true);
    }

    window.addEventListener(OPEN_ANALYTICS_CHOICES_EVENT, handleOpenChoices);
    return () => window.removeEventListener(OPEN_ANALYTICS_CHOICES_EVENT, handleOpenChoices);
  }, []);

  function chooseConsent(nextConsent: AnalyticsConsent) {
    saveAnalyticsConsent(nextConsent);
    setConsent(nextConsent);
    setOpen(false);

    if (nextConsent === "denied") {
      denyClarityConsent();
    }
  }

  if (!open) return null;

  return (
    <aside className="analytics-consent" aria-label="Analytics choices">
      <div className="analytics-consent__copy">
        <strong>Help improve ABG Master</strong>
        <p>
          With your permission, ABG Master uses Microsoft Clarity to understand app usage through session recordings
          and heatmaps. This helps identify confusing screens, bugs, and areas for improvement.
        </p>
        <p>
          You can change this choice later.
        </p>
      </div>
      <div className="analytics-consent__actions">
        <button type="button" className="analytics-consent__decline" onClick={() => chooseConsent("denied")}>
          Decline
        </button>
        <button type="button" className="analytics-consent__allow" onClick={() => chooseConsent("granted")}>
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
