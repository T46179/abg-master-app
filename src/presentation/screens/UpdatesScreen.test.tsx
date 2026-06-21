// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PublicUpdate } from "../../app/publicPages";
import { getPublicUpdatesPage, UpdatesScreen } from "./UpdatesScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeUpdate(index: number, overrides: Partial<PublicUpdate> = {}): PublicUpdate {
  return {
    date: `2026-06-${String(index).padStart(2, "0")}`,
    category: "new",
    title: `Update ${index}`,
    summary: `Summary ${index}`,
    ...overrides
  };
}

describe("UpdatesScreen", () => {
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

  function render(updates: PublicUpdate[], path = "/updates/") {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <UpdatesScreen updates={updates} />
        </MemoryRouter>
      );
    });
  }

  it("sorts updates newest-first and normalises invalid pagination values", () => {
    const updates = [makeUpdate(1), makeUpdate(7), makeUpdate(3), makeUpdate(2), makeUpdate(4), makeUpdate(5)];

    expect(getPublicUpdatesPage(updates, "not-a-page").updates.map(update => update.title)).toEqual([
      "Update 7", "Update 5", "Update 4", "Update 3", "Update 2"
    ]);
    expect(getPublicUpdatesPage(updates, "3").currentPage).toBe(1);
    expect(getPublicUpdatesPage(updates, "2").updates.map(update => update.title)).toEqual(["Update 1"]);
  });

  it("renders one or five entries without pagination", () => {
    render([makeUpdate(1)]);
    expect(container.querySelectorAll(".updates-page__entry")).toHaveLength(1);
    expect(container.querySelector(".updates-page__pagination")).toBeNull();

    render(Array.from({ length: 5 }, (_, index) => makeUpdate(index + 1)));
    expect(container.querySelectorAll(".updates-page__entry")).toHaveLength(5);
    expect(container.querySelector(".updates-page__pagination")).toBeNull();
  });

  it("renders the requested page with accessible pagination", () => {
    render(Array.from({ length: 6 }, (_, index) => makeUpdate(index + 1)), "/updates/?page=2");

    expect(container.textContent).toContain("Update 1");
    expect(container.textContent).not.toContain("Update 6");
    expect(container.querySelectorAll("nav[aria-label^=\"Updates pages\"]")).toHaveLength(2);
    expect(container.querySelectorAll("[aria-current=\"page\"]")).toHaveLength(2);
    expect(container.querySelectorAll("[aria-disabled=\"true\"]")).toHaveLength(2);
    expect(container.querySelector(".updates-page__pagination--top")).not.toBeNull();
    expect(container.querySelector(".updates-page__pagination--bottom")).not.toBeNull();
  });

  it("renders optional content cleanly and protects long copy from overflow", () => {
    const longTitle = "A very long title ".repeat(24);
    const longSubtitle = "A very long subtitle ".repeat(24);
    render([
      makeUpdate(3, { title: longTitle, subtitle: longSubtitle, version: "v1.0", highlights: ["First highlight"] }),
      makeUpdate(2, { category: "fixed" })
    ]);

    const entries = container.querySelectorAll(".updates-page__entry");
    expect(entries[0].querySelector("h2")?.textContent).toContain(longTitle);
    expect(entries[0].querySelector("h2 span")?.textContent).toBe(longSubtitle);
    expect(entries[0].querySelector("ul li")?.textContent).toBe("First highlight");
    expect(entries[1].querySelector(".updates-page__meta span")).toBeNull();
    expect(entries[1].querySelector("h2 span")).toBeNull();
    expect(entries[1].querySelector("ul")).toBeNull();
    expect(entries[1].querySelector(".updates-page__category")?.textContent).toBe("Fixed");
  });

  it("renders an empty state without a timeline or pagination", () => {
    render([]);

    expect(container.textContent).toContain("No updates yet. Check back soon.");
    expect(container.querySelector(".updates-page__timeline")).toBeNull();
    expect(container.querySelector(".updates-page__pagination")).toBeNull();
  });
});
