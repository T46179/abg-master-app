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

  it.each([
    {
      pathname: "/blood-gas-compensation-rules",
      title: "Blood Gas Compensation Rules Explained | ABG Master",
      description: "Learn the blood gas compensation rules used by ABG Master, including Winter's formula, metabolic alkalosis compensation, and acute and chronic respiratory compensation.",
      canonicalUrl: "https://www.abgmaster.com/blood-gas-compensation-rules/"
    },
    {
      pathname: "/delta-ratio/",
      title: "Delta Ratio Explained | ABG Master",
      description: "Learn how to calculate and interpret the delta ratio in high anion gap metabolic acidosis, with worked examples for detecting mixed metabolic disorders.",
      canonicalUrl: "https://www.abgmaster.com/delta-ratio/"
    },
    {
      pathname: "/abg-interpretation",
      title: "ABG Interpretation | Step-by-Step Guide to Blood Gas Analysis",
      description: "Learn how to interpret an ABG step by step, including oxygenation, pH, primary acid-base process, compensation, anion gap, mixed disorders, and ABG vs VBG differences.",
      canonicalUrl: "https://www.abgmaster.com/abg-interpretation/"
    },
    {
      pathname: "/anion-gap/",
      title: "Anion Gap Explained | ABG Master",
      description: "Learn how to calculate and interpret the anion gap, including normal ranges, albumin correction, high-gap acidosis, normal-gap acidosis, and key pitfalls.",
      canonicalUrl: "https://www.abgmaster.com/anion-gap/"
    }
  ])("preserves indexed SEO metadata for $pathname", ({ pathname, title, description, canonicalUrl }) => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[pathname]}>
          <SeoMetadata />
        </MemoryRouter>
      );
    });

    expect(document.title).toBe(title);
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(description);
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(canonicalUrl);
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe(title);
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content).toBe(description);
    expect(document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(canonicalUrl);
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content).toBe(title);
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content).toBe(description);
  });

  it.each([
    ["/about", "About ABG Master | Blood Gas Learning", "https://www.abgmaster.com/about/"],
    ["/about/", "About ABG Master | Blood Gas Learning", "https://www.abgmaster.com/about/"],
    ["/resources", "Blood Gas Interpretation Resources | ABG Master", "https://www.abgmaster.com/resources/"],
    ["/resources/", "Blood Gas Interpretation Resources | ABG Master", "https://www.abgmaster.com/resources/"],
    ["/updates", "ABG Master Updates | Product Changelog", "https://www.abgmaster.com/updates/"],
    ["/updates/", "ABG Master Updates | Product Changelog", "https://www.abgmaster.com/updates/"]
  ])("sets the trailing-slash canonical for %s", (pathname, title, canonicalUrl) => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[pathname]}>
          <SeoMetadata />
        </MemoryRouter>
      );
    });

    expect(document.title).toBe(title);
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(canonicalUrl);
  });
});
