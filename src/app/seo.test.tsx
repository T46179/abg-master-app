// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SeoMetadata } from "./seo";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SeoMetadata", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("sets anion gap metadata with the trailing-slash canonical URL", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/anion-gap/"]}>
          <SeoMetadata />
        </MemoryRouter>
      );
    });

    const description = "Learn how to calculate and interpret the anion gap, including normal ranges, albumin correction, high-gap acidosis, normal-gap acidosis, and key pitfalls.";
    const canonicalUrl = "https://www.abgmaster.com/anion-gap/";

    expect(document.title).toBe("Anion Gap Explained | ABG Master");
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(description);
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(canonicalUrl);
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe("Anion Gap Explained | ABG Master");
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content).toBe(description);
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(canonicalUrl);
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content).toBe("Anion Gap Explained | ABG Master");
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content).toBe(description);
  });
});
