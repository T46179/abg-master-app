import { useEffect, useId, useRef, type RefObject } from "react";
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
  indicator?: "scrollbar" | "hint";
  interactionRef?: RefObject<HTMLElement | null>;
  interactionEnabled?: boolean;
}

export function SecondaryMetricRail(props: SecondaryMetricRailProps) {
  const scrollContainerId = useId();
  const scrollState = useHorizontalOverflowState<HTMLDivElement>(props.contentKey);
  const wheelAnimationFrame = useRef<number | null>(null);
  const wheelTargetLeft = useRef<number | null>(null);

  useEffect(() => {
    const node = scrollState.ref.current;
    if (!node || props.interactionEnabled === false) return;
    const interactionNode = props.interactionRef?.current ?? node;
    let touch: { x: number; y: number; left: number; horizontal?: boolean } | null = null;
    function handleTouchStart(event: TouchEvent) {
      touch = null;
      // Preserve native swiping when the gesture starts on the rail itself.
      if (node!.contains(event.target as Node) || event.touches.length !== 1) return;
      touch = { x: event.touches[0].clientX, y: event.touches[0].clientY, left: node!.scrollLeft };
    }
    function handleTouchMove(event: TouchEvent) {
      if (!touch || event.touches.length !== 1 || node!.scrollWidth <= node!.clientWidth) return;
      const dx = touch.x - event.touches[0].clientX;
      const dy = touch.y - event.touches[0].clientY;
      if (touch.horizontal === undefined) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        touch.horizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!touch.horizontal) return;
      event.preventDefault();
      node!.scrollLeft = Math.max(0, Math.min(touch.left + dx, node!.scrollWidth - node!.clientWidth));
    }
    function handleTouchEnd() { touch = null; }

    function animateWheelScroll() {
      const targetLeft = wheelTargetLeft.current;

      if (!node || targetLeft === null) {
        wheelAnimationFrame.current = null;
        return;
      }

      const distance = targetLeft - node.scrollLeft;

      if (Math.abs(distance) < 0.8) {
        node.scrollLeft = targetLeft;
        wheelAnimationFrame.current = null;
        wheelTargetLeft.current = null;
        return;
      }

      node.scrollLeft += distance * 0.32;
      wheelAnimationFrame.current = requestAnimationFrame(animateWheelScroll);
    }

    function normalizeWheelDelta(event: WheelEvent) {
      const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

      if (event.deltaMode === 1) return rawDelta * 24;
      if (event.deltaMode === 2) return rawDelta * Math.max(node!.clientWidth, 1);
      return rawDelta;
    }

    function handleWheel(event: WheelEvent) {
      if (!node || node.scrollWidth - node.clientWidth <= 1) return;

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

    // React's delegated wheel listener is passive and cannot cancel page scrolling.
    interactionNode.addEventListener("wheel", handleWheel, { passive: false });
    interactionNode.addEventListener("touchstart", handleTouchStart, { passive: true });
    interactionNode.addEventListener("touchmove", handleTouchMove, { passive: false });
    interactionNode.addEventListener("touchend", handleTouchEnd);
    interactionNode.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      interactionNode.removeEventListener("wheel", handleWheel);
      interactionNode.removeEventListener("touchstart", handleTouchStart);
      interactionNode.removeEventListener("touchmove", handleTouchMove);
      interactionNode.removeEventListener("touchend", handleTouchEnd);
      interactionNode.removeEventListener("touchcancel", handleTouchEnd);
      if (wheelAnimationFrame.current !== null) {
        cancelAnimationFrame(wheelAnimationFrame.current);
      }
      wheelAnimationFrame.current = null;
      wheelTargetLeft.current = null;
    };
  }, [scrollState.ref, props.contentKey, props.interactionRef, props.interactionEnabled]);

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
      {scrollState.overflowing && props.indicator !== "hint" ? (
        <HorizontalScrollIndicator
          className="secondary-metric-rail__indicator"
          scrollState={scrollState}
          scrollContainerId={scrollContainerId}
        />
      ) : null}
    </div>
  );
}
