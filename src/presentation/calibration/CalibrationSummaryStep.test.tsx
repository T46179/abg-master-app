// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CalibrationSummaryStep } from "./CalibrationSummaryStep";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Calibration recommendations", () => {
  it.each(["beginner", "intermediate", "advanced", "master"] as const)("allows choosing Master from a %s recommendation", placement => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onStartDifficulty = vi.fn();
    try {
      act(() => root.render(<CalibrationSummaryStep openPracticeAccess placement={placement} onStartDifficulty={onStartDifficulty} />));
      expect(container.querySelector(".calibration-summary-page__eyebrow")?.textContent).toBe("Suggested level");
      expect(container.querySelector("h1")?.textContent).toBe(placement.charAt(0).toUpperCase() + placement.slice(1));
      expect(container.querySelectorAll("button:disabled")).toHaveLength(0);
      expect(container.textContent).not.toContain("Requires level");
      expect(container.querySelector('[aria-pressed="true"]')?.textContent).toContain(placement.charAt(0).toUpperCase() + placement.slice(1));
      const master = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Master"));
      act(() => master?.click());
      act(() => container.querySelector<HTMLButtonElement>(".calibration-summary-page__primary")?.click());
      expect(onStartDifficulty).toHaveBeenCalledWith("master");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("retains original tier restrictions when open mode is disabled", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<CalibrationSummaryStep placement="beginner" onStartDifficulty={vi.fn()} />));
    expect(container.querySelectorAll("button:disabled")).toHaveLength(3);
    act(() => root.unmount());
  });
});
