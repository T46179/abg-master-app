// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsFeaturedCaseCta } from "./ResultsFeaturedCaseCta";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const trackEvent = vi.hoisted(() => vi.fn());

vi.mock("../../core/analytics", () => ({
  trackEvent
}));

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      userState: {
        level: 2,
        casesCompleted: 3
      }
    }
  })
}));

vi.mock("../../app/useFeaturedCaseStatus", () => ({
  useFeaturedCaseStatus: () => ({
    loading: false,
    status: {
      state: "available",
      releaseId: "featured-authored-004-r1",
      ctaEligible: true,
      opened: false
    }
  })
}));

describe("ResultsFeaturedCaseCta", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    trackEvent.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("tracks a visible results entry and its attributed click", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ResultsFeaturedCaseCta />
        </MemoryRouter>
      );
    });

    const link = container.querySelector<HTMLAnchorElement>("a");
    expect(link?.getAttribute("href"))
      .toBe("/featured-case?source=results_summary&action=start");
    expect(trackEvent).toHaveBeenCalledWith(
      "featured_case_entry_viewed",
      expect.objectContaining({
        release_id: "featured-authored-004-r1",
        entry_source: "results_summary",
        action: "start",
        learner_level: 2,
        normal_cases_completed: 3,
        is_replay: false
      })
    );

    act(() => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trackEvent).toHaveBeenCalledWith(
      "featured_case_entry_clicked",
      expect.objectContaining({
        release_id: "featured-authored-004-r1",
        entry_source: "results_summary",
        action: "start"
      })
    );
  });
});
