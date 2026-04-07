import { useEffect, useRef, useState } from "react";

interface HorizontalOverflowState {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
  movedFromStart: boolean;
}

function getOverflowState(node: HTMLElement): Omit<HorizontalOverflowState, "movedFromStart"> {
  const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
  const overflowing = maxScrollLeft > 1;
  const scrollLeft = node.scrollLeft;

  return {
    overflowing,
    atStart: !overflowing || scrollLeft <= 1,
    atEnd: !overflowing || scrollLeft >= maxScrollLeft - 1
  };
}

export function useHorizontalOverflowState<T extends HTMLElement>(contentKey: string) {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState<HorizontalOverflowState>({
    overflowing: false,
    atStart: true,
    atEnd: true,
    movedFromStart: false
  });

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
      movedFromStart: false
    });

    const update = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const nextState = getOverflowState(node);
        setState(previous =>
          previous.overflowing === nextState.overflowing &&
          previous.atStart === nextState.atStart &&
          previous.atEnd === nextState.atEnd &&
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
    Array.from(node.children).forEach(child => resizeObserver?.observe(child));

    return () => {
      cancelAnimationFrame(frameId);
      node.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
    };
  }, [contentKey]);

  return { ref, ...state };
}
