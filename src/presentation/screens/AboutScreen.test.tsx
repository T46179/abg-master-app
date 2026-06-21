// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutScreen } from "./AboutScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../shared/usePublicCasesSolvedCount", () => ({
  usePublicCasesSolvedCount: () => ({
    casesSolvedCount: 546,
    casesSolvedLoaded: true
  })
}));

describe("AboutScreen", () => {
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

  it("renders the public about layout without the educational disclaimer", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/about/"]}>
          <AboutScreen />
        </MemoryRouter>
      );
    });

    const link = container.querySelector<HTMLAnchorElement>(".about-page__back");
    const headings = Array.from(container.querySelectorAll("h1, h2")).map(heading => heading.textContent);

    expect(link?.getAttribute("href")).toBe("/dashboard");
    expect(link?.textContent).toContain("Explore ABG Master");
    expect(headings).toEqual([
      "AboutThe project & the person",
      "ABG MasterA focused learning companion",
      "Dr Thanh TruongEmergency doctor"
    ]);
    expect(container.querySelector(".about-page__portrait")?.getAttribute("role")).toBe("img");
    expect(container.querySelectorAll(".about-page__stat")).toHaveLength(3);
    expect(Array.from(container.querySelectorAll(".about-page__stat strong")).map(card => card.textContent)).toEqual(["546", "154", "4"]);
    expect(Array.from(container.querySelectorAll(".about-page__stat span")).map(card => card.textContent)).toEqual([
      "Cases completed", "Cases", "Guides"
    ]);
    expect(container.querySelectorAll(".about-page__facts dt")).toHaveLength(2);
    expect(container.querySelector(".about-page__footer")?.textContent).toContain("© 2026 ABG Master");
    expect(container.querySelector(".comp-rules-page__footer")).toBeNull();
  });
});
