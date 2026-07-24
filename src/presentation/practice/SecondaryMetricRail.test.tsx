// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseMetricDefinition } from "../../core/types";
import {
  useHorizontalOverflowState,
  type HorizontalOverflowController
} from "../useHorizontalOverflowState";
import { SecondaryMetricRail } from "./SecondaryMetricRail";

vi.mock("../useHorizontalOverflowState", () => ({
  useHorizontalOverflowState: vi.fn()
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type RenderableMetric = CaseMetricDefinition & {
  renderedValue: string;
};

function buildMetric(
  label: string,
  overrides: Partial<RenderableMetric> = {}
): RenderableMetric {
  return {
    label,
    displayLabel: label,
    reference: "Normal reference",
    value: 1,
    decimals: 1,
    unit: "mmol/L",
    abnormal: false,
    renderedValue: "1.0",
    ...overrides
  };
}

function buildScrollController(
  overrides: Partial<HorizontalOverflowController<HTMLDivElement>> = {}
): HorizontalOverflowController<HTMLDivElement> {
  return {
    ref: { current: null },
    overflowing: false,
    atStart: true,
    atEnd: true,
    movedFromStart: false,
    scrollLeft: 0,
    maxScrollLeft: 0,
    clientWidth: 0,
    scrollWidth: 0,
    scrollToLeft: vi.fn(),
    scrollBy: vi.fn(),
    scrollToStart: vi.fn(),
    scrollToEnd: vi.fn(),
    ...overrides
  };
}

describe("SecondaryMetricRail", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders every metric through the same rail-card contract", () => {
    vi.mocked(useHorizontalOverflowState).mockReturnValue(buildScrollController());

    act(() => {
      root.render(
        <SecondaryMetricRail
          metrics={[
            buildMetric("FiO2", { group: "oxygenation", unit: "", renderedValue: "1.0" }),
            buildMetric("PaO2", { group: "oxygenation", unit: "mmHg", renderedValue: "78.0" }),
            buildMetric("SpO2", { group: "oxygenation", unit: "%", renderedValue: "92" }),
            buildMetric("Na", { renderedValue: "140" })
          ]}
          contentKey="case-metrics-no-refs"
          showReferences={false}
          showAbnormalHighlighting={false}
        />
      );
    });

    expect(useHorizontalOverflowState).toHaveBeenCalledWith("case-metrics-no-refs");
    expect(container.querySelector(".secondary-metric-rail--references-hidden")).not.toBeNull();
    expect(container.querySelectorAll(".secondary-metric-rail__grid > .metric-card--scroll-item")).toHaveLength(4);
    expect(container.querySelectorAll(".metric-card--oxygenation")).toHaveLength(3);
    expect(container.querySelectorAll(".metric-card__reference")).toHaveLength(0);
  });

  it("preserves references, abnormal highlighting, and shared overflow controls", () => {
    const scrollController = buildScrollController({
      overflowing: true,
      atEnd: false,
      maxScrollLeft: 400,
      clientWidth: 200,
      scrollWidth: 600
    });
    vi.mocked(useHorizontalOverflowState).mockReturnValue(scrollController);

    const renderRail = () => (
      <SecondaryMetricRail
        metrics={[buildMetric("K", { abnormal: true, renderedValue: "6.2" })]}
        contentKey="case-metrics-refs"
        showReferences
        showAbnormalHighlighting
      />
    );

    act(() => root.render(renderRail()));

    const rail = container.querySelector(".secondary-metric-rail");
    const scrollContainer = container.querySelector<HTMLDivElement>(".secondary-metric-rail__scroll");
    const indicator = container.querySelector<HTMLElement>('[role="scrollbar"]');

    expect(rail?.getAttribute("data-show-scroll-hint")).toBe("true");
    expect(container.querySelector(".metric-card__reference")).not.toBeNull();
    expect(container.querySelector(".metric-card__value--abnormal")).not.toBeNull();
    expect(indicator?.getAttribute("aria-controls")).toBe(scrollContainer?.id);

    Object.defineProperties(scrollContainer!, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, value: 0, writable: true }
    });
    const wheelEvent = new WheelEvent("wheel", { deltaY: 60, cancelable: true, bubbles: true });
    const preventDefault = vi.spyOn(wheelEvent, "preventDefault");
    act(() => scrollContainer?.dispatchEvent(wheelEvent));
    expect(preventDefault).toHaveBeenCalled();
    expect(requestAnimationFrame).toHaveBeenCalled();

    act(() => indicator?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(scrollController.scrollBy).toHaveBeenCalledWith(80, "smooth");

    vi.mocked(useHorizontalOverflowState).mockReturnValue({
      ...scrollController,
      atStart: false,
      movedFromStart: true,
      scrollLeft: 40
    });
    act(() => root.render(renderRail()));
    expect(container.querySelector(".secondary-metric-rail")?.getAttribute("data-show-scroll-hint")).toBe("false");
  });
});
