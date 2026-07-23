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
      displayLines: [
        "Winter's Formula: (1.5 × 12) + 8 = 26 mmHg",
        "Expected PaCO2: 24 – 28 mmHg",
        "Measured PaCO2: 22 mmHg"
      ]
    },
    ...overrides
  };
}

describe("compensation visual model", () => {
  it("builds linear positions without deriving a conclusion", () => {
    const model = buildCompensationVisualModel(buildResult(), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.interpretationLabel).toBe("Below expected range");
    expect(model.markerPercent).toBe(0);
    expect(model.bands[0].lowPos).toBeCloseTo(8.6957, 4);
    expect(model.bands[0].highPos).toBeCloseTo(26.087, 3);
    expect(model.bands[0].centerPos).toBeCloseTo(17.3913, 4);
    expect(model.bands.every(band => band.lowPos >= 0 && band.highPos <= 100)).toBe(true);
    expect(model.bands.map(band => band.label)).toEqual(["Expected", "Reference"]);
    expect(model.targetLabel).toBe("PaCO₂");
    expect(model.accessibleDescription).toContain("measured value below");
  });

  it("builds semantic standard calculation rows and colours only the expected numbers", () => {
    const model = buildCompensationVisualModel(buildResult(), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculationRuleKey).toBe("winter");
    expect(model.calculationRows).toEqual([
      {
        id: "formula",
        parts: [{ text: "Winter's Formula: (1.5 × 12) + 8 = 26 mmHg" }]
      },
      {
        id: "expected",
        parts: [
          { text: "Expected PaCO₂: " },
          { text: "24 – 28", tone: "primary_expected" },
          { text: " mmHg" }
        ]
      },
      {
        id: "measured",
        parts: [{ text: "Measured PaCO₂: 22 mmHg" }]
      }
    ]);
  });

  it("builds four acute-on-chronic rows with separately coloured ranges and one trailing unit", () => {
    const model = buildCompensationVisualModel(buildResult({
      targetAnalyte: "hco3",
      measuredValue: 39,
      unit: "mmol/L",
      comparisonBands: [
        { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 22, high: 26 },
        { id: "acute_expected", role: "comparator", kindKey: "acute_expected", labelKey: "acute_expected", low: 26.8, high: 30.8, midpoint: 28.8 },
        { id: "chronic_expected", role: "comparator", kindKey: "chronic_expected", labelKey: "chronic_expected", low: 41.2, high: 45.2, midpoint: 43.2 }
      ],
      primaryExpectedBandId: "chronic_expected",
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
          "Acute: 24 + 1 × ((88 − 40) ÷ 10) = 28.8 mmol/L",
          "Chronic: 24 + 4 × ((88 − 40) ÷ 10) = 43.2 mmol/L",
          "Expected HCO3: Acute 26.8 – 30.8 · Chronic 41.2 – 45.2 mmol/L",
          "Measured HCO3: 39 mmol/L"
        ]
      }
    }), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculationRows).toEqual([
      {
        id: "acute-formula",
        parts: [{ text: "Acute: 24 + 1 × ((88 − 40) ÷ 10) = 28.8 mmol/L" }]
      },
      {
        id: "chronic-formula",
        parts: [{ text: "Chronic: 24 + 4 × ((88 − 40) ÷ 10) = 43.2 mmol/L" }]
      },
      {
        id: "expected",
        parts: [
          { text: "Expected HCO₃⁻: Acute " },
          { text: "26.8 – 30.8", tone: "acute_expected" },
          { text: " · Chronic " },
          { text: "41.2 – 45.2", tone: "chronic_expected" },
          { text: " mmol/L" }
        ]
      },
      {
        id: "measured",
        parts: [{ text: "Measured HCO₃⁻: 39 mmol/L" }]
      }
    ]);
    expect(model.qualifierMessages).toEqual([
      "Without a documented baseline, there is no precise combined expected range."
    ]);
  });

  it.each([
    ["paco2", "within_expected_range", "No additional respiratory acid–base process is evident."],
    ["paco2", "below_expected_range", "This suggests an additional respiratory alkalosis."],
    ["paco2", "above_expected_range", "This suggests an additional respiratory acidosis."],
    ["paco2", "markedly_below_expected_range", "This strongly suggests an additional respiratory alkalosis."],
    ["paco2", "markedly_above_expected_range", "This strongly suggests an additional respiratory acidosis."],
    ["hco3", "within_expected_range", "No additional metabolic acid–base process is evident."],
    ["hco3", "below_expected_range", "This suggests an additional metabolic acidosis."],
    ["hco3", "above_expected_range", "This suggests an additional metabolic alkalosis."],
    ["hco3", "markedly_below_expected_range", "This strongly suggests an additional metabolic acidosis."],
    ["hco3", "markedly_above_expected_range", "This strongly suggests an additional metabolic alkalosis."],
    ["hco3", "between_acute_and_chronic_expectations", "This suggests an acute-on-chronic respiratory process."]
  ] as const)("builds the %s %s inference", (targetAnalyte, interpretationKey, expectedSentence) => {
    const model = buildCompensationVisualModel(buildResult({
      targetAnalyte,
      unit: targetAnalyte === "paco2" ? "mmHg" : "mmol/L",
      interpretationKey
    }), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.clinicalSentence).toBe(expectedSentence);
  });

  it("preserves realistic proportions for the reported interval example", () => {
    const model = buildCompensationVisualModel(buildResult({
      measuredValue: 30.2,
      comparisonBands: [
        { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low: 27, high: 31, midpoint: 29 },
        { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 35, high: 45, midpoint: 40 }
      ],
      comparisons: [
        { bandId: "expected", relationship: "within" },
        { bandId: "reference", relationship: "below" }
      ],
      interpretationKey: "within_expected_range"
    }), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    const expected = model.bands.find(band => band.id === "expected");
    const reference = model.bands.find(band => band.id === "reference");
    expect(expected).toBeDefined();
    expect(reference).toBeDefined();
    if (!expected || !reference) return;

    expect(expected.highPos - expected.lowPos).toBeCloseTo(22.2222, 4);
    expect(reference.lowPos - expected.highPos).toBeCloseTo(22.2222, 4);
    expect(reference.highPos - reference.lowPos).toBeCloseTo(55.5556, 4);
    expect((model.markerPercent - expected.lowPos) / (expected.highPos - expected.lowPos)).toBeCloseTo(0.8, 5);
  });

  it.each([
    ["below", 10, 0],
    ["above", 60, 100]
  ])("keeps a measured value %s all intervals on the rail", (_relationship, measuredValue, expectedPosition) => {
    const model = buildCompensationVisualModel(buildResult({ measuredValue }), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.markerPercent).toBe(expectedPosition);
    expect(model.bands.every(band => band.lowPos >= 0 && band.highPos <= 100)).toBe(true);
  });

  it("includes additional comparator bands in the displayed domain", () => {
    const model = buildCompensationVisualModel(buildResult({
      measuredValue: 30,
      comparisonBands: [
        { id: "future", role: "comparator", kindKey: "future_expected", labelKey: "future_range", low: 10, high: 12 },
        { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low: 24, high: 28 },
        { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 35, high: 45 }
      ],
      comparisons: [
        { bandId: "future", relationship: "above" },
        { bandId: "expected", relationship: "above" },
        { bandId: "reference", relationship: "below" }
      ]
    }), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.bands.find(band => band.id === "future")?.lowPos).toBe(0);
    expect(model.bands.find(band => band.id === "reference")?.highPos).toBe(100);
  });

  it("centres a zero-span domain with finite positions", () => {
    const model = buildCompensationVisualModel(buildResult({
      measuredValue: 20,
      comparisonBands: [
        { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low: 20, high: 20, midpoint: 20 }
      ],
      comparisons: [{ bandId: "expected", relationship: "within" }],
      interpretationKey: "within_expected_range"
    }), "Fallback prose");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.markerPercent).toBe(50);
    expect(model.bands[0]).toMatchObject({ lowPos: 50, highPos: 50, centerPos: 50 });
  });

  it("accepts an unknown band kind as a neutral presentation case", () => {
    const result = buildResult({
      comparisonBands: [
        { id: "future", role: "expected", kindKey: "future_expected", labelKey: "future_range", low: 10, high: 20 }
      ],
      primaryExpectedBandId: "future",
      comparisons: [{ bandId: "future", relationship: "above" }]
    });

    expect(validateCompensationResult(result)).toBe(true);
    const model = buildCompensationVisualModel(result, "Fallback prose");
    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculationRows[1].parts).toEqual([
      { text: "Expected PaCO₂: " },
      { text: "10 – 20", tone: undefined },
      { text: " mmHg" }
    ]);
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

  it.each([
    buildResult({ measuredValue: Number.NaN }),
    buildResult({
      comparisonBands: [
        { id: "expected", role: "expected", kindKey: "primary_expected", labelKey: "expected_range", low: 24, high: Number.POSITIVE_INFINITY },
        { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 35, high: 45 }
      ]
    })
  ])("routes non-finite clinical values through the existing prose fallback", invalid => {
    expect(validateCompensationResult(invalid)).toBe(false);
    expect(buildCompensationVisualModel(invalid, "Existing compensation explanation")).toEqual({
      kind: "fallback",
      explanation: "Existing compensation explanation"
    });
  });
});
