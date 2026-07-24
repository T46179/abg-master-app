import { useEffect, useId, useRef, type WheelEvent } from "react";
import type { CaseMetricDefinition } from "../../core/types";
import { HorizontalScrollIndicator } from "../primitives/HorizontalScrollIndicator";
import { useHorizontalOverflowState } from "../useHorizontalOverflowState";
import { cn } from "../utils";
import { MetricLabel, MetricReference, MetricValue } from "./MetricText";

type RenderableMetric = CaseMetricDefinition & {
  renderedValue: string;
};

interface SecondaryMetricRailProps {
  metrics: RenderableMetric[];
  contentKey: string;
  showReferences: boolean;
  showAbnormalHighlighting: boolean;
}

export function SecondaryMetricRail(props: SecondaryMetricRailProps) {
  const scrollContainerId = useId();
  const scrollState = useHorizontalOverflowState<HTMLDivElement>(props.contentKey);
  const wheelAnimationFrame = useRef<number | null>(null);
  const wheelTargetLeft = useRef<number | null>(null);

  useEffect(() => (
    () => {
      if (wheelAnimationFrame.current !== null) {
        cancelAnimationFrame(wheelAnimationFrame.current);
      }
    }
  ), []);

  function animateWheelScroll() {
    const node = scrollState.ref.current;
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
    wheelAnimationFrame.current = requestAnimationFrame(animateWheelScroll);
  }

  function normalizeWheelDelta(event: WheelEvent<HTMLDivElement>) {
    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

    if (event.deltaMode === 1) return rawDelta * 24;
    if (event.deltaMode === 2) return rawDelta * Math.max(scrollState.clientWidth, 1);
    return rawDelta;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const node = scrollState.ref.current;
    if (!scrollState.overflowing || !node) return;

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
      wheelAnimationFrame.current = requestAnimationFrame(animateWheelScroll);
    }
  }

  return (
    <div
      className={cn(
        "secondary-metric-rail",
        props.showReferences
          ? "secondary-metric-rail--references-visible"
          : "secondary-metric-rail--references-hidden"
      )}
      data-show-scroll-hint={scrollState.overflowing && !scrollState.movedFromStart}
    >
      <div
        id={scrollContainerId}
        ref={scrollState.ref}
        className="secondary-metric-rail__scroll metric-scroll metric-scroll--secondary scroll-fade"
        data-overflowing={scrollState.overflowing}
        data-at-start={scrollState.atStart}
        data-at-end={scrollState.atEnd}
        onWheel={handleWheel}
      >
        <div className="secondary-metric-rail__grid metric-grid metric-grid--secondary metric-grid--scrolling">
          {props.metrics.map(metric => (
            <article
              key={metric.label}
              className={cn(
                "metric-card",
                "metric-card--secondary",
                "metric-card--scroll-item",
                metric.group === "oxygenation" ? "metric-card--oxygenation" : null
              )}
            >
              <span className="metric-card__label"><MetricLabel label={metric.label} /></span>
              <MetricValue
                renderedValue={metric.renderedValue}
                unit={metric.unit}
                abnormal={props.showAbnormalHighlighting && metric.abnormal}
              />
              {props.showReferences ? <MetricReference reference={metric.reference} /> : null}
            </article>
          ))}
        </div>
      </div>
      {scrollState.overflowing ? (
        <HorizontalScrollIndicator
          className="secondary-metric-rail__indicator"
          scrollState={scrollState}
          scrollContainerId={scrollContainerId}
        />
      ) : null}
    </div>
  );
}
