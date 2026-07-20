import { Sparkles, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { useFeaturedCaseStatus } from "../../app/useFeaturedCaseStatus";
import {
  buildFeaturedCaseEntryUrl,
  trackFeaturedCaseEntry
} from "../../core/featuredCaseAnalytics";
import { Surface } from "../primitives/Surface";
import { useElementViewed } from "../primitives/useElementViewed";

export function ResultsFeaturedCaseCta() {
  const { state } = useAppContext();
  const featured = useFeaturedCaseStatus();
  const [dismissedReleaseId, setDismissedReleaseId] = useState<string | null>(null);
  const releaseId = featured.status.releaseId;
  const eligible = Boolean(
    !featured.loading &&
    releaseId &&
    featured.status.ctaEligible &&
    !featured.status.opened &&
    dismissedReleaseId !== releaseId
  );
  const handleEntryViewed = useCallback(() => {
    if (!releaseId) return;
    trackFeaturedCaseEntry("featured_case_entry_viewed", {
      releaseId,
      entrySource: "results_summary",
      action: "start",
      learnerLevel: state.userState.level,
      normalCasesCompleted: state.userState.casesCompleted,
      isReplay: false
    });
  }, [releaseId, state.userState.casesCompleted, state.userState.level]);
  const entryRef = useElementViewed<HTMLDivElement>({
    enabled: eligible,
    trackingKey: `${releaseId ?? "none"}:results_summary:start`,
    onViewed: handleEntryViewed
  });

  if (!eligible || !releaseId) {
    return null;
  }

  return (
    <Surface className="results-pattern-tip" aria-label="Featured Case invitation">
      <Sparkles className="results-pattern-tip__icon" aria-hidden="true" />
      <div className="results-pattern-tip__copy" ref={entryRef}>
        <strong className="results-pattern-tip__label">Featured Case Available!</strong>
        <span>Up for a challenge? Try a Master-level case and see what ABG Master can do</span>
        <p>
          <Link
            className="figma-link"
            to={buildFeaturedCaseEntryUrl("results_summary", "start")}
            onClick={() => {
              trackFeaturedCaseEntry("featured_case_entry_clicked", {
                releaseId,
                entrySource: "results_summary",
                action: "start",
                learnerLevel: state.userState.level,
                normalCasesCompleted: state.userState.casesCompleted,
                isReplay: false
              });
            }}
          >
            Try Featured Case
          </Link>
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
