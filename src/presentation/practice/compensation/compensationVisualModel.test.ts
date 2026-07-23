import { describe, expect, it } from "vitest";
import type { CompensationResult } from "../../../core/types";
import {
  buildCompensationVisualModel,
  validateCompensationResult
} from "./compensationVisualModel";

function buildResult(overrides: Partial<CompensationResult> = {}): CompensationResult {
  return {
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
      displayLines: ["Winter's formula", "Expected range: 24-28 mmHg"]
    },
    ...overrides
  };
}

describe("compensation visual model", () => {
  it("builds schematic ordinal positions without deriving a conclusion", () => {
    const model = buildCompensationVisualModel(buildResult(), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.interpretationLabel).toBe("Below expected range");
    expect(model.markerPercent).toBeLessThan(model.bands[0].lowPos);
    expect(model.bands.every(band => band.lowPos >= 0 && band.highPos <= 100)).toBe(true);
    expect(model.bands[0].midPos).toBe(50);
    expect(model.targetLabel).toBe("PaCO₂");
    expect(model.accessibleDescription).toContain("measured value below");
  });

  it("accepts an unknown band kind as a neutral presentation case", () => {
    const result = buildResult({
      comparisonBands: [
        { id: "future", role: "comparator", kindKey: "future_expected", labelKey: "future_range", low: 10, high: 20 }
      ],
      primaryExpectedBandId: undefined,
      comparisons: [{ bandId: "future", relationship: "above" }]
    });

    expect(validateCompensationResult(result)).toBe(true);
    expect(buildCompensationVisualModel(result, "Fallback prose").kind).toBe("visual");
  });

  it("routes malformed and dangling-band results to prose fallback", () => {
    const malformed = buildResult({
      comparisons: [{ bandId: "missing", relationship: "below" }]
    });

    expect(validateCompensationResult(malformed)).toBe(false);
    expect(buildCompensationVisualModel(malformed, "Existing compensation explanation")).toEqual({
      kind: "fallback",
      explanation: "Existing compensation explanation"
    });
  });
});
