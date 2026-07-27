import { describe, expect, it } from "vitest";
import type {
  AnionGapClassification,
  AnionGapResult,
  CaseInputs
} from "../../../core/types";
import { buildAnionGapVisualModel } from "./anionGapVisualModel";

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

function buildInputs(
  sodium: number,
  chloride: number,
  bicarbonate: number
): CaseInputs {
  return {
    electrolytes: {
      na_mmolL: sodium,
      cl_mmolL: chloride
    },
    gas: {
      hco3_mmolL: bicarbonate
    }
  };
}

describe("anion gap visual model", () => {
  it.each([
    { value: 2, classification: "low" as const },
    { value: 8, classification: "normal" as const },
    { value: 18, classification: "raised" as const }
  ])("preserves the supplied $classification classification", ({ value, classification }) => {
    const model = buildAnionGapVisualModel(
      buildResult(value, classification),
      undefined,
      "Fallback"
    );

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.status.tone).toBe(classification);
    expect(model.primaryMarker.classification).toBe(classification);
    expect(Number.isFinite(model.primaryMarker.position)).toBe(true);
    expect(model.primaryMarker.position).toBeGreaterThanOrEqual(0);
    expect(model.primaryMarker.position).toBeLessThanOrEqual(100);
  });

  it.each([
    { value: -4, classification: "low" as const },
    { value: 0, classification: "low" as const },
    { value: 16, classification: "raised" as const }
  ])("accepts the finite calculated AG value $value", ({ value, classification }) => {
    const model = buildAnionGapVisualModel(
      buildResult(value, classification),
      undefined,
      "Fallback"
    );

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculatedValue).toBe(value);
  });

  it("omits calculation data when electrolytes are missing or partial", () => {
    const missing = buildAnionGapVisualModel(
      buildResult(),
      undefined,
      "Fallback"
    );
    const partial = buildAnionGapVisualModel(
      buildResult(),
      {
        electrolytes: {
          na_mmolL: 140,
          cl_mmolL: 100
        }
      },
      "Fallback"
    );

    expect(missing.kind).toBe("visual");
    expect(partial.kind).toBe("visual");
    if (missing.kind !== "visual" || partial.kind !== "visual") return;
    expect(missing.calculation).toBeUndefined();
    expect(partial.calculation).toBeUndefined();
  });

  it("omits calculation data when the supplied electrolytes disagree with the result", () => {
    const model = buildAnionGapVisualModel(
      buildResult(16, "raised"),
      buildInputs(140, 100, 20),
      "Fallback"
    );

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculation).toBeUndefined();
  });

  it("keeps a consistent negative AG calculation but omits the ionic diagram", () => {
    const model = buildAnionGapVisualModel(
      buildResult(-4, "low"),
      buildInputs(140, 120, 24),
      "Fallback"
    );

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculation).toBeDefined();
    expect(model.calculation?.ionic).toBeUndefined();
    expect(model.calculation?.equationLines.at(-1)).toContain("= -4 mmol/L");
  });

  it.each([
    { value: 0, inputs: buildInputs(140, 116, 24) },
    { value: 24, inputs: buildInputs(140, 104, 12) }
  ])("builds textual and ionic data for a consistent AG of $value", ({ value, inputs }) => {
    const model = buildAnionGapVisualModel(
      buildResult(value, value === 0 ? "low" : "raised"),
      inputs,
      "Fallback"
    );

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculation).toBeDefined();
    expect(model.calculation?.ionic?.gap).toBe(value);
    expect(model.calculation?.ionic?.anions.at(-1)?.value).toBe(value);
  });

  it.each([
    {
      correctedValue: 18,
      correctedClassification: "raised" as const,
      expectedDirection: "higher" as const,
      changed: false
    },
    {
      correctedValue: 16,
      correctedClassification: "raised" as const,
      expectedDirection: "unchanged" as const,
      changed: false
    },
    {
      correctedValue: 10,
      correctedClassification: "normal" as const,
      expectedDirection: "lower" as const,
      changed: true
    }
  ])(
    "keeps albumin correction neutral when the value is $expectedDirection",
    ({ correctedValue, correctedClassification, expectedDirection, changed }) => {
      const model = buildAnionGapVisualModel(
        buildResult(16, "raised", {
          albuminCorrection: {
            measuredAlbumin: 32,
            albuminUnit: "g/L",
            correctedValue,
            classification: correctedClassification
          }
        }),
        buildInputs(140, 100, 24),
        "Fallback"
      );

      expect(model.kind).toBe("visual");
      if (model.kind !== "visual") return;
      expect(model.correction?.direction).toBe(expectedDirection);
      expect(model.correction?.changed).toBe(changed);
      expect(model.correction?.corrected.classification).toBe(correctedClassification);
    }
  );

  it("uses the uncorrected AG for the base equation and ionic gap when correction exists", () => {
    const model = buildAnionGapVisualModel(
      buildResult(16, "raised", {
        albuminCorrection: {
          measuredAlbumin: 32,
          albuminUnit: "g/L",
          correctedValue: 18,
          classification: "raised"
        }
      }),
      buildInputs(140, 100, 24),
      "Fallback"
    );

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.calculation?.ionic?.gap).toBe(16);
    expect(model.calculation?.equationLines[2]).toContain("= 16 mmol/L");
    expect(model.calculation?.equationLines[3]).toContain("= 18 mmol/L");
  });

  it("drops an invalid optional correction without losing the primary visual", () => {
    const result = {
      ...buildResult(16, "raised"),
      albuminCorrection: {
        measuredAlbumin: 32,
        albuminUnit: "g/dL",
        correctedValue: 18,
        classification: "raised"
      }
    };
    const model = buildAnionGapVisualModel(result, undefined, "Fallback");

    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;
    expect(model.correction).toBeUndefined();
    expect(model.correctedMarker).toBeUndefined();
    expect(model.primaryMarker.label).toBe("Calculated AG");
  });

  it.each([
    { overrides: { unit: "mEq/L" }, label: "invalid unit" },
    { overrides: { measuredValue: Number.NaN }, label: "non-finite value" },
    { overrides: { referenceLowerLimit: 12, referenceUpperLimit: 4 }, label: "invalid limits" },
    { overrides: { includesPotassium: true }, label: "potassium-inclusive result" }
  ])("uses the supplied prose fallback for an $label", ({ overrides }) => {
    const model = buildAnionGapVisualModel(
      { ...buildResult(), ...overrides },
      undefined,
      "Existing anion gap explanation."
    );

    expect(model).toEqual({
      kind: "fallback",
      explanation: "Existing anion gap explanation."
    });
  });

  it("uses generic unavailable copy only when the supplied fallback is empty", () => {
    const model = buildAnionGapVisualModel(undefined, undefined, "   ");

    expect(model).toEqual({
      kind: "fallback",
      explanation: "Anion gap details are unavailable for this case."
    });
  });
});
