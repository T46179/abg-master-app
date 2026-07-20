import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useFeaturedCaseStatus } from "../../app/useFeaturedCaseStatus";
import { Surface } from "../primitives/Surface";

export function ResultsFeaturedCaseCta() {
  const featured = useFeaturedCaseStatus();
  const [dismissedReleaseId, setDismissedReleaseId] = useState<string | null>(null);
  const releaseId = featured.status.releaseId;

  if (
    featured.loading ||
    !releaseId ||
    !featured.status.ctaEligible ||
    featured.status.opened ||
    dismissedReleaseId === releaseId
  ) {
    return null;
  }

  return (
    <Surface className="results-pattern-tip" aria-label="Featured Case invitation">
      <Sparkles className="results-pattern-tip__icon" aria-hidden="true" />
      <div className="results-pattern-tip__copy">
        <strong className="results-pattern-tip__label">Featured Case Available!</strong>
        <span>Up for a challenge? Try a Master-level case and see what ABG Master can do</span>
        <p>
          <Link className="figma-link" to="/featured-case">Try Featured Case</Link>
        </p>
      </div>
      <button
        className="results-pattern-tip__dismiss"
        type="button"
        aria-label="Dismiss Featured Case invitation"
        onClick={() => setDismissedReleaseId(releaseId)}
      >
        <X aria-hidden="true" />
      </button>
    </Surface>
  );
}
