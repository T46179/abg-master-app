import { useEffect, useId, useRef } from "react";
import type { WheelEvent } from "react";
import { shouldShowMetricReferences } from "../../core/metrics";
import type { PressureUnit } from "../../core/metrics";
import type { CaseData } from "../../core/types";
import { splitMetrics } from "../../app/viewHelpers";
import { HorizontalScrollIndicator } from "../primitives/HorizontalScrollIndicator";
import { Surface } from "../primitives/Surface";
import { MetricLabel, MetricReference, MetricValue } from "./MetricText";
import { cn } from "../utils";
import { useHorizontalOverflowState } from "../useHorizontalOverflowState";

interface ValuePanelsProps {
  caseItem: CaseData;
  showAdvancedRanges: boolean;
  showAbnormalHighlighting: boolean;
  pressureUnit?: PressureUnit;
  onToggleAdvancedRanges?: () => void;
}

function getMetricCardClass(metric: { group?: string }, ...classes: string[]): string {
  return cn(
    ...classes,
    metric.group === "oxygenation" ? "metric-card--oxygenation" : null
  );
}

export function ValuePanels(props: ValuePanelsProps) {
  const { primary, secondary } = splitMetrics(props.caseItem, { pressureUnit: props.pressureUnit });
  const showReferences = shouldShowMetricReferences(props.caseItem, props.showAdvancedRanges);
  const difficultyLevel = Number(props.caseItem.difficulty_level ?? 1);
  const shouldUseSecondaryRail = secondary.length > 2;
  const secondaryLayoutClass = shouldUseSecondaryRail
    ? "value-panels__secondary--rail"
    : "value-panels__secondary--fill";
  const secondaryCountClass = `value-panels__secondary--count-${Math.min(secondary.length, 4)}`;
  const secondaryScrollId = useId();
  const secondaryScroll = useHorizontalOverflowState<HTMLDivElement>(
    `${props.caseItem.case_id ?? "unknown-case"}-${difficultyLevel}-${secondary.map(metric => metric.label).join("|")}-${showReferences ? "refs" : "no-refs"}`
  );
  const wheelAnimationFrame = useRef<number | null>(null);
  const wheelTargetLeft = useRef<number | null>(null);

  useEffect(() => (
    () => {
      if (wheelAnimationFrame.current !== null) {
        cancelAnimationFrame(wheelAnimationFrame.current);
      }
    }
  ), []);

  function animateSecondaryWheelScroll() {
    const node = secondaryScroll.ref.current;
    const targetLeft = wheelTargetLeft.current;

    if (!node || targetLeft === null) {
      wheelAnimationFrame.current = null;
      return;
    }

    const distance = targetLeft - node.scrollLeft;

    if (Math.abs(distance) < 0.8) {
      node.scrollLeft = targetLeft;
      wheelAnimationFrame.current = null;
      return;
    }

    node.scrollLeft += distance * 0.32;
    wheelAnimationFrame.current = requestAnimationFrame(animateSecondaryWheelScroll);
  }

  function normalizeWheelDelta(event: WheelEvent<HTMLDivElement>) {
    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

    if (event.deltaMode === 1) return rawDelta * 24;
    if (event.deltaMode === 2) return rawDelta * Math.max(secondaryScroll.clientWidth, 1);
    return rawDelta;
  }

  function handleSecondaryWheel(event: WheelEvent<HTMLDivElement>) {
    const node = secondaryScroll.ref.current;
    if (!secondaryScroll.overflowing || !node) return;

    const dominantDelta = normalizeWheelDelta(event);

    if (dominantDelta === 0) return;

    const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
    const scrollingBackPastStart = dominantDelta < 0 && node.scrollLeft <= 1;
    const scrollingForwardPastEnd = dominantDelta > 0 && node.scrollLeft >= maxScrollLeft - 1;

    if (scrollingBackPastStart || scrollingForwardPastEnd) return;

    event.preventDefault();

    const currentTarget = wheelTargetLeft.current ?? node.scrollLeft;
    wheelTargetLeft.current = Math.min(Math.max(currentTarget + dominantDelta, 0), maxScrollLeft);

    if (wheelAnimationFrame.current === null) {
      wheelAnimationFrame.current = requestAnimationFrame(animateSecondaryWheelScroll);
    }
  }

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
            <article
              key={metric.label}
              className={getMetricCardClass(metric, "metric-card")}
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
        <Surface
          className={cn(
            "value-panels__card",
            "value-panels__card--secondary",
            secondaryLayoutClass,
            secondaryCountClass,
            showReferences ? "value-panels__card--references-visible" : "value-panels__card--references-hidden"
          )}
        >
          <div className="value-panels__header">
            <div>
              <span className="section-header__eyebrow">Electrolytes &amp; other values</span>
            </div>
          </div>
          <div
            className={cn("value-panels__secondary-scroll", secondaryLayoutClass, secondaryCountClass)}
            data-show-scroll-hint={shouldUseSecondaryRail && secondaryScroll.overflowing && !secondaryScroll.movedFromStart}
          >
            <div
              id={secondaryScrollId}
              ref={secondaryScroll.ref}
              className={cn("metric-scroll", "metric-scroll--secondary", "scroll-fade")}
              data-overflowing={secondaryScroll.overflowing}
              data-at-start={secondaryScroll.atStart}
              data-at-end={secondaryScroll.atEnd}
              onWheel={shouldUseSecondaryRail ? handleSecondaryWheel : undefined}
            >
              <div className="metric-grid metric-grid--secondary metric-grid--scrolling">
                {secondary.map(metric => (
                  <article
                    key={metric.label}
                    className={getMetricCardClass(
                      metric,
                      "metric-card",
                      "metric-card--secondary",
                      "metric-card--scroll-item"
                    )}
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
            {shouldUseSecondaryRail && secondaryScroll.overflowing ? (
              <HorizontalScrollIndicator
                className="value-panels__secondary-indicator"
                scrollState={secondaryScroll}
                scrollContainerId={secondaryScrollId}
              />
            ) : null}
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
