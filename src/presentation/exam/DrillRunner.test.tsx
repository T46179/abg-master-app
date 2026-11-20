// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DrillQuestion, DrillRequest } from "../../core/examDrills";
import { DrillRunner } from "./DrillRunner";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  container.className = "exam-screen";
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderQuestion(request: DrillRequest, visual?: DrillQuestion["visual"], withChoice = true) {
  const respiratoryCompensation = request.drill === "compensation" && request.rule === "respiratory";
  const prompt = respiratoryCompensation
    ? "Calculate the expected HCO₃⁻ for chronic respiratory acidosis"
    : "Calculate the result";
  const question: DrillQuestion = {
    values: [{ label: "PaCO₂", value: 40, unit: "mmHg" }],
    numeric: { prompt, target: 10, tolerance: 0.05, decimals: 1, unit: "", working: "Result = 10.0." },
    visual,
    ...(withChoice ? { choice: {
      prompt: respiratoryCompensation ? "How does the measured HCO₃⁻ compare with the expected range?" : "Interpret the result",
      options: [{ id: "within", label: "Within the range" }, { id: "above", label: "Above the range" }],
      correctId: "within",
      working: "Compare the result with the supplied range.",
    } } : {}),
  };
  act(() => root.render(<DrillRunner title="Focused drill" request={request} busy={false} error=""
    set={{ help: { title: "Rule", formula: "Formula" }, questions: [question, question] }}
    onRepeat={() => {}} onExit={() => {}} />));
}

function clickButton(label: string) {
  const button = [...container.querySelectorAll("button")].find(item => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  act(() => button!.click());
}

function submitNumber() {
  const input = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "10");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  clickButton("Check");
}

function mockChartResize(observedSelector: string) {
  const callbacks = new Set<() => void>();
  vi.stubGlobal("ResizeObserver", class {
    constructor(private readonly callback: () => void) {}

    observe(target: Element) {
      if (target.matches(observedSelector)) callbacks.add(this.callback);
    }

    disconnect() {
      callbacks.delete(this.callback);
    }
  });
  return () => act(() => {
    expect(callbacks.size).toBeGreaterThan(0);
    callbacks.forEach(callback => callback());
  });
}

it.each([
  { rule: "met-acidosis", pressureUnit: "kPa", analyte: "PaCO₂", value: 5.6, low: 3.4, high: 3.9, unit: "kPa", reference: [4.7, 6], referenceRelationship: "within" },
  { rule: "met-alkalosis", pressureUnit: "mmHg", analyte: "PaCO₂", value: 45, low: 45, high: 51, unit: "mmHg", reference: [35, 45], referenceRelationship: "within" },
  { rule: "respiratory", pressureUnit: "kPa", analyte: "HCO₃⁻", value: 28, low: 24, high: 28, unit: "mmol/L", reference: [22, 26], referenceRelationship: "above" },
] as const)("mounts the native range rail after completing $rule", ({ rule, pressureUnit, analyte, value, low, high, unit, reference, referenceRelationship }) => {
  renderQuestion({ drill: "compensation", count: 5, rule, pressureUnit },
    { kind: "range", label: `${analyte} vs expected`, value, low, high, unit });
  expect(container.querySelector(".cmp-rail")).toBeNull();
  const choicePrompt = rule === "respiratory" ? "Interpret the HCO₃⁻ response." : "Interpret the result";
  expect(container.querySelector(".exam-drill-step-waiting")?.textContent).toBe(choicePrompt);
  expect(container.querySelector("label.exam-drill-prompt strong")?.textContent).toBe(rule === "respiratory" ? "chronic" : undefined);
  expect(container.querySelector("label.exam-drill-prompt")?.textContent)
    .toBe(rule === "respiratory" ? "Calculate the expected HCO₃⁻ (chronic)" : "Calculate the result");
  submitNumber();
  expect(container.querySelector(".exam-drill-numeric-feedback .exam-drill-prompt strong")?.textContent)
    .toBe(rule === "respiratory" ? "chronic" : undefined);
  expect(container.querySelector(".exam-drill-choices legend")?.textContent).toBe(choicePrompt);
  expect(container.querySelector(".cmp-rail")).toBeNull();
  expect([...container.querySelectorAll(".exam-drill-choices button")].map(button => button.textContent)).toEqual(
    rule === "respiratory"
      ? ["Appropriate metabolic compensation", "Additional metabolic acidosis", "Additional metabolic alkalosis"]
      : ["Additional respiratory acidosis", "Additional respiratory alkalosis", "Appropriate respiratory compensation"],
  );
  clickButton(rule === "respiratory" ? "Appropriate metabolic compensation" : "Appropriate respiratory compensation");
  expect(container.querySelector('.exam-drill-choices legend [role="status"]')?.textContent).toBe("Correct");
  expect(container.querySelector(".exam-drill-visualiser .cmp-rail")).not.toBeNull();
  expect(container.querySelector(".cmp-marker__chip")?.textContent).toBe(`${value} ${unit}`);
  expect(container.querySelector(".cmp-callout.cmp-band--primary_expected .cmp-callout__value")?.textContent).toBe(`${low}–${high} ${unit}`);
  expect(container.querySelector(".cmp-callout.cmp-band--reference .cmp-callout__value")?.textContent).toBe(`${reference.join("–")} ${unit}`);
  expect(container.querySelector(".cmp-visually-hidden")?.textContent).toContain(
    `Reference: ${reference[0]} to ${reference[1]} ${unit}, measured value ${referenceRelationship}.`,
  );
  expect(container.querySelector(".cmp-visually-hidden")?.textContent).toContain(
    `Expected: ${low} to ${high} ${unit}, measured value ${value > high ? "above" : "within"}.`,
  );
  clickButton("Next question");
  expect(container.querySelector(".cmp-rail")).toBeNull();
});

it("reflows the compensation rail in both directions using the drill's measured width", () => {
  let width = 500;
  const notifyResize = mockChartResize(".cmp-band");
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("cmp-band")) return new DOMRect(0, 0, width, 16);
    if (this.classList.contains("cmp-band__bounds")) return new DOMRect(0, 0, 48, 16);
    return original.call(this);
  });

  renderQuestion({ drill: "compensation", count: 5, rule: "met-acidosis", pressureUnit: "mmHg" },
    { kind: "range", label: "PaCO₂ vs expected", value: 40, low: 24, high: 28, unit: "mmHg" });
  submitNumber();
  clickButton("Additional respiratory acidosis");
  expect(container.querySelector('.exam-drill-choices legend [role="status"]')?.textContent).toBe("Not Quite");
  expect(container.querySelector('.exam-drill-choices [data-result="incorrect"]')?.textContent).toBe("Additional respiratory acidosis");
  expect(container.querySelector('.exam-drill-choices [data-result="correct"]')?.getAttribute("aria-label"))
    .toBe("Appropriate respiratory compensation (correct answer)");
  expect(container.textContent).not.toContain("Compare the result with the supplied range.");
  const band = container.querySelector(".exam-drill-visualiser .cmp-band--primary_expected")!;
  expect(band.classList.contains("cmp-band--compact-bounds")).toBe(false);

  width = 200;
  notifyResize();
  expect(band.classList.contains("cmp-band--compact-bounds")).toBe(true);
  expect(band.querySelector(".cmp-band__bounds--compact")?.textContent).toBe("24–28");

  width = 500;
  notifyResize();
  expect(band.classList.contains("cmp-band--compact-bounds")).toBe(false);
});

it.each([[4, "normal", "30%"], [12, "normal", "70%"], [16, "raised", "85%"]])(
  "plots anion gap %s against the drill's reference limits",
  (value, classification, position) => {
    renderQuestion({ drill: "anion-gap", count: 5 },
      { kind: "range", label: "Anion gap", value, low: 4, high: 12, unit: "mmol/L" });
    submitNumber();
    expect(container.querySelector(".ag-gauge")).toBeNull();
    clickButton("Not raised");
    expect(container.querySelector(".exam-drill-visualiser .ag-gauge__meta")?.textContent).toBe("Reference range 4–12 mmol/L");
    expect(container.querySelector<HTMLElement>(".ag-marker")?.style.getPropertyValue("--ag-pos")).toBe(position);
    expect(container.querySelector(".ag-visually-hidden")?.textContent).toContain(`Calculated anion gap ${value} mmol/L, classified ${classification}.`);
  },
);

it("reflows native A–a gradient labels without changing the displayed pressures", () => {
  let width = 700;
  const notifyResize = mockChartResize(".aag-bars__rail");
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("aag-bars__rail")) return new DOMRect(0, 0, width, 16);
    const labelProbe = this.getAttribute("data-aag-label-probe");
    if (labelProbe) return new DOMRect(0, 0, labelProbe.endsWith("-full") ? 100 : 60, 16);
    return original.call(this);
  });

  renderQuestion({ drill: "aa-gradient", count: 5, pressureUnit: "kPa" },
    { kind: "difference", label: "Alveolar and arterial oxygen", alveolar: 12.5, arterial: 10, gradient: 2.5, unit: "kPa" }, false);
  expect(container.querySelector(".aag-bars")).toBeNull();
  submitNumber();
  const segment = container.querySelector(".exam-drill-visualiser .aag-bars__segment--gradient")!;
  expect(segment.getAttribute("data-label-mode")).toBe("full");
  expect(container.querySelector(".aag-visually-hidden")?.textContent)
    .toBe("A–a gradient 2.5 kPa. Estimated alveolar oxygen pressure 12.5 kPa; measured arterial oxygen pressure 10.0 kPa.");

  width = 155;
  notifyResize();
  expect(segment.getAttribute("data-label-mode")).toBe("hidden");
  expect(container.querySelector(".aag-bars__callout--gradient")?.textContent).toContain("A–a gradient: 2.5 kPa");

  width = 700;
  notifyResize();
  expect(segment.getAttribute("data-label-mode")).toBe("full");
  expect(container.querySelector(".aag-bars__callout--gradient")).toBeNull();
});

it.each([
  { drill: "delta-ratio", label: "Delta ratio", value: 1.2, low: 0.8, high: 2, unit: "" },
  { drill: "corrections", label: "Corrected sodium", value: 146, low: 135, high: 145, unit: "mmol/L" },
] as const)("keeps the existing $label chart", ({ drill, label, value, low, high, unit }) => {
  renderQuestion({ drill, count: 5 }, { kind: "range", label, value, low, high, unit });
  submitNumber();
  clickButton("Within the range");
  expect(container.querySelector(".exam-drill-graphic figcaption")?.textContent).toBe(label);
  expect(container.querySelector(".exam-drill-visualiser")).toBeNull();
});

it("completes P/F ratio without a chart", () => {
  renderQuestion({ drill: "pf-ratio", count: 5, pressureUnit: "mmHg" }, undefined, false);
  const progress = container.querySelector('.exam-drill-runner-header [role="progressbar"]');
  expect(progress?.getAttribute("aria-valuetext")).toBe("Question 1 of 2");
  expect(container.querySelector(".exam-drill-progress-count")?.textContent).toBe("1/2");
  expect(progress?.firstElementChild?.getAttribute("data-step")).toBe("current");
  submitNumber();
  expect(container.querySelector(".exam-drill-visualiser, .exam-drill-graphic")).toBeNull();
  clickButton("Next question");
  expect(progress?.getAttribute("aria-valuetext")).toBe("Question 2 of 2");
  expect(container.querySelector(".exam-drill-progress-count")?.textContent).toBe("2/2");
  expect(progress?.firstElementChild?.getAttribute("data-step")).toBe("complete");
  expect(progress?.lastElementChild?.getAttribute("data-step")).toBe("current");
});
