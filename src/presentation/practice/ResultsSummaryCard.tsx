import { Trophy } from "lucide-react";
import { Surface } from "../primitives/Surface";
import type { CaseData, CaseSummary } from "../../core/types";
import { formatElapsed, splitMetrics } from "../../app/viewHelpers";
import { MetricLabel, MetricReference, MetricValue } from "./MetricText";

interface ResultsSummaryCardProps {
  summary: CaseSummary;
  caseItem: CaseData;
  showSummaryReferences: boolean;
  showAbnormalHighlighting: boolean;
  onNextCase: () => void;
  onOpenFeedback: () => void;
}

export function ResultsSummaryCard(props: ResultsSummaryCardProps) {
  const metrics = splitMetrics(props.caseItem);

  return (
    <div className="results-flow">
      <Surface className="results-card">
        <div className="results-card__hero">
          <div className="results-card__hero-copy">
            <span className="results-card__icon" aria-hidden="true">
              <Trophy />
            </span>
            <div>
              <h1>Case complete</h1>
              <p>You scored {props.summary.accuracy}% and earned {props.summary.totalXpAward} XP.</p>
            </div>
          </div>
          <span className="results-card__time">{formatElapsed(props.summary.elapsedSeconds)}</span>
        </div>

        {props.summary.explanation.overview ? (
          <div className="results-review-card__section results-card__summary-section">
            <span className="section-header__eyebrow">Case review</span>
            <p>{props.summary.explanation.overview}</p>
            {props.summary.explanation.sections.map(section => (
              <div key={`${section.key}-${section.order}`} className="results-review-card__section">
                <strong>{section.title}</strong>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="results-card__actions">
          <button className="figma-button results-card__button" type="button" onClick={props.onNextCase}>
            Next case
          </button>
          <button className="figma-button figma-button--secondary results-card__button results-card__button--secondary" type="button" onClick={props.onOpenFeedback}>
            Feedback
          </button>
        </div>
      </Surface>

      <Surface className="results-review-card">
        <div className="results-card__metric-section">
          <span className="section-header__eyebrow">ABG values</span>
          <div className="metric-grid metric-grid--primary">
            {metrics.primary.map(metric => (
              <article
                key={metric.label}
                className="metric-card"
              >
                <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
                <MetricValue
                  renderedValue={metric.renderedValue}
                  unit={metric.unit}
                  abnormal={props.showAbnormalHighlighting && metric.abnormal}
                />
                {props.showSummaryReferences ? <MetricReference reference={metric.reference} /> : null}
              </article>
            ))}
          </div>
        </div>

        {metrics.secondary.length ? (
          <div className="results-card__metric-section">
            <span className="section-header__eyebrow">Electrolytes &amp; other values</span>
            <div className="metric-grid metric-grid--secondary">
              {metrics.secondary.map(metric => (
                <article
                  key={metric.label}
                  className={[
                    "metric-card",
                    "metric-card--secondary"
                  ].join(" ")}
                >
                  <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
                  <MetricValue
                    renderedValue={metric.renderedValue}
                    unit={metric.unit}
                    abnormal={props.showAbnormalHighlighting && metric.abnormal}
                  />
                  {props.showSummaryReferences ? <MetricReference reference={metric.reference} /> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="results-review-card__section">
          <span className="section-header__eyebrow">Answer review</span>
          <div className="results-review-card__list">
            {props.summary.stepResults.map(stepResult => (
              <article
                key={`${stepResult.key}-${stepResult.label}`}
                className={`review-item${stepResult.correct ? " is-correct" : " is-incorrect"}`}
              >
                <strong>{stepResult.label}</strong>
                <p>You chose {stepResult.chosen}. Correct answer: {stepResult.correctAnswer}.</p>
              </article>
            ))}
          </div>
        </div>
      </Surface>
    </div>
  );
}
