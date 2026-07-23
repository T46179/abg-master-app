// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsFeaturedCaseCta } from "./ResultsFeaturedCaseCta";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const trackEvent = vi.hoisted(() => vi.fn());
const featuredState = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  releaseId: "featured-authored-004-r4"
}));

vi.mock("../../core/analytics", () => ({
  trackEvent
}));

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      userState: {
        level: 2,
        casesCompleted: 3
      },
      userId: featuredState.userId
    }
  })
}));

vi.mock("../../app/useFeaturedCaseStatus", () => ({
  useFeaturedCaseStatus: () => ({
    loading: false,
    status: {
      state: "available",
      releaseId: featuredState.releaseId,
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
    featuredState.userId = "user-1";
    featuredState.releaseId = "featured-authored-004-r4";
    window.localStorage.clear();
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
        release_id: "featured-authored-004-r4",
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
        release_id: "featured-authored-004-r4",
        entry_source: "results_summary",
        action: "start"
      })
    );
  });

  it("keeps a dismissed release hidden after the invitation remounts", () => {
    const renderInvitation = () => {
      root.render(
        <MemoryRouter>
          <ResultsFeaturedCaseCta />
        </MemoryRouter>
      );
    };

    act(renderInvitation);
    const dismissButton = container.querySelector<HTMLButtonElement>(
      "[aria-label='Dismiss Featured Case invitation']"
    );
    act(() => dismissButton?.click());
    expect(container.querySelector("[aria-label='Featured Case invitation']")).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(renderInvitation);
    expect(container.querySelector("[aria-label='Featured Case invitation']")).toBeNull();
  });

  it("shows a genuinely new release and overwrites the prior dismissal", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ResultsFeaturedCaseCta />
        </MemoryRouter>
      );
    });
    act(() => container.querySelector<HTMLButtonElement>(
      "[aria-label='Dismiss Featured Case invitation']"
    )?.click());

    featuredState.releaseId = "featured-authored-005-r1";
    act(() => {
      root.render(
        <MemoryRouter>
          <ResultsFeaturedCaseCta />
        </MemoryRouter>
      );
    });
    expect(container.querySelector("[aria-label='Featured Case invitation']")).not.toBeNull();

    act(() => container.querySelector<HTMLButtonElement>(
      "[aria-label='Dismiss Featured Case invitation']"
    )?.click());
    expect(window.localStorage).toHaveLength(1);
    expect(JSON.parse(
      window.localStorage.getItem("abgmaster_featuredCaseInvitationDismissal") ?? "null"
    )).toMatchObject({
      userId: "user-1",
      releaseId: "featured-authored-005-r1"
    });
  });

  it("does not apply one account's dismissal to another account", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ResultsFeaturedCaseCta />
        </MemoryRouter>
      );
    });
    act(() => container.querySelector<HTMLButtonElement>(
      "[aria-label='Dismiss Featured Case invitation']"
    )?.click());

    featuredState.userId = "user-2";
    act(() => {
      root.render(
        <MemoryRouter>
          <ResultsFeaturedCaseCta />
        </MemoryRouter>
      );
    });
    expect(container.querySelector("[aria-label='Featured Case invitation']")).not.toBeNull();
  });
});
