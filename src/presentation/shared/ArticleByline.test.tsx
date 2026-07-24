// @vitest-environment jsdom

import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AbgInterpretationScreen } from "../screens/AbgInterpretationScreen";
import { AnionGapScreen } from "../screens/AnionGapScreen";
import { BloodGasCompensationRulesScreen } from "../screens/BloodGasCompensationRulesScreen";
import { DeltaRatioScreen } from "../screens/DeltaRatioScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ArticleByline", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    document.head.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    ["/blood-gas-compensation-rules/", BloodGasCompensationRulesScreen, "Published: May 2026", "2026-05-01"],
    ["/delta-ratio/", DeltaRatioScreen, "Published: May 2026", "2026-05-14"],
    ["/abg-interpretation/", AbgInterpretationScreen, "Last updated: May 2026", "2026-05-23"],
    ["/anion-gap/", AnionGapScreen, "Published: June 2026", "2026-06-19"]
  ] as Array<[string, ComponentType, string, string]>) (
    "renders accessible authorship in the article header for %s",
    (pathname, Screen, dateText, datetime) => {
      act(() => {
        root.render(
          <MemoryRouter initialEntries={[pathname]}>
            <Screen />
          </MemoryRouter>
        );
      });

      const header = container.querySelector<HTMLElement>(".comp-rules-page__header");
      const byline = header?.querySelector<HTMLElement>(".article-byline");
      const authorLink = byline?.querySelector<HTMLAnchorElement>('a[rel="author"]');
      const time = byline?.querySelector<HTMLTimeElement>("time");

      if (pathname === "/abg-interpretation/") {
        expect(header?.querySelector("h1")?.nextElementSibling).toBe(byline);
        expect(byline?.nextElementSibling?.tagName).toBe("P");
      } else {
        expect(header?.lastElementChild).toBe(byline);
      }
      expect(byline?.textContent).toContain("Written by Dr Thanh Truong, Emergency Medicine Registrar");
      expect(byline?.textContent).toContain(dateText);
      expect(authorLink?.getAttribute("href")).toBe("/about/");
      expect(time?.dateTime).toBe(datetime);
      expect(time?.textContent).toMatch(/^(May|June) 2026$/);
    }
  );
});
