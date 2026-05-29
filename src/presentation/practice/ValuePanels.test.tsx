// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValuePanels } from "./ValuePanels";
import type { CaseData } from "../../core/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function buildCaseItem(): CaseData {
  return {
    case_id: "oxygenation-case",
    difficulty_level: 4,
    inputs: {
      gas: {
        ph: 7.24,
        paco2_mmHg: 52,
        hco3_mmolL: 22,
        pao2_mmHg: 68
      },
      electrolytes: {
        na_mmolL: 138,
        cl_mmolL: 104,
        k_mmolL: 4.4
      },
      oxygenation: {
        fio2_fraction: 1,
        spo2_percent: 92
      },
      lactate_mmolL: 2.4
    }
  };
}

describe("ValuePanels", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("marks oxygenation metrics with the oxygenation card class only", () => {
    act(() => {
      root.render(
        <ValuePanels
          caseItem={buildCaseItem()}
          showAdvancedRanges={false}
          showAbnormalHighlighting={false}
        />
      );
    });

    const oxygenationLabels = ["FiO2", "PaO2", "SpO2"];
    for (const label of oxygenationLabels) {
      const labelNode = Array.from(container.querySelectorAll(".metric-card__label"))
        .find(node => node.textContent === label);
      expect(labelNode?.closest(".metric-card")?.classList.contains("metric-card--oxygenation")).toBe(true);
      expect(labelNode?.querySelector("sub")?.textContent).toBe("2");
    }

    const metricCards = Array.from(container.querySelectorAll(".metric-card"));
    expect(metricCards.filter(card => card.classList.contains("metric-card--oxygenation"))).toHaveLength(3);
    expect(metricCards.some(card => !card.classList.contains("metric-card--oxygenation"))).toBe(true);
  });
});
