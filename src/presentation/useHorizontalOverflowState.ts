import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface HorizontalOverflowState {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
  movedFromStart: boolean;
  scrollLeft: number;
  maxScrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export interface HorizontalOverflowController<T extends HTMLElement> extends HorizontalOverflowState {
  ref: RefObject<T | null>;
  scrollToLeft: (value: number, behavior?: ScrollBehavior) => void;
  scrollBy: (delta: number, behavior?: ScrollBehavior) => void;
  scrollToStart: (behavior?: ScrollBehavior) => void;
  scrollToEnd: (behavior?: ScrollBehavior) => void;
}

function clampScrollLeft(value: number, maxScrollLeft: number) {
  return Math.min(Math.max(value, 0), maxScrollLeft);
}

function getOverflowState(node: HTMLElement): Omit<HorizontalOverflowState, "movedFromStart"> {
  const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
  const overflowing = maxScrollLeft > 1;
  const scrollLeft = node.scrollLeft;

  return {
    overflowing,
    atStart: !overflowing || scrollLeft <= 1,
    atEnd: !overflowing || scrollLeft >= maxScrollLeft - 1,
    scrollLeft,
    maxScrollLeft,
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth
  };
}

export function useHorizontalOverflowState<T extends HTMLElement>(contentKey: string): HorizontalOverflowController<T> {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState<HorizontalOverflowState>({
    overflowing: false,
    atStart: true,
    atEnd: true,
    movedFromStart: false,
    scrollLeft: 0,
    maxScrollLeft: 0,
    clientWidth: 0,
    scrollWidth: 0
  });

  const scrollToLeft = useCallback((value: number, behavior: ScrollBehavior = "auto") => {
    const node = ref.current;
    if (!node) return;
    const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
    node.scrollTo({ left: clampScrollLeft(value, maxScrollLeft), behavior });
  }, []);

  const scrollBy = useCallback((delta: number, behavior: ScrollBehavior = "auto") => {
    const node = ref.current;
    if (!node) return;
    scrollToLeft(node.scrollLeft + delta, behavior);
  }, [scrollToLeft]);

  const scrollToStart = useCallback((behavior: ScrollBehavior = "auto") => {
    scrollToLeft(0, behavior);
  }, [scrollToLeft]);

  const scrollToEnd = useCallback((behavior: ScrollBehavior = "auto") => {
    const node = ref.current;
    if (!node) return;
    scrollToLeft(Math.max(node.scrollWidth - node.clientWidth, 0), behavior);
  }, [scrollToLeft]);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    let frameId = 0;

    node.scrollLeft = 0;
    setState({
      overflowing: false,
      atStart: true,
      atEnd: true,
      movedFromStart: false,
      scrollLeft: 0,
      maxScrollLeft: 0,
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth
    });

    const update = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const nextState = getOverflowState(node);
        setState(previous =>
          previous.overflowing === nextState.overflowing &&
          previous.atStart === nextState.atStart &&
          previous.atEnd === nextState.atEnd &&
          previous.scrollLeft === nextState.scrollLeft &&
          previous.maxScrollLeft === nextState.maxScrollLeft &&
          previous.clientWidth === nextState.clientWidth &&
          previous.scrollWidth === nextState.scrollWidth &&
          previous.movedFromStart === (previous.movedFromStart || !nextState.atStart)
            ? previous
            : {
              ...nextState,
              movedFromStart: previous.movedFromStart || !nextState.atStart
            }
        );
      });
    };

    update();

    const handleScroll = () => {
      update();
    };

    node.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", update);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => update());

    resizeObserver?.observe(node);
    if (node.firstElementChild) {
      resizeObserver?.observe(node.firstElementChild);
    }

    return () => {
      cancelAnimationFrame(frameId);
      node.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
    };
  }, [contentKey]);

  return { ref, ...state, scrollToLeft, scrollBy, scrollToStart, scrollToEnd };
}
