import { shouldShowMetricReferences } from "../../core/metrics";
import type { PressureUnit } from "../../core/metrics";
import type { CaseData } from "../../core/types";
import { splitMetrics } from "../../app/viewHelpers";
import { Surface } from "../primitives/Surface";
import { MetricCard } from "./MetricCard";
import { SecondaryMetricRail } from "./SecondaryMetricRail";
import { cn } from "../utils";

interface ValuePanelsProps {
  caseItem: CaseData;
  showAdvancedRanges: boolean;
  showAbnormalHighlighting: boolean;
  pressureUnit?: PressureUnit;
  onToggleAdvancedRanges?: () => void;
}

export function ValuePanels(props: ValuePanelsProps) {
  const { primary, secondary } = splitMetrics(props.caseItem, { pressureUnit: props.pressureUnit });
  const showReferences = shouldShowMetricReferences(props.caseItem, props.showAdvancedRanges);
  const difficultyLevel = Number(props.caseItem.difficulty_level ?? 1);
  const secondaryContentKey =
    `${props.caseItem.case_id ?? "unknown-case"}-${difficultyLevel}-${secondary.map(metric => metric.label).join("|")}-${showReferences ? "refs" : "no-refs"}`;

  return (
    <div className="value-panels">
      <Surface className="value-panels__card value-panels__card--primary">
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
            <MetricCard
              key={metric.label}
              {...metric}
              abnormal={props.showAbnormalHighlighting && metric.abnormal}
              reference={showReferences ? metric.reference : undefined}
            />
          ))}
        </div>
      </Surface>

      {secondary.length ? (
        <Surface
          className={cn(
            "value-panels__card",
            "value-panels__card--secondary",
            "value-panels__secondary--rail"
          )}
        >
          <div className="value-panels__header">
            <div>
              <span className="section-header__eyebrow">Electrolytes &amp; other values</span>
            </div>
          </div>
          <SecondaryMetricRail
            metrics={secondary}
            contentKey={secondaryContentKey}
            showReferences={showReferences}
            showAbnormalHighlighting={props.showAbnormalHighlighting}
          />
        </Surface>
      ) : null}
    </div>
  );
}
