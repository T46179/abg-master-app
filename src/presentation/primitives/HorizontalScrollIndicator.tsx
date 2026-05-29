import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { HorizontalOverflowController } from "../useHorizontalOverflowState";
import { cn } from "../utils";

interface HorizontalScrollIndicatorProps {
  scrollState: HorizontalOverflowController<HTMLElement>;
  ariaLabel?: string;
  className?: string;
  scrollContainerId?: string;
  keyboardStep?: number;
}

interface DragState {
  pointerId: number;
  trackWidth: number;
  thumbWidth: number;
  grabOffsetX: number;
  dragged: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function HorizontalScrollIndicator({
  scrollState,
  ariaLabel = "Scroll additional values",
  className,
  scrollContainerId,
  keyboardStep
}: HorizontalScrollIndicatorProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<DragState | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const fallbackTrackWidth = 288;

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateTrackWidth = () => {
      setTrackWidth(track.getBoundingClientRect().width);
    };

    updateTrackWidth();
    const frameId = requestAnimationFrame(updateTrackWidth);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateTrackWidth);

    resizeObserver?.observe(track);
    window.addEventListener("resize", updateTrackWidth);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateTrackWidth);
    };
  }, []);

  const metrics = useMemo(() => {
    const effectiveTrackWidth = trackWidth || fallbackTrackWidth;

    if (!scrollState.overflowing || effectiveTrackWidth <= 0 || scrollState.scrollWidth <= 0) {
      return {
        thumbWidth: 0,
        thumbLeft: 0,
        thumbTravel: 0
      };
    }

    const minimumThumbWidth = Math.min(48, effectiveTrackWidth);
    const visibleRatio = clamp(scrollState.clientWidth / scrollState.scrollWidth, 0, 1);
    const thumbWidth = clamp(effectiveTrackWidth * visibleRatio, minimumThumbWidth, effectiveTrackWidth);
    const thumbTravel = Math.max(effectiveTrackWidth - thumbWidth, 0);
    const scrollProgress = scrollState.maxScrollLeft > 0
      ? clamp(scrollState.scrollLeft / scrollState.maxScrollLeft, 0, 1)
      : 0;
    const thumbLeft = scrollState.atEnd
      ? thumbTravel
      : scrollState.atStart
        ? 0
        : clamp(scrollProgress * thumbTravel, 0, thumbTravel);

    return {
      thumbWidth,
      thumbLeft,
      thumbTravel
    };
  }, [
    scrollState.atEnd,
    scrollState.atStart,
    scrollState.clientWidth,
    scrollState.maxScrollLeft,
    scrollState.overflowing,
    scrollState.scrollLeft,
    scrollState.scrollWidth,
    trackWidth
  ]);

  if (!scrollState.overflowing) {
    return null;
  }

  const scrollByKeyboardStep = keyboardStep ?? Math.max(80, scrollState.clientWidth * 0.35);

  function getTrackThumbLeft(clientX: number, thumbOffsetX = metrics.thumbWidth / 2) {
    const track = trackRef.current;
    if (!track || metrics.thumbTravel <= 0) return null;

    const rect = track.getBoundingClientRect();
    return clamp(clientX - rect.left - thumbOffsetX, 0, metrics.thumbTravel);
  }

  function scrollToTrackPosition(clientX: number, thumbOffsetX?: number, behavior: ScrollBehavior = "smooth") {
    const thumbLeft = getTrackThumbLeft(clientX, thumbOffsetX);
    if (thumbLeft === null) return;

    const scrollProgress = metrics.thumbTravel > 0 ? thumbLeft / metrics.thumbTravel : 0;
    scrollState.scrollToLeft(scrollProgress * scrollState.maxScrollLeft, behavior);
  }

  function handleTrackClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === thumbRef.current || dragState.current?.dragged) {
      return;
    }

    scrollToTrackPosition(event.clientX);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const thumb = thumbRef.current;
    if (!thumb) return;

    const thumbRect = thumb.getBoundingClientRect();
    const trackRect = trackRef.current?.getBoundingClientRect();
    const measuredTrackWidth = trackRect?.width || trackWidth || fallbackTrackWidth;

    dragState.current = {
      pointerId: event.pointerId,
      trackWidth: measuredTrackWidth,
      thumbWidth: metrics.thumbWidth,
      grabOffsetX: clamp(event.clientX - thumbRect.left, 0, metrics.thumbWidth),
      dragged: false
    };
    thumb.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const currentDrag = dragState.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    const thumbTravel = Math.max(currentDrag.trackWidth - currentDrag.thumbWidth, 0);
    if (thumbTravel <= 0) return;

    const nextThumbLeft = getTrackThumbLeft(event.clientX, currentDrag.grabOffsetX);
    if (nextThumbLeft === null) return;

    const scrollProgress = nextThumbLeft / thumbTravel;
    const nextScrollLeft = scrollProgress * scrollState.maxScrollLeft;

    if (Math.abs(nextScrollLeft - scrollState.scrollLeft) > 2) {
      currentDrag.dragged = true;
    }

    scrollState.scrollToLeft(nextScrollLeft);
  }

  function releasePointer(event: PointerEvent<HTMLDivElement>) {
    const thumb = thumbRef.current;
    const currentDrag = dragState.current;

    if (thumb?.hasPointerCapture(event.pointerId)) {
      thumb.releasePointerCapture(event.pointerId);
    }

    if (currentDrag?.pointerId === event.pointerId) {
      window.setTimeout(() => {
        dragState.current = null;
      }, 0);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollState.scrollBy(-scrollByKeyboardStep, "smooth");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollState.scrollBy(scrollByKeyboardStep, "smooth");
    } else if (event.key === "Home") {
      event.preventDefault();
      scrollState.scrollToStart("smooth");
    } else if (event.key === "End") {
      event.preventDefault();
      scrollState.scrollToEnd("smooth");
    }
  }

  const style = {
    "--horizontal-scroll-indicator-thumb-left": `${metrics.thumbLeft}px`,
    "--horizontal-scroll-indicator-thumb-width": `${metrics.thumbWidth}px`
  } as CSSProperties;

  return (
    <div
      className={cn("horizontal-scroll-indicator", className)}
      role="scrollbar"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      aria-controls={scrollContainerId}
      aria-valuemin={0}
      aria-valuemax={Math.round(scrollState.maxScrollLeft)}
      aria-valuenow={Math.round(scrollState.scrollLeft)}
      tabIndex={scrollState.overflowing ? 0 : undefined}
      onKeyDown={handleKeyDown}
      style={style}
    >
      <div
        ref={trackRef}
        className="horizontal-scroll-indicator__track"
        onClick={handleTrackClick}
      >
        <div
          ref={thumbRef}
          className="horizontal-scroll-indicator__thumb"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
        />
      </div>
    </div>
  );
}
