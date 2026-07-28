// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AnionGapClassification,
  AnionGapResult,
  CaseInputs
} from "../../../core/types";
import { AnionGapVisualContent } from "./AnionGapVisualContent";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function buildResult(
  measuredValue = 16,
  classification: AnionGapClassification = "raised",
  overrides: Partial<AnionGapResult> = {}
): AnionGapResult {
  return {
    measuredValue,
    unit: "mmol/L",
    referenceLowerLimit: 4,
    referenceUpperLimit: 12,
    classification,
    includesPotassium: false,
    ...overrides
  };
}

const completeInputs: CaseInputs = {
  electrolytes: {
    na_mmolL: 140,
    cl_mmolL: 100
  },
  gas: {
    hco3_mmolL: 24
  }
};

type IonicProbeKey =
  | "cl-full"
  | "cl-numeric"
  | "hco3-full"
  | "hco3-numeric"
  | "gap-full"
  | "gap-numeric";

interface IonicMeasurementDimensions {
  railWidth: number;
  labels: Record<IonicProbeKey, number>;
}

function ionicDimensions(
  railWidth: number,
  overrides: Partial<Record<IonicProbeKey, number>> = {}
): IonicMeasurementDimensions {
  return {
    railWidth,
    labels: {
      "cl-full": 40,
      "cl-numeric": 16,
      "hco3-full": 33,
      "hco3-numeric": 8,
      "gap-full": 23,
      "gap-numeric": 8,
      ...overrides
    }
  };
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

function mockIonicMeasurements(initial: IonicMeasurementDimensions) {
  const dimensions: IonicMeasurementDimensions = {
    railWidth: initial.railWidth,
    labels: { ...initial.labels }
  };
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList.contains("ag-ionic__bar--anions")) {
      return measuredRect(dimensions.railWidth);
    }

    const probe = this.getAttribute("data-ag-label-probe") as IonicProbeKey | null;
    if (probe) return measuredRect(dimensions.labels[probe]);

    return originalGetBoundingClientRect.call(this);
  };

  return {
    dimensions,
    restore() {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  };
}

function segmentWidth(container: HTMLElement, key: "cl" | "hco3" | "gap") {
  const width = container
    .querySelector<HTMLElement>(`.ag-ionic__seg--${key}`)
    ?.style.width.replace("%", "");
  return Number(width);
}

function segmentMode(container: HTMLElement, key: "cl" | "hco3" | "gap") {
  return container
    .querySelector<HTMLElement>(`.ag-ionic__seg--${key}`)
    ?.dataset.labelMode;
}

const adaptiveInputs: CaseInputs = {
  electrolytes: {
    na_mmolL: 142,
    cl_mmolL: 114
  },
  gas: {
    hco3_mmolL: 17
  }
};

function renderExpandedCalculation(
  root: ReturnType<typeof createRoot>,
  result: AnionGapResult = buildResult(11, "normal"),
  caseInputs: CaseInputs = adaptiveInputs
) {
  act(() => {
    root.render(
      <AnionGapVisualContent
        result={result}
        caseInputs={caseInputs}
        fallbackExplanation="Fallback"
        caseId="adaptive-case"
      />
    );
  });
  act(() => {
    document.querySelector<HTMLButtonElement>(".ag-calc__toggle")?.click();
  });
}

describe("AnionGapVisualContent", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let restoreIonicMeasurements: (() => void) | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    restoreIonicMeasurements?.();
    restoreIonicMeasurements = undefined;
    container.remove();
  });

  it("renders the gauge followed by status and neutral correction copy", () => {
    const result = buildResult(16, "raised", {
      albuminCorrection: {
        measuredAlbumin: 32,
        albuminUnit: "g/L",
        correctedValue: 18,
        classification: "raised"
      }
    });

    act(() => {
      root.render(
        <AnionGapVisualContent
          result={result}
          caseInputs={completeInputs}
          fallbackExplanation="Fallback"
          caseId="case-1"
        />
      );
    });

    expect(container.querySelector(".ag-gauge")).not.toBeNull();
    expect(container.querySelector(".ag-status--raised")).not.toBeNull();
    expect(
      container
        .querySelector(".ag-gauge")
        ?.nextElementSibling
        ?.classList.contains("ag-interpretation")
    ).toBe(true);
    expect(container.querySelector(".ag-interpretation > .ag-status")).not.toBeNull();
    expect(container.querySelector(".ag-interpretation > .ag-sentence")).not.toBeNull();
    expect(container.querySelector(".ag-value")).toBeNull();
    expect(container.querySelector(".ag-gauge__note")).toBeNull();
    expect(container.textContent).toContain("Raised anion gap");
    expect(container.textContent).toContain("Reference range 4");
    expect(container.textContent).toContain("Albumin-corrected AG");
    expect(container.textContent).toContain("Classification unchanged");
    expect(container.textContent).not.toContain("Fallback");
  });

  it("toggles the calculation with linked disclosure attributes and resets for a new case", () => {
    act(() => {
      root.render(
        <AnionGapVisualContent
          result={buildResult()}
          caseInputs={completeInputs}
          fallbackExplanation="Fallback"
          caseId="case-1"
        />
      );
    });

    const button = container.querySelector<HTMLButtonElement>(".ag-calc__toggle");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(button?.getAttribute("aria-controls")).toBeTruthy();
    expect(container.querySelector(".ag-calc__panel")).toBeNull();

    act(() => {
      button?.click();
    });

    expect(button?.getAttribute("aria-expanded")).toBe("true");
    const panel = container.querySelector(".ag-calc__panel");
    expect(panel?.id).toBe(button?.getAttribute("aria-controls"));
    expect(container.textContent).toContain("Hide calculation");
    expect(container.querySelector(".ag-ionic__legend")?.textContent).toContain(
      "Na⁺ 140 (measured)"
    );
    expect(container.querySelector(".ag-ionic__legend")?.textContent).toContain(
      "Anion gap 16 (calculated)"
    );

    act(() => {
      root.render(
        <AnionGapVisualContent
          result={buildResult()}
          caseInputs={completeInputs}
          fallbackExplanation="Fallback"
          caseId="case-2"
        />
      );
    });

    expect(container.querySelector(".ag-calc__toggle")?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".ag-calc__panel")).toBeNull();
  });

  it("keeps raw proportions and full labels when the rail is roomy", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(1000));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "cl")).toBe("full");
    expect(segmentMode(container, "hco3")).toBe("full");
    expect(segmentMode(container, "gap")).toBe("full");
    expect(segmentWidth(container, "cl")).toBeCloseTo(114 / 142 * 100, 4);
    expect(segmentWidth(container, "hco3")).toBeCloseTo(17 / 142 * 100, 4);
    expect(segmentWidth(container, "gap")).toBeCloseTo(11 / 142 * 100, 4);
    expect(
      container.querySelector(".ag-ionic__seg--gap .ag-ionic__seg-label")?.textContent
    ).toBe("AG 11");
    expect(container.querySelector(".ag-ionic__legend")?.textContent).toContain(
      "Anion gap 11 (calculated)"
    );
  });

  it("borrows constrained width only from chloride for readable full labels", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(300));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "hco3")).toBe("full");
    expect(segmentMode(container, "gap")).toBe("full");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(45 / 300 * 100, 4);
    expect(segmentWidth(container, "gap")).toBeCloseTo(35 / 300 * 100, 4);
    expect(segmentWidth(container, "cl")).toBeCloseTo(100 - (45 + 35) / 300 * 100, 4);
  });

  it("recalculates numeric-only allocation from the measured numeric label", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(300, {
      "hco3-full": 38,
      "gap-full": 28
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "hco3")).toBe("full");
    expect(segmentMode(container, "gap")).toBe("numeric");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(50 / 300 * 100, 4);
    expect(segmentWidth(container, "gap")).toBeCloseTo(11 / 142 * 100, 4);
    expect(
      container.querySelector(".ag-ionic__seg--gap .ag-ionic__seg-label")?.textContent
    ).toBe("11");
  });

  it("uses numeric widths from raw proportions after a full-label candidate is rejected", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(300, {
      "hco3-full": 50,
      "gap-full": 28
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "hco3")).toBe("numeric");
    expect(segmentMode(container, "gap")).toBe("numeric");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(17 / 142 * 100, 4);
    expect(segmentWidth(container, "gap")).toBeCloseTo(11 / 142 * 100, 4);
    expect(segmentWidth(container, "cl")).toBeCloseTo(114 / 142 * 100, 4);
  });

  it("restores raw widths when small-segment labels must be hidden", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(300, {
      "hco3-full": 100,
      "hco3-numeric": 100,
      "gap-full": 100,
      "gap-numeric": 100
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "hco3")).toBe("hidden");
    expect(segmentMode(container, "gap")).toBe("hidden");
    expect(segmentWidth(container, "cl")).toBeCloseTo(114 / 142 * 100, 4);
    expect(segmentWidth(container, "hco3")).toBeCloseTo(17 / 142 * 100, 4);
    expect(segmentWidth(container, "gap")).toBeCloseTo(11 / 142 * 100, 4);
    expect(container.querySelector(".ag-ionic__seg--hco3 .ag-ionic__seg-label")).toBeNull();
    expect(container.querySelector(".ag-ionic__seg--gap .ag-ionic__seg-label")).toBeNull();
  });

  it("degrades labels when the total distortion cap would be exceeded", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(300, {
      "hco3-full": 38,
      "gap-full": 28
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "hco3")).toBe("full");
    expect(segmentMode(container, "gap")).toBe("numeric");
    expect(segmentWidth(container, "cl")).toBeGreaterThan(75);
  });

  it("degrades labels before crossing the chloride dominance floor", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(300, {
      "cl-full": 225
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "hco3")).toBe("numeric");
    expect(segmentMode(container, "gap")).toBe("numeric");
    expect(segmentWidth(container, "cl")).toBeCloseTo(114 / 142 * 100, 4);
  });

  it("keeps zero AG at zero width while allowing bicarbonate to adapt", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(300, {
      "hco3-full": 45
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(
      root,
      buildResult(0, "low"),
      {
        electrolytes: {
          na_mmolL: 140,
          cl_mmolL: 116
        },
        gas: {
          hco3_mmolL: 24
        }
      }
    );

    expect(segmentMode(container, "hco3")).toBe("full");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(57 / 300 * 100, 4);
    expect(segmentMode(container, "gap")).toBe("hidden");
    expect(segmentWidth(container, "gap")).toBe(0);
    expect(container.querySelector(".ag-ionic__seg--gap .ag-ionic__seg-label")).toBeNull();
    expect(container.querySelector(".ag-ionic__legend")?.textContent).toContain(
      "Anion gap 0 (calculated)"
    );
  });

  it("recomputes label mode and allocated widths in both resize directions", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(1000, {
      "hco3-full": 38,
      "gap-full": 28
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);
    expect(segmentMode(container, "gap")).toBe("full");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(17 / 142 * 100, 4);

    measurements.dimensions.railWidth = 300;
    act(() => window.dispatchEvent(new Event("resize")));

    expect(segmentMode(container, "gap")).toBe("numeric");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(50 / 300 * 100, 4);

    measurements.dimensions.railWidth = 1000;
    act(() => window.dispatchEvent(new Event("resize")));

    expect(segmentMode(container, "gap")).toBe("full");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(17 / 142 * 100, 4);
    expect(segmentWidth(container, "gap")).toBeCloseTo(11 / 142 * 100, 4);
  });

  it("retains raw widths until temporarily unavailable dimensions recover", () => {
    const measurements = mockIonicMeasurements(ionicDimensions(0, {
      "hco3-full": 38,
      "gap-full": 28
    }));
    restoreIonicMeasurements = measurements.restore;

    renderExpandedCalculation(root);

    expect(segmentMode(container, "gap")).toBe("full");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(17 / 142 * 100, 4);
    expect(segmentWidth(container, "gap")).toBeCloseTo(11 / 142 * 100, 4);

    measurements.dimensions.railWidth = 300;
    act(() => window.dispatchEvent(new Event("resize")));

    expect(segmentMode(container, "gap")).toBe("numeric");
    expect(segmentWidth(container, "hco3")).toBeCloseTo(50 / 300 * 100, 4);
  });

  it("omits the calculation control when electrolyte data is incomplete", () => {
    act(() => {
      root.render(
        <AnionGapVisualContent
          result={buildResult()}
          caseInputs={{ electrolytes: { na_mmolL: 140, cl_mmolL: 100 } }}
          fallbackExplanation="Fallback"
          caseId="case-1"
        />
      );
    });

    expect(container.querySelector(".ag-gauge")).not.toBeNull();
    expect(container.querySelector(".ag-calc__toggle")).toBeNull();
  });

  it("shows a signed negative calculation without an ionic-balance diagram", () => {
    act(() => {
      root.render(
        <AnionGapVisualContent
          result={buildResult(-4, "low")}
          caseInputs={{
            electrolytes: {
              na_mmolL: 140,
              cl_mmolL: 120
            },
            gas: {
              hco3_mmolL: 24
            }
          }}
          fallbackExplanation="Fallback"
          caseId="case-negative"
        />
      );
    });

    const button = container.querySelector<HTMLButtonElement>(".ag-calc__toggle");
    expect(button).not.toBeNull();

    act(() => {
      button?.click();
    });

    expect(container.querySelector(".ag-equation")?.textContent).toContain("= -4 mmol/L");
    expect(container.querySelector(".ag-ionic")).toBeNull();
  });

  it("renders the existing explanation body in the styled fallback", () => {
    act(() => {
      root.render(
        <AnionGapVisualContent
          result={undefined}
          caseInputs={completeInputs}
          fallbackExplanation="Existing anion gap explanation."
          caseId="case-1"
        />
      );
    });

    expect(container.querySelector(".ag-fallback")).not.toBeNull();
    expect(container.textContent).toContain("Existing anion gap explanation.");
    expect(container.querySelector(".ag-gauge")).toBeNull();
  });
});
