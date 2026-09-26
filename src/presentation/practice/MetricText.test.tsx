// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricInlineText, MetricRichText } from "./MetricText";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MetricInlineText pressure text rendering", () => {
  const containers: HTMLDivElement[] = [];

  afterEach(() => {
    for (const container of containers) container.remove();
    containers.length = 0;
  });

  it("keeps metric subscripts and remounts rendered text when units change", () => {
    const container = document.createElement("div");
    containers.push(container);
    document.body.appendChild(container);
    const root = createRoot(container);
    const context = { source: "explanation" as const, domain: "primary_disorder" as const };

    act(() => {
      root.render(
        <MetricInlineText
          text="PaCO2 is 40 mmHg."
          pressureUnit="mmHg"
          pressureTextContext={context}
        />
      );
    });

    const mmHgSubscript = container.querySelector("sub");
    expect(container.textContent).toBe("PaCO2 is 40 mmHg.");
    expect(mmHgSubscript?.textContent).toBe("2");

    act(() => {
      root.render(
        <MetricInlineText
          text="PaCO2 is 40 mmHg."
          pressureUnit="kPa"
          pressureTextContext={context}
        />
      );
    });

    expect(container.textContent).toBe("PaCO2 is 5.3 kPa.");
    expect(container.querySelector("sub")?.textContent).toBe("2");
    expect(container.querySelector("sub")).not.toBe(mmHgSubscript);

    act(() => root.unmount());
  });
});

describe("Exam notation", () => {
  it("formats plain and Unicode notation identically without changing surrounding wording", () => {
    const plain = "SpO2, SaO2, PaO2, PO2, PaCO2, PCO2, FiO2, HCO3-, CO2, Na+, K+, Cl- at 0.21 and 40 mmHg.";
    const unicode = "SpO₂, SaO₂, PaO₂, PO₂, PaCO₂, PCO₂, FiO₂, HCO₃⁻, CO₂, Na⁺, K⁺, Cl⁻ at 0.21 and 40 mmHg.";
    const element = document.createElement("div");
    element.innerHTML = renderToStaticMarkup(<MetricRichText>{plain}</MetricRichText>);
    expect(element.textContent).toBe(plain);
    expect(element.querySelectorAll("sub")).toHaveLength(9);
    expect(element.querySelectorAll("sup")).toHaveLength(4);
    const other = document.createElement("div");
    other.innerHTML = renderToStaticMarkup(<MetricRichText>{unicode}</MetricRichText>);
    expect(other.textContent).toBe(plain);
    expect(other.querySelectorAll("sub")).toHaveLength(9);
  });
  it("preserves existing JSX notation and formats text inside emphasis", () => {
    const element = document.createElement("div");
    element.innerHTML = renderToStaticMarkup(<MetricRichText>
      <>SpO<sub>2</sub> and <strong>PCO2</strong> with HCO3-.</>
    </MetricRichText>);
    expect(element.textContent).toBe("SpO2 and PCO2 with HCO3-.");
    expect(element.querySelectorAll("sub")).toHaveLength(3);
    expect(element.querySelector("sub sub")).toBeNull();
    expect(element.querySelector("strong sub")?.textContent).toBe("2");
  });
  it("does not format tokens embedded in unrelated words", () => {
    const markup = renderToStaticMarkup(<MetricInlineText text="xSpO2 SpO2suffix G6PD" />);
    expect(markup).not.toContain("<sub>");
  });
});
