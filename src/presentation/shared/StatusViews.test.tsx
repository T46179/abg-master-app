// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppRouteErrorView } from "./StatusViews";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AppRouteErrorView", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    window.history.replaceState({}, "", "/practice?difficulty=master");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState({}, "", "/");
  });

  it("offers a generic full refresh of the current URL", () => {
    act(() => root.render(<AppRouteErrorView />));

    const refreshLink = container.querySelector<HTMLAnchorElement>("a.figma-button");
    expect(container.textContent).toContain("ABG Master needs a refresh");
    expect(container.textContent).toContain("Refresh ABG Master to continue.");
    expect(refreshLink?.href).toBe(window.location.href);
  });
});
