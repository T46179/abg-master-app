import { describe, expect, it } from "vitest";
import {
  buildAAGradientVisualModel,
  getAAGradientLabelMode
} from "./aaGradientVisualModel";

const result = {
  formulaVersion: "alveolar_gas_v1",
  canonicalUnit: "mmHg",
  inputs: {
    fio2Fraction: 1,
    measuredPaCO2MmHg: 81,
    measuredPaO2MmHg: 78
  },
  assumptions: {
    barometricPressureMmHg: 760,
    waterVapourPressureMmHg: 47,
    respiratoryQuotient: 0.8
  },
  calculated: {
    inspiredOxygenPressureMmHg: 713,
    co2CorrectionMmHg: 101.25,
    alveolarOxygenPressureMmHg: 611.75,
    aaGradientMmHg: 533.75
  },
  interpretation: {
    key: "impaired_transfer",
    tone: "raised",
    label: "Markedly raised",
    explanation: "The gradient supports impaired oxygen transfer.",
    qualifiers: ["Interpret alongside the clinical context."]
  }
} as const;

describe("A-a gradient visual model", () => {
  it("retains full-precision canonical values and applies the explicit mmHg rounding policy", () => {
    const model = buildAAGradientVisualModel(result, "mmHg", "Fallback");
    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;

    expect(model.canonical.aaGradientMmHg).toBe(533.75);
    expect(model.canonical.alveolarOxygenPressureMmHg).toBe(611.75);
    expect(model.headline.mainValue).toBe("534");
    expect(model.bars.alveolar.mainValue).toBe("612");
    expect(model.calculationRows.map(row => row.value)).toEqual([
      "713 mmHg",
      "101.3 mmHg",
      "611.8 mmHg",
      "78 mmHg",
      "533.8 mmHg"
    ]);
  });

  it("formats every kPa pressure to exactly one decimal", () => {
    const model = buildAAGradientVisualModel(result, "kPa", "Fallback");
    expect(model.kind).toBe("visual");
    if (model.kind !== "visual") return;

    expect(model.headline.mainValue).toBe("71.2");
    expect(model.bars.alveolar.mainValue).toBe("81.6");
    expect(model.bars.arterial.mainValue).toBe("10.4");
    expect(model.calculationRows.every(row => /\d+\.\d kPa$/.test(row.value))).toBe(true);
  });

  it("does not change geometry, interpretation, or source objects when units change", () => {
    const before = structuredClone(result);
    const mmHg = buildAAGradientVisualModel(result, "mmHg", "Fallback");
    const kPa = buildAAGradientVisualModel(result, "kPa", "Fallback");

    expect(mmHg.kind).toBe("visual");
    expect(kPa.kind).toBe("visual");
    if (mmHg.kind !== "visual" || kPa.kind !== "visual") return;
    expect(kPa.geometry).toEqual(mmHg.geometry);
    expect(kPa.interpretation).toEqual(mmHg.interpretation);
    expect(kPa.canonical).toEqual(mmHg.canonical);
    expect(result).toEqual(before);
  });

  it("rejects tampered calculations, assumptions, and invalid interpretation data", () => {
    const candidates = [
      { ...result, calculated: { ...result.calculated, aaGradientMmHg: 500 } },
      { ...result, assumptions: { ...result.assumptions, barometricPressureMmHg: 750 } },
      { ...result, interpretation: { ...result.interpretation, tone: "warning" } },
      { ...result, inputs: { ...result.inputs, fio2Fraction: 0 } }
    ];

    for (const candidate of candidates) {
      expect(buildAAGradientVisualModel(candidate, "mmHg", "Existing conclusion."))
        .toEqual({ kind: "fallback", explanation: "Existing conclusion." });
    }
  });

  it("uses full, compact, and hidden modes according to measured segment width", () => {
    expect(getAAGradientLabelMode(180, 120, 80)).toBe("full");
    expect(getAAGradientLabelMode(110, 120, 80)).toBe("compact");
    expect(getAAGradientLabelMode(70, 120, 80)).toBe("hidden");
  });
});
