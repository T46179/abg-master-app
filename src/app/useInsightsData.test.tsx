// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialAppState, type AppState } from "./state";
import { useInsightsData } from "./useInsightsData";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const fetchInsightsAttempts = vi.hoisted(() => vi.fn());
let currentState: AppState;

vi.mock("./AppProvider", () => ({
  useAppContext: () => ({ state: currentState })
}));

vi.mock("../core/insights", async importOriginal => ({
  ...await importOriginal<typeof import("../core/insights")>(),
  fetchInsightsAttempts
}));

function InsightsProbe() {
  const viewModel = useInsightsData();
  const messageKey = "messageKey" in viewModel ? viewModel.messageKey : "";

  return <div data-message-key={messageKey} data-state={viewModel.state} />;
}

describe("useInsightsData", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchInsightsAttempts.mockReset();
    currentState = {
      ...initialAppState,
      status: "ready",
      supabaseEnabled: true,
      supabase: null,
      userId: null,
      syncUnavailable: false
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderProbe() {
    await act(async () => {
      root.render(<InsightsProbe />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function renderedState() {
    return container.firstElementChild?.getAttribute("data-state");
  }

  function renderedMessageKey() {
    return container.firstElementChild?.getAttribute("data-message-key");
  }

  it("stays loading while the enabled Supabase client is initializing", async () => {
    await renderProbe();

    expect(renderedState()).toBe("loading");
    expect(fetchInsightsAttempts).not.toHaveBeenCalled();
  });

  it("fetches insights after the Supabase client and anonymous user hydrate", async () => {
    const supabase = {} as NonNullable<AppState["supabase"]>;
    fetchInsightsAttempts.mockResolvedValue({ attempts: [], totalAttemptCount: 0 });
    await renderProbe();

    currentState = {
      ...currentState,
      supabase,
      userId: "anonymous-user-id"
    };
    await renderProbe();

    expect(fetchInsightsAttempts).toHaveBeenCalledWith({
      supabase,
      userId: "anonymous-user-id",
      progressionConfig: null
    });
    expect(renderedState()).toBe("locked");
  });

  it("shows cloud unavailable after Supabase initialization fails", async () => {
    currentState = {
      ...currentState,
      supabase: {} as NonNullable<AppState["supabase"]>,
      syncUnavailable: true
    };

    await renderProbe();

    expect(renderedState()).toBe("unavailable");
    expect(renderedMessageKey()).toBe("insights.supabase_unavailable");
    expect(fetchInsightsAttempts).not.toHaveBeenCalled();
  });

  it("shows unauthenticated when the Supabase client exists without a user", async () => {
    currentState = {
      ...currentState,
      supabase: {} as NonNullable<AppState["supabase"]>
    };

    await renderProbe();

    expect(renderedState()).toBe("unauthenticated");
    expect(renderedMessageKey()).toBe("insights.unauthenticated");
    expect(fetchInsightsAttempts).not.toHaveBeenCalled();
  });

  it("shows cloud unavailable when Supabase is disabled", async () => {
    currentState = {
      ...currentState,
      supabaseEnabled: false
    };

    await renderProbe();

    expect(renderedState()).toBe("unavailable");
    expect(renderedMessageKey()).toBe("insights.supabase_unavailable");
  });
});
