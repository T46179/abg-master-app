// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrivacyScreen } from "./PrivacyScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("PrivacyScreen", () => {
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

  it("renders the complete privacy notice in the SEO editorial layout", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/privacy"]}>
          <PrivacyScreen />
        </MemoryRouter>
      );
    });

    expect(container.querySelector(".comp-rules-page.privacy-page")).toBeTruthy();
    expect(container.textContent).toContain("Last updated 13 June 2026");
    expect(container.querySelector<HTMLAnchorElement>(".privacy-page__back")?.getAttribute("href")).toBe("/dashboard");

    [
      "Summary",
      "Information collected",
      "Teaching cases",
      "Information stored in your browser",
      "Services ABG Master uses",
      "How information is used",
      "Your choices",
      "Educational use only"
    ].forEach(section => expect(container.textContent).toContain(section));
  });
});
