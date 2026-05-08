import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAuthoredCasePreviewEnabled, loadAuthoredCasePreviewPayload } from "../../core/authoredCasePreview";
import type { CaseData } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function AuthoredCaseGalleryScreen() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthoredCasePreviewEnabled()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    loadAuthoredCasePreviewPayload()
      .then(payload => {
        if (cancelled) return;
        setCases(payload.cases);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Authored cases are unavailable in this environment.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAuthoredCasePreviewEnabled()) {
    return <ErrorView message="This page is only available in development or staging." />;
  }

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;

  return (
    <main className="app-shell__page practice-screen">
      <div className="practice-screen__container">
        <Surface className="dashboard-card">
          <span className="section-header__eyebrow">Development</span>
          <h1>Authored cases</h1>
          <div className="results-review-card__section">
            <div className="results-review-card__step-list">
              {cases.map(caseItem => (
                <article key={caseItem.case_id} className="results-review-card__step">
                  <div>
                    <strong>{caseItem.case_id}</strong>
                    <p>{caseItem.title ?? "Untitled authored case"}</p>
                    <p>
                      Status: approved · Difficulty: {caseItem.difficulty_label ?? caseItem.difficulty_level ?? "unknown"} · Source: {caseItem.source_type ?? "generated"} · Practice pool: {caseItem.practice_pool_eligible === true ? "yes" : "no"}
                    </p>
                  </div>
                  <Link className="figma-button figma-button--secondary results-card__button" to={`/case-preview/${caseItem.case_id}`}>
                    Preview
                  </Link>
                </article>
              ))}
              {!cases.length ? <p>No approved authored cases are available in this payload.</p> : null}
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}
