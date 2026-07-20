// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElementViewed } from "./useElementViewed";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useElementViewed", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let observerCallback: IntersectionObserverCallback;
  const disconnect = vi.fn();

  beforeEach(() => {
    disconnect.mockReset();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect = disconnect;
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "0px";
      thresholds = [0.5];
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("fires once only after at least half of the entry is visible", () => {
    const onViewed = vi.fn();

    function TestComponent() {
      const ref = useElementViewed<HTMLDivElement>({
        enabled: true,
        trackingKey: "release-1:dashboard:start",
        onViewed
      });
      return <div ref={ref}>Featured entry</div>;
    }

    act(() => {
      root.render(<TestComponent />);
    });

    act(() => {
      observerCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.49
        } as IntersectionObserverEntry
      ], {} as IntersectionObserver);
    });
    expect(onViewed).not.toHaveBeenCalled();

    act(() => {
      observerCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.5
        } as IntersectionObserverEntry
      ], {} as IntersectionObserver);
    });
    expect(onViewed).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();

    act(() => {
      observerCallback([
        {
          isIntersecting: true,
          intersectionRatio: 1
        } as IntersectionObserverEntry
      ], {} as IntersectionObserver);
    });
    expect(onViewed).toHaveBeenCalledTimes(1);
  });
});
