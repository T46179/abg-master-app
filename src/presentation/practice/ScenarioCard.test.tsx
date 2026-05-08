// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScenarioCard } from "./ScenarioCard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ScenarioCard", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders authored case metadata only for authored cases", () => {
    act(() => {
      root.render(
        <ScenarioCard
          clinicalStem="A real-world teaching stem."
          caseItem={{ source_type: "authored" }}
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--authored")).not.toBeNull();
    expect(container.textContent).toContain("This case has been adapted from a real-life clinical scenario");

    act(() => {
      root.render(
        <ScenarioCard
          clinicalStem="A generated teaching stem."
          caseItem={{ source_type: "generated" }}
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--authored")).toBeNull();
  });
});
