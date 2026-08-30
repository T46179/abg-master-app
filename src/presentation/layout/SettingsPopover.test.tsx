// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PressureUnit } from "../../core/types";
import { SettingsPopover } from "./SettingsPopover";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SettingsPopover", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderPopover(initialUnit: PressureUnit = "mmHg") {
    function Harness() {
      const [open, setOpen] = useState(false);
      const [pressureUnit, setPressureUnit] = useState<PressureUnit>(initialUnit);
      return (
        <SettingsPopover
          open={open}
          pressureUnit={pressureUnit}
          onToggle={() => setOpen(value => !value)}
          onClose={() => setOpen(false)}
          onPressureUnitChange={setPressureUnit}
        />
      );
    }

    act(() => root.render(<Harness />));
  }

  it("opens an accessible one-row panel and focuses the selected unit", () => {
    renderPopover("kPa");

    const trigger = container.querySelector<HTMLButtonElement>(".main-nav__settings-trigger");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    act(() => trigger?.click());

    const panel = container.querySelector<HTMLElement>(".main-nav__settings-panel");
    const selectedUnit = container.querySelector<HTMLButtonElement>('.main-nav__unit-option[aria-pressed="true"]');
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-label")).toBe("Settings");
    expect(panel?.textContent).toContain("Units");
    expect(panel?.textContent).toContain("Partial pressure display");
    expect(panel?.textContent).not.toContain("Reference ranges");
    expect(panel?.textContent).not.toContain("Night mode");
    expect(selectedUnit?.textContent).toBe("kPa");
    expect(document.activeElement).toBe(selectedUnit);
  });

  it("changes units without closing, then closes on outside click", () => {
    renderPopover();
    act(() => container.querySelector<HTMLButtonElement>(".main-nav__settings-trigger")?.click());

    const kPaButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".main-nav__unit-option"))
      .find(button => button.textContent === "kPa");
    act(() => kPaButton?.click());

    expect(kPaButton?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".main-nav__settings-panel")).not.toBeNull();

    act(() => document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(container.querySelector(".main-nav__settings-panel")).toBeNull();
  });

  it("closes on Escape and restores focus to the trigger", () => {
    renderPopover();
    const trigger = container.querySelector<HTMLButtonElement>(".main-nav__settings-trigger");
    act(() => trigger?.click());

    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

    expect(container.querySelector(".main-nav__settings-panel")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
