// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { BuildAGasCalibrationStep } from "./BuildAGasCalibrationStep";
import { CompensationCheckCalibrationStep } from "./CompensationCheckCalibrationStep";
import { MixedProcessCalibrationStep } from "./MixedProcessCalibrationStep";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Calibration pressure display", () => {
  it("preserves canonical selections when display units change", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSelectionChange = vi.fn();
    try {
      act(() => root.render(<BuildAGasCalibrationStep pressureUnit="mmHg" onSelectionChange={onSelectionChange} />));
      act(() => container.querySelector<HTMLElement>('[aria-label="PaCO2 40 normal"]')?.click());
      expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ PaCO2: "40" }));
      act(() => root.render(<BuildAGasCalibrationStep pressureUnit="kPa" onSelectionChange={onSelectionChange} />));
      expect(container.querySelector('[aria-label="PaCO2 5.3 normal selected"]')?.getAttribute("aria-pressed")).toBe("true");
      expect(container.querySelector(".calibration-build-gas__summary")?.textContent).toContain("5.3 kPa");
      expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ PaCO2: "40" }));
      act(() => container.querySelector<HTMLElement>('[aria-label="PaCO2 3.7 low"]')?.click());
      expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ PaCO2: "28" }));
    } finally { act(() => root.unmount()); }
  });

  it("converts compensation and AG pressures/ranges while preserving other values", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      act(() => root.render(<CompensationCheckCalibrationStep pressureUnit="kPa" />));
      expect(container.textContent).toContain("3.5kPa");
      expect(container.textContent).toContain("4.7 - 6.0 kPa");
      expect(container.textContent).toContain("7.25");
      expect(container.textContent).toContain("12mmol/L");
      expect(container.textContent).not.toContain("mmHg");
      act(() => root.render(<MixedProcessCalibrationStep pressureUnit="kPa" />));
      expect(container.textContent).toContain("3.6kPa");
      expect(container.textContent).toContain("140mmol/L");
      expect(container.textContent).toContain("100mmol/L");
      expect(container.textContent).not.toContain("mmHg");
    } finally { act(() => root.unmount()); }
  });
});
