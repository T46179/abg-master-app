import { useEffect, useRef, type RefObject } from "react";

interface ElementViewedInput {
  enabled: boolean;
  trackingKey: string;
  onViewed: () => void;
}

export function useElementViewed<T extends HTMLElement>(
  input: ElementViewedInput
): RefObject<T | null> {
  const elementRef = useRef<T | null>(null);
  const viewedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!input.enabled || viewedKeyRef.current === input.trackingKey) return;
    const element = elementRef.current;
    if (!element) return;

    const markViewed = () => {
      if (viewedKeyRef.current === input.trackingKey) return;
      viewedKeyRef.current = input.trackingKey;
      input.onViewed();
    };

    if (typeof IntersectionObserver === "undefined") {
      markViewed();
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        markViewed();
        observer.disconnect();
      }
    }, {
      threshold: 0.5
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [input]);

  return elementRef;
}
