// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readDrillSet, type DrillQuestion, type DrillRequest } from "../../core/examDrills";
import { FocusedDrills } from "./FocusedDrills";
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

function renderQuestion(request: DrillRequest, visual?: DrillQuestion["visual"], withChoice = true, overrides: Partial<DrillQuestion> = {}) {
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
    ...overrides,
  };
  const help = respiratoryCompensation
    ? { title: "Respiratory compensation", formula: "HCO₃⁻ = 24 + factor × (PaCO₂ − 40) ÷ 10 ± 2" }
    : { title: "Rule", formula: "Formula" };
  const set = readDrillSet({ help, questions: Array(request.count).fill(question) }, request);
  act(() => root.render(<DrillRunner title="Focused drill" request={request} busy={false} error=""
    set={{ ...set, questions: set.questions.slice(0, 2) }}
    onRepeat={() => {}} onExit={() => {}} />));
}

it("shows the respiratory compensation rule card with the supplied tolerance", () => {
  renderQuestion({ drill: "compensation", count: 5, rule: "respiratory", pressureUnit: "mmHg" });

  expect(container.querySelector(".exam-drill-rule")?.textContent)
    .toContain("HCO₃⁻ = 24 + multiplier × (PaCO₂ − 40) ÷ 10 ± 2");
  expect([...container.querySelectorAll(".exam-drill-rule-notes li")].map(note => note.textContent)).toEqual([
    "Respiratory acidosis: 1 acute, 4 chronic",
    "Respiratory alkalosis: 2 acute, 5 chronic",
    "HCO₃⁻ above expected: additional metabolic alkalosis",
    "HCO₃⁻ below expected: additional metabolic acidosis",
  ]);
});

function clickButton(label: string) {
  const button = [...container.querySelectorAll("button")].find(item => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  act(() => button!.click());
}

function submitNumber(entry = "10") {
  const input = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, entry);
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
      { kind: "range", label: "Anion gap", value, low: 4, high: 12, unit: "mmol/L" }, false);
    expect(container.querySelector(".ag-gauge")).toBeNull();
    submitNumber();
    expect(container.querySelector(".exam-drill-visualiser .ag-gauge__meta")?.textContent).toBe("Reference range 4–12 mmol/L");
    expect(container.querySelector<HTMLElement>(".ag-marker")?.style.getPropertyValue("--ag-pos")).toBe(position);
    expect(container.querySelector(".ag-visually-hidden")?.textContent).toContain(`Calculated anion gap ${value} mmol/L, classified ${classification}.`);
  },
);

it("grades a rounded albumin-corrected gap and displays its chart without a legacy choice step", () => {
  renderQuestion({ drill: "anion-gap", count: 5 },
    { kind: "range", label: "Albumin-corrected AG", value: 13.5, low: 4, high: 12, unit: "mmol/L" }, true, {
      values: [{ label: "Albumin", value: 26, unit: "g/L" }],
      numeric: {
        prompt: "Calculate the albumin-corrected anion gap", target: 13.5, tolerance: 1, decimals: 1, unit: "mmol/L",
        working: "140 − (112 + 18) = 10.0 mmol/L. Correct for albumin: 10.0 + 0.25 × (40 − 26) = 13.5 mmol/L.",
      },
      choice: {
        prompt: "Is the albumin-corrected gap raised?",
        options: [{ id: "within", label: "Not raised" }, { id: "raised", label: "Raised" }],
        correctId: "raised",
        working: "The albumin-corrected gap is above 12 mmol/L.",
      },
    });
  expect(container.querySelector(".metric-card__label")?.textContent).toBe("Albumin");
  expect(container.querySelector(".metric-card__value span")?.textContent).toBe("26");
  expect(container.querySelector(".metric-card__value small")?.textContent).toBe("g/L");
  expect(container.querySelector(".metric-card__reference")?.textContent).toBe("35 - 50 g/L");
  expect(container.querySelector(".metric-card__value--abnormal span")?.textContent).toBe("26");
  expect(container.querySelector("label.exam-drill-prompt")?.textContent).toBe("What is the anion gap?");
  expect(container.textContent).not.toContain("Correct for albumin.");
  const descriptionId = container.querySelector("input")!.getAttribute("aria-describedby")!;
  expect(document.getElementById(descriptionId)?.textContent).toBe("mmol/L");
  expect(container.querySelectorAll(".exam-drill-steps li")).toHaveLength(1);
  submitNumber("14.5");
  expect(container.querySelector(".exam-drill-numeric-feedback .exam-drill-feedback-status")?.textContent).toBe("Correct");
  expect([...container.querySelectorAll(".exam-drill-submitted-answer, .exam-drill-calculation")].map(line => line.textContent)).toEqual([
    "Your answer: 14.5 mmol/L",
    "AG = 140 − (112 + 18) = 10.0 mmol/L",
    "Corrected AG = 10.0 + 0.25 × (40 − 26) = 13.5 mmol/L",
  ]);
  expect(container.querySelector(".exam-drill-choices")).toBeNull();
  expect(container.querySelector(".ag-marker__chip")?.textContent).toBe("Albumin-corrected AG 13.5");
  expect(container.querySelector(".ag-marker--corrected")).toBeNull();
  expect(container.querySelector(".ag-visually-hidden")?.textContent).toContain("Albumin-corrected anion gap 13.5 mmol/L, classified raised.");
});

it("scores numerical accuracy independently of interpretation across a clinical threshold", () => {
  renderQuestion({ drill: "delta-ratio", count: 5, pressureUnit: "mmHg" }, undefined, true, {
    numeric: {
      prompt: "Calculate the delta ratio", target: 0.78, tolerance: 0.1, decimals: 2, unit: "", working: "Result = 0.78.",
    },
    choice: {
      prompt: "What does this delta ratio suggest in high anion gap metabolic acidosis?",
      options: [{ id: "nagma", label: "Additional NAGMA" }, { id: "isolated", label: "Isolated HAGMA" }],
      correctId: "nagma",
      working: "The calculated ratio is below 0.8.",
    },
  });

  const interpretationPrompt = "What acid–base disorder does this suggest?";
  expect(container.querySelector(".exam-drill-step-waiting")?.textContent).toBe(interpretationPrompt);
  submitNumber("0.85");
  expect(container.querySelector(".exam-drill-choices legend")?.textContent).toBe(interpretationPrompt);
  expect(container.querySelector(".exam-drill-numeric-feedback .exam-drill-feedback-status")?.textContent).toBe("Correct");
  clickButton("Isolated HAGMA");
  expect(container.querySelector(".exam-drill-choices [role='status']")?.textContent).toBe("Not Quite");
  expect(container.querySelector("button.exam-drill-next")?.textContent?.trim()).toBe("Next question");
  clickButton("Next question");

  submitNumber("0.89");
  expect(container.querySelector(".exam-drill-numeric-feedback .exam-drill-feedback-status")?.textContent).toBe("Not Quite");
  clickButton("Additional NAGMA");
  expect(container.querySelector(".exam-drill-choices [role='status']")?.textContent).toBe("Correct");
  expect(container.querySelector("button.exam-drill-next")?.textContent?.trim()).toBe("See summary");
  clickButton("See summary");
  expect(container.querySelector(".exam-drill-summary-score")?.textContent).toBe("2 of 4 steps correct");
});

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

it("shows the calculated gap below the gas metrics without a delta ratio chart", () => {
  renderQuestion({ drill: "delta-ratio", count: 5, pressureUnit: "mmHg" },
    { kind: "range", label: "Delta ratio", value: 1.2, low: 0.8, high: 2, unit: "" }, true, {
      values: [
        { label: "pH", value: 7.31, unit: "", decimals: 2 },
        { label: "PaCO₂", value: 30.5, unit: "mmHg" },
        { label: "HCO₃⁻", value: 15, unit: "mmol/L" },
        { label: "Anion gap", value: 23, unit: "mmol/L" },
      ],
    });
  const metrics = container.querySelector(".exam-drill-values")!;
  expect([...metrics.querySelectorAll(".metric-card__label")].map(label => label.textContent)).toEqual(["pH", "PaCO2", "HCO3-"]);
  expect(metrics.nextElementSibling?.textContent).toBe("Anion gap 23 mmol/L");
  submitNumber();
  clickButton("Within the range");
  expect(container.querySelector(".exam-drill-visualiser, .exam-drill-graphic")).toBeNull();
});

it.each([
  { response: "calculation only", withChoice: false },
  { response: "legacy interpretation", withChoice: true },
])("scores only the sodium calculation with a $response response", ({ withChoice }) => {
  const legacyVisual: DrillQuestion["visual"] = withChoice ? {
    kind: "range", label: "Corrected sodium", value: 146, low: 135, high: 145, unit: "mmol/L",
  } : undefined;
  renderQuestion({ drill: "corrections", count: 5 }, legacyVisual, withChoice, {
    numeric: {
      prompt: "Calculate the corrected sodium", target: 146, tolerance: 1, decimals: 1, unit: "mmol/L",
      working: "142 + 0.3 × (18.8 − 5.5) ≈ 146.0 mmol/L.",
    },
  });
  expect(container.querySelectorAll(".exam-drill-steps li")).toHaveLength(1);
  submitNumber("146");
  expect(container.querySelector(".exam-drill-choices")).toBeNull();
  expect(container.querySelector(".exam-drill-visualiser, .exam-drill-graphic")).toBeNull();
  expect(container.querySelector(".exam-drill-calculation strong")?.textContent).toBe("146.0 mmol/L");
  clickButton("Next question");
  submitNumber("143");
  clickButton("See summary");
  expect(container.querySelector(".exam-drill-summary-score")?.textContent).toBe("1 of 2 steps correct");
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

it.each(["met-acidosis", "respiratory"] as const)("keeps drafts and checked verdicts consistent during live %s unit changes", async rule => {
  const respiratory = rule === "respiratory";
  function makeQuestion(unit: "mmHg" | "kPa"): DrillQuestion {
    const answerUnit = respiratory ? "mmol/L" : unit;
    const target = respiratory ? 25 : unit === "mmHg" ? 40 : 5.3;
    return {
      values: [{ label: "PaCO₂", value: unit === "mmHg" ? 50 : 6.7, unit }],
      numeric: { prompt: "Calculate", target, tolerance: 0.1, unit: answerUnit, decimals: 1, working: `Result = ${target} ${answerUnit}` },
      choice: { prompt: "Interpret", options: [{ id: "above", label: "Above" }, { id: "within", label: "Within" }],
        correctId: "above", working: "Above the range." },
    };
  }
  const loadDrill = vi.fn(async () => ({
    help: { title: "Rule", formula: "Formula" }, questions: [makeQuestion("mmHg"), makeQuestion("mmHg")],
    alternateQuestions: [makeQuestion("kPa"), makeQuestion("kPa")],
  }));
  const renderUnit = (unit: "mmHg" | "kPa") => act(() => root.render(
    <FocusedDrills loadDrill={loadDrill} pressureUnit={unit} dashboardHeader={null} />));
  renderUnit("mmHg");
  const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
  act(() => buttons().find(b => b.querySelector(".exam-card-title")?.textContent === "Compensation")!.click());
  if (respiratory) act(() => buttons().find(b => b.classList.contains("exam-rule") && /respiratory/i.test(b.querySelector("strong")!.textContent!))!.click());
  await act(async () => buttons().find(b => b.textContent?.includes("Start Compensation drill"))!.click());
  const notes = () => [...container.querySelectorAll(".exam-drill-rule-notes li")].map(li => li.textContent);
  const originalNotes = notes();
  const input = container.querySelector<HTMLInputElement>("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "12");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  renderUnit("kPa");
  expect(input.value).toBe(respiratory ? "12" : "");
  const conversion = "kPa → mmHg: ×7.5 | mmHg → kPa: ×0.133";
  expect(notes()).toEqual(respiratory ? [...originalNotes, conversion] : originalNotes);
  expect(container.textContent?.includes(conversion)).toBe(respiratory);
  submitNumber(respiratory ? "25" : "5.3");
  renderUnit("mmHg");
  expect(container.textContent).not.toContain(conversion);
  expect(container.querySelector(".exam-drill-submitted-answer")?.textContent)
    .toBe(respiratory ? "Your answer: 25 mmol/L" : "Your answer: 5.3 kPa");
  clickButton("Within");
  renderUnit("kPa");
  renderUnit("mmHg");
  const verdicts = () => [...container.querySelectorAll(".exam-drill-feedback-status")].map(el => el.textContent);
  expect(verdicts()).toEqual(["Correct", "Not Quite"]);
  clickButton("Next question");
  submitNumber("0");
  clickButton("Above");
  renderUnit("kPa");
  expect(verdicts()).toEqual(["Not Quite", "Correct"]);
  clickButton("See summary");
  expect(container.querySelector(".exam-drill-summary-score")?.textContent).toBe("2 of 4 steps correct");
  expect(loadDrill).toHaveBeenCalledTimes(1);
});
