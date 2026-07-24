// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CompensationResult } from "../../../core/types";
import { CompensationVisualContent } from "./CompensationVisualContent";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const result: CompensationResult = {
  targetAnalyte: "hco3",
  measuredValue: 32,
  unit: "mmol/L",
  comparisonBands: [
    { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 22, high: 26, midpoint: 24 },
    { id: "acute_expected", role: "comparator", kindKey: "acute_expected", labelKey: "acute_expected", low: 26.7, high: 29, midpoint: 27.85 },
    { id: "chronic_expected", role: "comparator", kindKey: "chronic_expected", labelKey: "chronic_expected", low: 37, high: 41 }
  ],
  comparisons: [
    { bandId: "reference", relationship: "above" },
    { bandId: "acute_expected", relationship: "above" },
    { bandId: "chronic_expected", relationship: "below" }
  ],
  interpretationKey: "between_acute_and_chronic_expectations",
  qualifierKeys: ["acute_on_chronic_without_known_baseline"],
  calculation: {
    ruleKey: "acute_on_chronic_respiratory_acidosis",
    displayLines: [
      "Acute: 24 + 1 × ((80 − 40) ÷ 10) = 28 mmol/L",
      "Chronic: 24 + 4 × ((80 − 40) ÷ 10) = 40 mmol/L",
      "Expected HCO3: Acute 26.7 – 29 · Chronic 37 – 41 mmol/L",
      "Measured HCO3: 32 mmol/L"
    ]
  }
};

const standardResult: CompensationResult = {
  targetAnalyte: "paco2",
  measuredValue: 22,
  unit: "mmHg",
  comparisonBands: [
    { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low: 24, high: 28, midpoint: 26 },
    { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 35, high: 45 }
  ],
  primaryExpectedBandId: "expected",
  comparisons: [
    { bandId: "expected", relationship: "below" },
    { bandId: "reference", relationship: "below" }
  ],
  interpretationKey: "below_expected_range",
  calculation: {
    ruleKey: "winter",
    displayLines: [
      "Winter's Formula: (1.5 × 12) + 8 = 26 mmHg",
      "Expected PaCO2: 24 – 28 mmHg",
      "Measured PaCO2: 22 mmHg"
    ]
  }
};

interface BandMeasurementDimensions {
  bandWidth: number;
  lowWidth: number;
  highWidth: number;
  compactWidth: number;
}

function measuredRect(width: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height: 16,
    top: 0,
    right: width,
    bottom: 16,
    left: 0,
    toJSON: () => ({})
  } as DOMRect;
}

function mockBandMeasurements(initial: BandMeasurementDimensions) {
  const dimensions = { ...initial };
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList.contains("cmp-band")) {
      return measuredRect(dimensions.bandWidth);
    }
    if (this.classList.contains("cmp-band__bounds--compact")) {
      return measuredRect(dimensions.compactWidth);
    }
    if (this.classList.contains("cmp-band__bounds--low")) {
      return measuredRect(dimensions.lowWidth);
    }
    if (this.classList.contains("cmp-band__bounds--high")) {
      return measuredRect(dimensions.highWidth);
    }
    return originalGetBoundingClientRect.call(this);
  };

  return {
    dimensions,
    restore() {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  };
}

describe("CompensationVisualContent", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let restoreBandMeasurements: (() => void) | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    restoreBandMeasurements?.();
    restoreBandMeasurements = undefined;
    container.remove();
  });

  it("renders the shared rail and keeps calculation closed initially", () => {
    act(() => {
      root.render(<CompensationVisualContent result={result} fallbackExplanation="Fallback" caseId="case-1" />);
    });

    expect(container.textContent).toContain("Between acute and chronic expectations");
    expect(container.querySelectorAll(".cmp-rail")).toHaveLength(1);
    expect(container.querySelectorAll(".cmp-band")).toHaveLength(3);
    expect(container.querySelector(".cmp-interpretation > .cmp-status")).not.toBeNull();
    expect(container.querySelector(".cmp-interpretation > .cmp-sentence")).not.toBeNull();
    expect(Array.from(container.querySelectorAll(".cmp-band__label"), label => label.textContent)).toEqual([
      "Reference",
      "Acute",
      "Chronic"
    ]);
    expect(container.textContent).toContain("HCO₃⁻");
    expect(container.textContent).not.toContain("vs expected ranges");
    expect(container.textContent).toContain("not to scale");
    expect(container.textContent).not.toContain("Schematic");
    expect(container.textContent).toContain("32 mmol/L");
    expect(container.querySelector(".cmp-calc__panel")).toBeNull();
    const firstBand = container.querySelector<HTMLElement>(".cmp-band");
    expect(firstBand?.style.getPropertyValue("--cmp-center")).not.toBe("");
    expect(firstBand?.querySelector(".cmp-band__label--center")).not.toBeNull();
    expect(firstBand?.querySelector(".cmp-band__bounds--low")?.textContent).toBe("22");
    expect(firstBand?.querySelector(".cmp-band__bounds--high")?.textContent).toBe("26");
    expect(container.querySelector(".cmp-band__midpoint")).toBeNull();
  });

  it("keeps centred band labels contained when a band hugs either rail edge", () => {
    const measurements = mockBandMeasurements({
      bandWidth: 300,
      lowWidth: 24,
      highWidth: 24,
      compactWidth: 60
    });
    restoreBandMeasurements = measurements.restore;
    const leftEdgeResult: CompensationResult = {
      ...result,
      targetAnalyte: "paco2",
      measuredValue: 81,
      unit: "mmHg",
      comparisonBands: [
        { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low: 22.5, high: 26.5 },
        { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 35, high: 45 }
      ],
      comparisons: [
        { bandId: "expected", relationship: "above" },
        { bandId: "reference", relationship: "above" }
      ],
      interpretationKey: "markedly_above_expected_range"
    };

    act(() => {
      root.render(<CompensationVisualContent result={leftEdgeResult} fallbackExplanation="Fallback" caseId="left-edge" />);
    });
    expect(container.querySelector(".cmp-band__label--start")?.textContent).toBe("Expected");
    expect(
      container.querySelector(".cmp-band--primary_expected .cmp-band__bounds--compact-start")?.textContent
    ).toBe("22.5–26.5");

    const rightEdgeResult: CompensationResult = {
      ...leftEdgeResult,
      measuredValue: 22,
      comparisonBands: [
        { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low: 76, high: 80 },
        { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 35, high: 45 }
      ],
      comparisons: [
        { bandId: "expected", relationship: "below" },
        { bandId: "reference", relationship: "below" }
      ],
      interpretationKey: "markedly_below_expected_range"
    };

    act(() => {
      root.render(<CompensationVisualContent result={rightEdgeResult} fallbackExplanation="Fallback" caseId="right-edge" />);
    });
    expect(container.querySelector(".cmp-band__label--end")?.textContent).toBe("Expected");
    expect(
      container.querySelector(".cmp-band--primary_expected .cmp-band__bounds--compact-end")?.textContent
    ).toBe("76–80");
  });

  it("collapses bounds from their true endpoint separation and responds to resizing", () => {
    const measurements = mockBandMeasurements({
      bandWidth: 400,
      lowWidth: 16,
      highWidth: 16,
      compactWidth: 48
    });
    restoreBandMeasurements = measurements.restore;

    act(() => {
      root.render(<CompensationVisualContent result={standardResult} fallbackExplanation="Fallback" caseId="standard" />);
    });

    const expectedBand = container.querySelector(".cmp-band--primary_expected");
    expect(expectedBand?.classList.contains("cmp-band--compact-bounds")).toBe(false);

    measurements.dimensions.bandWidth = 100;
    act(() => window.dispatchEvent(new Event("resize")));

    expect(expectedBand?.classList.contains("cmp-band--compact-bounds")).toBe(true);
    expect(expectedBand?.querySelector(".cmp-band__bounds--compact")?.textContent).toBe("24–28");
    expect(expectedBand?.querySelector(".cmp-band__segment")).not.toBeNull();

    measurements.dimensions.bandWidth = 400;
    act(() => window.dispatchEvent(new Event("resize")));

    expect(expectedBand?.classList.contains("cmp-band--compact-bounds")).toBe(false);
  });

  it("retains separate bounds until temporarily unavailable dimensions can be measured", () => {
    const measurements = mockBandMeasurements({
      bandWidth: 0,
      lowWidth: 16,
      highWidth: 16,
      compactWidth: 48
    });
    restoreBandMeasurements = measurements.restore;

    act(() => {
      root.render(<CompensationVisualContent result={standardResult} fallbackExplanation="Fallback" caseId="standard" />);
    });

    const expectedBand = container.querySelector(".cmp-band--primary_expected");
    expect(expectedBand?.classList.contains("cmp-band--compact-bounds")).toBe(false);

    measurements.dimensions.bandWidth = 100;
    act(() => window.dispatchEvent(new Event("resize")));

    expect(expectedBand?.classList.contains("cmp-band--compact-bounds")).toBe(true);
    expect(container.querySelector(".cmp-rail")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".cmp-visually-hidden")?.textContent).toContain("Expected");
  });

  it("opens the calculation and resets it when the case changes", () => {
    act(() => {
      root.render(<CompensationVisualContent result={result} fallbackExplanation="Fallback" caseId="case-1" />);
    });
    const toggle = container.querySelector<HTMLButtonElement>(".cmp-calc__toggle");
    act(() => toggle?.click());
    expect(container.querySelector(".cmp-calc__panel")).not.toBeNull();
    expect(container.querySelectorAll(".cmp-calc__lines > li")).toHaveLength(4);
    expect(container.querySelector(".cmp-calc__lines")).toBeInstanceOf(HTMLUListElement);

    const calculationItems = container.querySelectorAll(".cmp-calc__lines > li");
    expect(calculationItems[0].textContent).toContain("Acute:");
    expect(calculationItems[1].textContent).toContain("Chronic:");
    expect(calculationItems[2].textContent).toBe(
      "Expected HCO₃⁻: Acute 26.7 – 29 · Chronic 37 – 41 mmol/L"
    );
    expect(calculationItems[3].textContent).toBe("Measured HCO₃⁻: 32 mmol/L");

    const acuteRange = calculationItems[2].querySelector(".cmp-calc__range--acute_expected");
    const chronicRange = calculationItems[2].querySelector(".cmp-calc__range--chronic_expected");
    expect(acuteRange?.textContent).toBe("26.7 – 29");
    expect(chronicRange?.textContent).toBe("37 – 41");
    expect(container.querySelectorAll(".cmp-calc__range")).toHaveLength(2);
    expect(calculationItems[2].querySelector(".cmp-calc__range")?.textContent).not.toContain("Acute");
    expect(calculationItems[2].querySelector(".cmp-calc__range")?.textContent).not.toContain("mmol/L");

    const formulaButton = container.querySelector<HTMLButtonElement>(".cmp-formula-help__button");
    expect(formulaButton).not.toBeNull();
    expect(container.querySelector(".cmp-calc__header")?.contains(formulaButton)).toBe(true);
    expect(container.querySelector(".cmp-calc__lines")?.contains(formulaButton)).toBe(false);
    expect(formulaButton?.getAttribute("aria-label")).toBe(
      "Show acute and chronic respiratory acidosis formulas"
    );

    act(() => {
      root.render(<CompensationVisualContent result={result} fallbackExplanation="Fallback" caseId="case-2" />);
    });
    expect(container.querySelector(".cmp-calc__panel")).toBeNull();
  });

  it("shows both generic acute-on-chronic formulas and dismisses the popup accessibly", () => {
    act(() => {
      root.render(<CompensationVisualContent result={result} fallbackExplanation="Fallback" caseId="case-1" />);
    });
    act(() => container.querySelector<HTMLButtonElement>(".cmp-calc__toggle")?.click());
    const formulaButton = container.querySelector<HTMLButtonElement>(".cmp-formula-help__button");
    act(() => formulaButton?.click());

    const popup = container.querySelector(".cmp-formula-help__popover");
    expect(popup).not.toBeNull();
    expect(popup?.getAttribute("role")).toBe("dialog");
    expect(popup?.textContent).toContain("Acute Respiratory Acidosis");
    expect(popup?.textContent).toContain("Chronic Respiratory Acidosis");
    expect(popup?.textContent).toContain("Acceptable range: ±2 mmol/L");
    expect(popup?.textContent).not.toContain("80");

    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector(".cmp-formula-help__popover")).toBeNull();
    expect(document.activeElement).toBe(formulaButton);

    act(() => formulaButton?.click());
    expect(container.querySelector(".cmp-formula-help__popover")).not.toBeNull();
    act(() => document.body.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector(".cmp-formula-help__popover")).toBeNull();
  });

  it("shows one standard formula and colours only the standard expected range", () => {
    act(() => {
      root.render(<CompensationVisualContent result={standardResult} fallbackExplanation="Fallback" caseId="standard" />);
    });
    expect(container.querySelector(".cmp-visual__meta")?.textContent).toContain("PaCO₂");
    expect(container.querySelector(".cmp-visual__meta")?.textContent).not.toContain("vs expected ranges");
    act(() => container.querySelector<HTMLButtonElement>(".cmp-calc__toggle")?.click());

    const items = container.querySelectorAll(".cmp-calc__lines > li");
    expect(items).toHaveLength(3);
    const expectedRange = items[1].querySelector(".cmp-calc__range--primary_expected");
    expect(expectedRange?.textContent).toBe("24 – 28");
    expect(items[1].textContent).toBe("Expected PaCO₂: 24 – 28 mmHg");

    const formulaButton = container.querySelector<HTMLButtonElement>(".cmp-formula-help__button");
    expect(formulaButton?.getAttribute("aria-label")).toBe(
      "Show Metabolic Acidosis (Winter's Formula) formula"
    );
    act(() => formulaButton?.click());
    expect(container.querySelectorAll(".cmp-formula-help__rule")).toHaveLength(1);
    expect(container.querySelector(".cmp-formula-help__popover")?.textContent).toContain(
      "Metabolic Acidosis (Winter's Formula)"
    );
  });

  it("renders calculations without an icon when the rule key is unknown", () => {
    const unknownRuleResult: CompensationResult = {
      ...standardResult,
      calculation: {
        ...standardResult.calculation!,
        ruleKey: "future_rule"
      }
    };

    act(() => {
      root.render(<CompensationVisualContent result={unknownRuleResult} fallbackExplanation="Fallback" caseId="unknown" />);
    });
    act(() => container.querySelector<HTMLButtonElement>(".cmp-calc__toggle")?.click());

    expect(container.querySelectorAll(".cmp-calc__lines > li")).toHaveLength(3);
    expect(container.textContent).toContain("Winter's Formula:");
    expect(container.querySelector(".cmp-formula-help__button")).toBeNull();
  });

  it("resets formula help when the calculation closes", () => {
    act(() => {
      root.render(<CompensationVisualContent result={standardResult} fallbackExplanation="Fallback" caseId="standard" />);
    });
    const toggle = container.querySelector<HTMLButtonElement>(".cmp-calc__toggle");
    act(() => toggle?.click());
    act(() => container.querySelector<HTMLButtonElement>(".cmp-formula-help__button")?.click());
    expect(container.querySelector(".cmp-formula-help__popover")).not.toBeNull();

    act(() => toggle?.click());
    act(() => toggle?.click());
    expect(container.querySelector(".cmp-formula-help__popover")).toBeNull();
    expect(container.querySelector<HTMLButtonElement>(".cmp-formula-help__button")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the existing explanation when the structured result is malformed", () => {
    act(() => {
      root.render(
        <CompensationVisualContent
          result={{ ...result, comparisonBands: [] }}
          fallbackExplanation="Existing compensation prose."
          caseId="case-1"
        />
      );
    });

    expect(container.textContent).toContain("Existing compensation prose.");
    expect(container.querySelector(".cmp-rail")).toBeNull();
  });
});
