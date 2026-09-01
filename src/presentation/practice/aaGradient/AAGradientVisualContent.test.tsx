// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AAGradientResult, PressureUnit } from "../../../core/types";
import { AAGradientVisualContent } from "./AAGradientVisualContent";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const result: AAGradientResult = {
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
    qualifiers: ["Interpret alongside the delivered oxygen concentration."]
  }
};

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

function mockMeasurements(initialRailWidth: number) {
  const dimensions = { railWidth: initialRailWidth };
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList.contains("aag-bars__rail")) return measuredRect(dimensions.railWidth);
    const probe = this.getAttribute("data-aag-label-probe");
    if (probe?.endsWith("-full")) return measuredRect(100);
    if (probe?.endsWith("-compact")) return measuredRect(60);
    return original.call(this);
  };
  return {
    dimensions,
    restore() {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  };
}

describe("AAGradientVisualContent", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let restoreMeasurements: (() => void) | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    restoreMeasurements?.();
    container.remove();
  });

  function render(pressureUnit: PressureUnit = "mmHg", caseId = "case-one") {
    act(() => {
      root.render(
        <AAGradientVisualContent
          result={result}
          fallbackExplanation="Existing conclusion."
          caseId={caseId}
          pressureUnit={pressureUnit}
        />
      );
    });
  }

  it("renders the headline, shared-scale bars, authored interpretation, qualifiers, and screen-reader text", () => {
    render();

    expect(container.querySelector(".aag-result")?.textContent).toContain("534 mmHg");
    expect(container.querySelector(".aag-result__label")).toBeNull();
    expect(container.querySelector(".aag-bars__heading")?.textContent)
      .toBe("Oxygen partial pressure (mmHg)not to scale");
    expect(container.querySelector(".aag-bars__segment--alveolar")?.textContent).toContain("PAO₂ · 612 mmHg");
    expect(container.querySelector(".aag-bars__segment--arterial")?.textContent).toContain("PaO₂ · 78 mmHg");
    expect(container.querySelector(".aag-status")?.textContent).toContain("Markedly raised");
    expect(container.querySelector(".aag-status")?.getAttribute("data-interpretation-key")).toBe("impaired_transfer");
    expect(container.textContent).toContain("The gradient supports impaired oxygen transfer.");
    expect(container.textContent).toContain("Interpret alongside the delivered oxygen concentration.");
    expect(container.querySelector(".aag-visually-hidden")?.textContent).toContain("Estimated alveolar oxygen pressure 612 mmHg");
  });

  it("switches all visible and accessible pressure output to kPa without changing bar geometry", () => {
    render("mmHg");
    const arterialWidth = container.querySelector<HTMLElement>(".aag-bars__segment--arterial")?.style.width;
    const gradientWidth = container.querySelector<HTMLElement>(".aag-bars__segment--gradient")?.style.width;

    render("kPa");

    expect(container.querySelector(".aag-result")?.textContent).toContain("71.2 kPa");
    expect(container.querySelector(".aag-bars__heading")?.textContent)
      .toBe("Oxygen partial pressure (kPa)not to scale");
    expect(container.querySelector(".aag-bars__segment--alveolar")?.textContent).toContain("81.6 kPa");
    expect(container.querySelector(".aag-visually-hidden")?.textContent).toContain("measured arterial oxygen pressure 10.4 kPa");
    expect(container.querySelector<HTMLElement>(".aag-bars__segment--arterial")?.style.width).toBe(arterialWidth);
    expect(container.querySelector<HTMLElement>(".aag-bars__segment--gradient")?.style.width).toBe(gradientWidth);
  });

  it("provides an independent accessible calculation disclosure and resets it for a new case", () => {
    render("kPa");
    const toggle = container.querySelector<HTMLButtonElement>(".aag-calc__toggle");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-controls")).toBeTruthy();

    act(() => toggle?.click());
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".aag-calc__panel")?.id).toBe(toggle?.getAttribute("aria-controls"));
    expect(Array.from(container.querySelectorAll(".aag-calc__lines li")).map(line => line.textContent))
      .toEqual([
        "PAO₂ = 1 × (101.3 − 6.3) − (10.8 ÷ 0.8) = 81.6 kPa",
        "A–a gradient = 81.6 − 10.4 = 71.2 kPa"
      ]);

    const formulaButton = container.querySelector<HTMLButtonElement>(".aag-formula-help__button");
    expect(formulaButton?.getAttribute("aria-label")).toBe("Show A-a gradient formula");
    act(() => formulaButton?.click());
    expect(container.querySelector(".aag-formula-help__popover")?.textContent)
      .toContain("PAO2 ≈ 20.0 kPa − PaCO2 / 0.8");
    expect(container.querySelector(".aag-formula-help__popover")?.textContent).not.toContain("95.1");

    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(container.querySelector(".aag-formula-help__popover")).toBeNull();
    expect(document.activeElement).toBe(formulaButton);

    render("kPa", "case-two");
    expect(container.querySelector(".aag-calc__panel")).toBeNull();
  });

  it("borrows width from the gradient to keep the minimal arterial label in the bar", () => {
    const measurements = mockMeasurements(600);
    restoreMeasurements = measurements.restore;
    render();

    expect(container.querySelector(".aag-bars__segment--arterial")?.getAttribute("data-label-mode"))
      .toBe("compact");
    expect(container.querySelector(".aag-bars__segment--arterial")?.textContent).toBe("PaO₂ · 78");

    measurements.dimensions.railWidth = 400;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(container.querySelector(".aag-bars__segment--arterial")?.getAttribute("data-label-mode"))
      .toBe("compact");
    expect(container.querySelector(".aag-bars__segment--arterial")?.textContent).toBe("PaO₂ · 78");
    expect(container.querySelector<HTMLElement>(".aag-bars__segment--arterial")?.style.width)
      .toBe("19%");
    expect(container.querySelector(".aag-bars__callout--arterial")).toBeNull();
  });

  it("uses the conclusion-only prose fallback for invalid structured results", () => {
    act(() => {
      root.render(
        <AAGradientVisualContent
          result={{ ...result, canonicalUnit: "kPa" }}
          fallbackExplanation="Existing conclusion."
          caseId="invalid"
          pressureUnit="kPa"
        />
      );
    });

    expect(container.querySelector(".aag-fallback")?.textContent).toContain("Existing conclusion.");
    expect(container.querySelector(".aag-bars")).toBeNull();
  });
});
