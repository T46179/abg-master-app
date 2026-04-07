import { shouldShowMetricReferences } from "../../core/metrics";
import type { CaseData } from "../../core/types";
import { splitMetrics } from "../../app/viewHelpers";
import { Surface } from "../primitives/Surface";
import { MetricLabel, MetricReference, MetricValue } from "./MetricText";
import { cn } from "../utils";
import { useHorizontalOverflowState } from "../useHorizontalOverflowState";

interface ValuePanelsProps {
  caseItem: CaseData;
  showAdvancedRanges: boolean;
  showAbnormalHighlighting: boolean;
  onToggleAdvancedRanges?: () => void;
}

export function ValuePanels(props: ValuePanelsProps) {
  const { primary, secondary } = splitMetrics(props.caseItem);
  const showReferences = shouldShowMetricReferences(props.caseItem, props.showAdvancedRanges);
  const difficultyLevel = Number(props.caseItem.difficulty_level ?? 1);
  const secondaryScroll = useHorizontalOverflowState<HTMLDivElement>(
    `${props.caseItem.case_id ?? "unknown-case"}-${difficultyLevel}-${secondary.map(metric => metric.label).join("|")}-${showReferences ? "refs" : "no-refs"}`
  );

  return (
    <div className="value-panels">
      <Surface className="value-panels__card">
        <div className="value-panels__header">
          <div>
            <span className="section-header__eyebrow">ABG values</span>
          </div>
          {difficultyLevel === 3 && props.onToggleAdvancedRanges ? (
            <div className="value-panels__toggle">
              <span className="value-panels__toggle-label">Reference ranges</span>
              <button
                className={`value-panels__switch${props.showAdvancedRanges ? " is-on" : ""}`}
                type="button"
                role="switch"
                aria-checked={props.showAdvancedRanges}
                aria-label="Reference ranges"
                onClick={props.onToggleAdvancedRanges}
              >
                <span className="value-panels__switch-thumb" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="metric-grid metric-grid--primary">
          {primary.map(metric => (
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
              {showReferences ? <MetricReference reference={metric.reference} /> : null}
            </article>
          ))}
        </div>
      </Surface>

      {secondary.length ? (
        <Surface className="value-panels__card">
          <div className="value-panels__header">
            <div>
              <span className="section-header__eyebrow">Electrolytes &amp; other values</span>
            </div>
          </div>
          <div
            className="value-panels__secondary-scroll"
            data-show-scroll-hint={secondaryScroll.overflowing && !secondaryScroll.movedFromStart}
          >
            <div
              ref={secondaryScroll.ref}
              className={cn("metric-scroll", "scroll-fade")}
              data-overflowing={secondaryScroll.overflowing}
              data-at-start={secondaryScroll.atStart}
              data-at-end={secondaryScroll.atEnd}
            >
              <div className="metric-grid metric-grid--secondary">
                {secondary.map(metric => (
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
                    {showReferences ? <MetricReference reference={metric.reference} /> : null}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
