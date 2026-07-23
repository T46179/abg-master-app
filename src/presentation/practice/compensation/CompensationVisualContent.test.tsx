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
    { id: "reference", role: "reference", kindKey: "reference", labelKey: "reference_range", low: 22, high: 26 },
    { id: "acute", role: "comparator", kindKey: "acute_expected", labelKey: "acute_expected", low: 26.7, high: 29 },
    { id: "chronic", role: "comparator", kindKey: "chronic_expected", labelKey: "chronic_expected", low: 37, high: 41 }
  ],
  comparisons: [
    { bandId: "reference", relationship: "above" },
    { bandId: "acute", relationship: "above" },
    { bandId: "chronic", relationship: "below" }
  ],
  interpretationKey: "between_acute_and_chronic_expectations",
  qualifierKeys: ["acute_on_chronic_without_known_baseline"],
  calculation: {
    ruleKey: "acute_on_chronic_respiratory_acidosis",
    displayLines: ["Acute expected HCO3: 26.7-29", "Chronic expected HCO3: 37-41"]
  }
};

describe("CompensationVisualContent", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the shared rail and keeps calculation closed initially", () => {
    act(() => {
      root.render(<CompensationVisualContent result={result} fallbackExplanation="Fallback" caseId="case-1" />);
    });

    expect(container.textContent).toContain("Between acute and chronic expectations");
    expect(container.querySelectorAll(".cmp-rail")).toHaveLength(1);
    expect(container.querySelectorAll(".cmp-band")).toHaveLength(3);
    expect(container.textContent).toContain("HCO₃⁻ vs expected ranges");
    expect(container.textContent).toContain("Schematic — not to scale");
    expect(container.textContent).toContain("32 mmol/L");
    expect(container.querySelector(".cmp-calc__panel")).toBeNull();
  });

  it("opens the calculation and resets it when the case changes", () => {
    act(() => {
      root.render(<CompensationVisualContent result={result} fallbackExplanation="Fallback" caseId="case-1" />);
    });
    const toggle = container.querySelector<HTMLButtonElement>(".cmp-calc__toggle");
    act(() => toggle?.click());
    expect(container.querySelector(".cmp-calc__panel")).not.toBeNull();

    act(() => {
      root.render(<CompensationVisualContent result={result} fallbackExplanation="Fallback" caseId="case-2" />);
    });
    expect(container.querySelector(".cmp-calc__panel")).toBeNull();
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
