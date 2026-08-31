// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MetricInlineText } from "./MetricText";

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
