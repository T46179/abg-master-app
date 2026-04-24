// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeScreen } from "./PracticeScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./ProtectedPracticeScreen", () => ({
  ProtectedPracticeScreen: () => <div data-testid="protected-practice" />
}));

describe("PracticeScreen", () => {
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

  it("always renders protected practice", () => {
    act(() => {
      root.render(<PracticeScreen />);
    });

    expect(container.querySelector('[data-testid="protected-practice"]')).not.toBeNull();
  });
});
