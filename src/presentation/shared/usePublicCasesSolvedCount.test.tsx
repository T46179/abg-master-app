// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePublicCasesSolvedCount } from "./usePublicCasesSolvedCount";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../../core/publicSiteMetrics", () => ({ loadPublicCasesSolvedCount: load }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;
function Counter() {
  const { casesSolvedCount, casesSolvedLoaded } = usePublicCasesSolvedCount();
  return <span>{casesSolvedLoaded ? casesSolvedCount : "loading"}</span>;
}
afterEach(() => { act(() => root.unmount()); load.mockReset(); });

describe("public counter without an account provider", () => {
  it("loads on first mount and handles StrictMode effect replay", async () => {
    const requests: { signal: AbortSignal; resolve: (count: number) => void }[] = [];
    load.mockImplementation((signal: AbortSignal) => new Promise<number>(resolve => requests.push({ signal, resolve })));
    root = createRoot(container);
    act(() => root.render(<StrictMode><Counter /></StrictMode>));
    expect(container.textContent).toBe("loading");
    expect(requests[0].signal.aborted).toBe(true);
    await act(async () => { requests[1].resolve(1085); });
    expect(container.textContent).toBe("1085");
    await act(async () => { requests[0].resolve(1); });
    expect(container.textContent).toBe("1085");
  });

  it.each([null, 0])("keeps missing data distinct from a genuine zero (%s)", async count => {
    load.mockResolvedValue(count);
    root = createRoot(container);
    await act(async () => root.render(<Counter />));
    expect(container.textContent).toBe(count === null ? "loading" : "0");
  });

  it("handles a rejected request without a fabricated count", async () => {
    load.mockRejectedValue(new Error("offline"));
    root = createRoot(container);
    await act(async () => root.render(<Counter />));
    expect(container.textContent).toBe("loading");
  });
});
