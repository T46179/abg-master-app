// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublicPageShell } from "./PublicPageShell";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("PublicPageShell", () => {
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

  it("does not add the educational disclaimer by default", () => {
    act(() => {
      root.render(<PublicPageShell><h1>About</h1></PublicPageShell>);
    });

    expect(container.querySelector(".comp-rules-page__footer")).toBeNull();
  });

  it("renders the educational disclaimer only when requested", () => {
    act(() => {
      root.render(<PublicPageShell showEducationalDisclaimer><h1>Resources</h1></PublicPageShell>);
    });

    expect(container.querySelector(".comp-rules-page__footer")?.textContent).toContain("Educational tool");
  });
});
