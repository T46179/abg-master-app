import { describe, expect, it } from "vitest";
import type { ExplanationDomain } from "./types";
import {
  formatPartialPressureText,
  renderPartialPressureText,
  type PartialPressureTextSource
} from "./partialPressureText";
import goldenManifest from "../presentation/practice/testData/partialPressureTextPatternGoldens.json";

interface GoldenPattern {
  id: string;
  source: PartialPressureTextSource;
  domain: ExplanationDomain;
  disposition: "converted" | "unchanged";
  reason?: string;
  sourceText: string;
  expectedKPaText: string;
}

const manifest = goldenManifest as {
  contractVersion: string;
  patterns: GoldenPattern[];
};

describe("partial-pressure authored text pattern contract", () => {
  it("contains one stable reviewed golden for every pattern ID", () => {
    expect(manifest.contractVersion).toBe("3");
    expect(manifest.patterns).toHaveLength(21);
    expect(new Set(manifest.patterns.map(pattern => pattern.id)).size).toBe(manifest.patterns.length);

    for (const pattern of manifest.patterns) {
      expect(pattern.sourceText).toContain("mmHg");
      if (pattern.disposition === "unchanged") {
        expect(pattern.reason).toBeTruthy();
      }
    }
  });

  it.each(manifest.patterns)("renders $id according to its reviewed disposition", pattern => {
    const originalText = pattern.sourceText;
    const actual = renderPartialPressureText(pattern.sourceText, "kPa", {
      source: pattern.source,
      domain: pattern.domain
    });

    expect(actual).toBe(pattern.expectedKPaText);
    expect(pattern.sourceText).toBe(originalText);

    if (pattern.disposition === "converted") {
      expect(actual).not.toContain("mmHg");
      expect(actual).toContain("kPa");
    } else {
      expect(actual).toBe(pattern.sourceText);
    }
  });

  it.each(manifest.patterns)("returns $id byte-for-byte in mmHg mode", pattern => {
    expect(renderPartialPressureText(pattern.sourceText, "mmHg", {
      source: pattern.source,
      domain: pattern.domain
    })).toBe(pattern.sourceText);
  });
});

describe("formatPartialPressureText", () => {
  it("converts explicit values, decimals, ranges, and multiple values to one decimal", () => {
    expect(formatPartialPressureText("PaCO2 is 40 mmHg and PaO2 is 80.0 mmHg.", "kPa"))
      .toBe("PaCO2 is 5.3 kPa and PaO2 is 10.7 kPa.");
    expect(formatPartialPressureText("PaCO₂ is 35–45 mmHg.", "kPa"))
      .toBe("PaCO₂ is 4.7–6.0 kPa.");
  });

  it("converts the inherited acceptable range and appends its unit", () => {
    expect(formatPartialPressureText(
      "The expected PaCO2 is about 32 mmHg (acceptable range 30-34).",
      "kPa"
    )).toBe("The expected PaCO2 is about 4.3 kPa (acceptable range 4.0–4.5 kPa).");
  });

  it("converts a respiratory rule increment while leaving HCO3 values and constants unchanged", () => {
    expect(formatPartialPressureText(
      "Using the 1-2-4-5 rule, HCO3 should rise by 4 mmol/L for every 10 mmHg increase in PaCO2.",
      "kPa"
    )).toBe("Using the 1-2-4-5 rule, HCO3 should rise by 4 mmol/L for every 1.3 kPa increase in PaCO2.");
  });

  it("leaves unrelated, existing-kPa, and unsupported text unchanged", () => {
    const bloodPressure = "Blood pressure is 120/80 mmHg.";
    const existingKPa = "PaCO2 is 5.3 kPa.";
    const ambiguous = "PaCO2 is 40 mmHg and another pressure is 12 mmHg.";
    const unsupported = "The pressure of 40 mmHg corresponds to PaCO2.";

    expect(formatPartialPressureText(bloodPressure, "kPa")).toBe(bloodPressure);
    expect(formatPartialPressureText(existingKPa, "kPa")).toBe(existingKPa);
    expect(formatPartialPressureText(ambiguous, "kPa")).toBe(ambiguous);
    expect(formatPartialPressureText(unsupported, "kPa")).toBe(unsupported);
  });

  it("keeps A-a prose unchanged through the UI context policy", () => {
    const aaText = "With a measured PaO₂ of 90 mmHg, the A–a gradient is about 338 mmHg.";
    expect(renderPartialPressureText(aaText, "kPa", {
      source: "explanation",
      domain: "aa_gradient_mechanism"
    })).toBe(aaText);
  });
});
