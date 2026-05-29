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

  it("renders oxygenation metadata only for oxygenation-focused cases", () => {
    act(() => {
      root.render(
        <ScenarioCard
          clinicalStem="A true ABG teaching stem."
          caseItem={{ source_type: "generated", case_features: ["true_abg", "oxygenation_focus"] }}
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--oxygenation")).not.toBeNull();
    expect(container.textContent).toContain("This is an arterial blood gas, and requires oxygenation interpretation");

    act(() => {
      root.render(
        <ScenarioCard
          clinicalStem="A standard generated teaching stem."
          caseItem={{ source_type: "generated", case_features: ["true_abg"] }}
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--oxygenation")).toBeNull();
  });

  it("renders authored and oxygenation metadata together for authored oxygenation cases", () => {
    act(() => {
      root.render(
        <ScenarioCard
          clinicalStem="An authored true ABG teaching stem."
          caseItem={{ source_type: "authored", case_features: ["true_abg", "oxygenation_focus"] }}
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--authored")).not.toBeNull();
    expect(container.querySelector(".case-metadata-icon--oxygenation")).not.toBeNull();
  });

  it("renders boosted XP metadata only when bonus XP is active", () => {
    act(() => {
      root.render(
        <ScenarioCard
          clinicalStem="A boosted teaching stem."
          caseItem={{ source_type: "generated" }}
          boostedXp
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--boosted-xp")).not.toBeNull();
    expect(container.textContent).toContain("This case earns bonus XP");

    act(() => {
      root.render(
        <ScenarioCard
          clinicalStem="A regular teaching stem."
          caseItem={{ source_type: "generated" }}
        />
      );
    });

    expect(container.querySelector(".case-metadata-icon--boosted-xp")).toBeNull();
  });
});
