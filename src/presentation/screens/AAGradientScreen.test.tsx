// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialAppState, type AppState } from "../../app/state";
import { createLocalStorageAdapter, STORAGE_KEYS } from "../../core/storage";
import type { SessionState } from "../../core/types";
import { AAGradientScreen } from "./AAGradientScreen";

const context = vi.hoisted(() => ({ current: {} as {
  state: AppState;
  patchSessionState: (patch: Partial<SessionState>) => void;
} }));
vi.mock("../../app/AppProvider", () => ({ useAppContext: () => context.current }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AAGradientScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    localStorage.clear();
    context.current = { state: initialAppState, patchSessionState: vi.fn() };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  function render() {
    act(() => root.render(
      <MemoryRouter initialEntries={["/a-a-gradient/"]}>
        <AAGradientScreen />
      </MemoryRouter>
    ));
  }

  function click(selector: string) {
    const button = container.querySelector<HTMLButtonElement>(selector);
    expect(button).not.toBeNull();
    act(() => button!.click());
  }

  it("loads saved kPa without waiting for runtime initialization and converts every numeric pressure", () => {
    localStorage.setItem(STORAGE_KEYS.PRESSURE_UNIT_STORAGE_KEY, "kPa");
    context.current.state = { ...initialAppState, status: "error" };
    render();

    expect(container.querySelector("#equation")?.textContent).toContain("6.3 kPa");
    expect(container.querySelector("#equation")?.textContent).toContain("101.3 kPa");
    expect(container.querySelector("#equation")?.textContent).toContain("PAO₂ ≈ 20.0 − 1.25 × PaCO₂");
    expect(container.querySelector("#normal")?.textContent).toContain("(age / 4 + 4) × 0.133322 kPa");
    expect(Array.from(container.querySelectorAll(".aa-guide__age-value"), node => node.textContent))
      .toEqual(["≈ 1.2 kPa", "≈ 1.9 kPa", "≈ 2.5 kPa", "≈ 3.2 kPa"]);
    expect(container.querySelector("#cases")?.textContent).toContain("A–a = 13.3 − 8.0 = 5.3 kPa");
    expect(container.querySelector("#cases")?.textContent).toContain("A–a = 10.0 − 8.7 = 1.3 kPa");
    expect(container.querySelector("#cases")?.textContent).toContain("A–a = 10.0 − 6.0 = 4.0 kPa");
    expect(container.querySelector("#clinical")?.textContent).toContain("PaO₂ < 9.3 kPa");
    expect(container.querySelector("#clinical")?.textContent).toContain("gradient ≥ 4.7 kPa");
    expect(container.querySelector("#cases")?.textContent).not.toContain("mmHg");
  });

  it("uses the inline pressure-unit control to persist the selection and restore the original mmHg equations", () => {
    render();
    const originalCases = container.querySelector("#cases")?.textContent;
    click('[aria-label="Pressure units"] button:nth-child(2)');
    expect(localStorage.getItem(STORAGE_KEYS.PRESSURE_UNIT_STORAGE_KEY)).toBe("kPa");
    expect(context.current.patchSessionState).toHaveBeenCalledWith({ pressureUnit: "kPa" });
    expect(container.querySelector("#cases")?.textContent).toContain("5.3 kPa");
    click('[aria-label="Pressure units"] button:first-child');
    expect(localStorage.getItem(STORAGE_KEYS.PRESSURE_UNIT_STORAGE_KEY)).toBe("mmHg");
    expect(container.querySelector("#cases")?.textContent).toBe(originalCases);
    expect(container.querySelector("#equation")?.textContent).toContain("PAO₂ ≈ 150 − 1.25 × PaCO₂");
  });

  it("uses the hydrated app preference and keeps it synchronized when changed", () => {
    context.current.state = {
      ...initialAppState,
      status: "ready",
      storage: createLocalStorageAdapter(localStorage),
      sessionState: { ...initialAppState.sessionState, pressureUnit: "kPa" }
    };
    context.current.patchSessionState = vi.fn(patch => {
      context.current.state = {
        ...context.current.state,
        sessionState: { ...context.current.state.sessionState, ...patch }
      };
    });
    render();
    expect(container.querySelector("#cases")?.textContent).toContain("5.3 kPa");
    click('[aria-label="Pressure units"] button:first-child');
    render();
    expect(context.current.state.sessionState.pressureUnit).toBe("mmHg");
    expect(container.querySelector("#cases")?.textContent).toContain("40 mmHg");
  });

  it("keeps the public navigation and FAQ usable without authentication", () => {
    render();
    expect(container.querySelector('nav[aria-label="On this page"]')).toBeNull();
    expect(container.querySelector('[aria-label="Settings"]')).toBeNull();
    expect(container.querySelector(".article-byline")?.textContent).toContain("Written by");
    expect(container.querySelector(".article-byline")?.textContent).toContain("Last updated:");
    expect(container.querySelector(".article-byline time")?.getAttribute("dateTime")).toBe("2026-09-18");
    expect(container.querySelector(".aa-guide__cta-link")?.getAttribute("href")).toBe("/practice");
    const faq = container.querySelector<HTMLButtonElement>(".aa-guide__faq-trigger")!;
    act(() => faq.click());
    expect(faq.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".aa-guide__faq-answer")?.textContent).toContain("Pure hypoventilation");
    act(() => faq.click());
    expect(faq.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".aa-guide__faq-answer")).toBeNull();
  });
});
