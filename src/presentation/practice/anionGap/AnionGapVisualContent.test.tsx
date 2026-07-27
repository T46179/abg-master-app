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

describe("AnionGapVisualContent", () => {
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

  it("renders the Figma headline, gauge, status and neutral correction copy", () => {
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
    expect(container.textContent).toContain("Uncorrected AG");
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
