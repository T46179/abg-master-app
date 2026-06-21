// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResourcesScreen } from "./ResourcesScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ResourcesScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the Figma resource library content and current public destinations", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ResourcesScreen />
        </MemoryRouter>
      );
    });

    expect(container.querySelector("h1")?.textContent).toBe("ResourcesLibrary");
    expect(container.textContent).toContain("The full collection of ABG Master concept guides and references");

    const cards = Array.from(container.querySelectorAll<HTMLAnchorElement>(".resources-page__card"));

    expect(cards.map(card => card.getAttribute("href"))).toEqual([
      "/abg-interpretation/",
      "/anion-gap/",
      "/delta-ratio/",
      "/blood-gas-compensation-rules/"
    ]);
    expect(cards.map(card => card.querySelector(".resources-page__card-topline > span")?.textContent)).toEqual([
      "Core guide",
      "Concept guide",
      "Concept guide",
      "Reference"
    ]);
    expect(cards.map(card => card.querySelector("h2")?.textContent)).toEqual([
      "ABG InterpretationStep-by-step",
      "Anion GapExplained",
      "Delta RatioWhen the gap doesn't add up",
      "Compensation RulesExpected, not assumed"
    ]);
    expect(cards.map(card => card.querySelector("p")?.textContent)).toEqual([
      "A structured walkthrough for reading any arterial blood gas — from pH to compensation, in the order it actually matters.",
      "One of the quickest ways to make sense of a low bicarbonate — and to decide what's actually replacing it.",
      "The follow-up question to the anion gap. Use it to uncover a second, hidden acid–base disorder lurking beneath the obvious one.",
      "The formulas worth memorising, and the reasoning behind them — so you can tell adequate compensation from a mixed picture."
    ]);
    expect(container.querySelectorAll(".resources-page__card-icon[aria-hidden=\"true\"]")).toHaveLength(4);
    expect(container.querySelector(".comp-rules-page__footer")).toBeNull();
  });
});
