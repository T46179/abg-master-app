// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountWaiting } from "./AccountWaiting";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>; let host: HTMLDivElement;
beforeEach(() => { vi.useFakeTimers(); host = document.createElement("div"); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });
it("uses presentation thresholds, resets on retry and exposes actual failures separately", async () => {
  const retry = vi.fn();
  const render = (attempt: number, error?: string) => act(async () => root.render(<AccountWaiting attempt={attempt} error={error} retry={retry} />));
  await render(0); expect(host.textContent).toBe(""); expect(host.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(3000)); expect(host.textContent).toContain("Connecting");
  await act(async () => vi.advanceTimersByTimeAsync(12000)); expect(host.textContent).toContain("longer than usual");
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click()); expect(retry).toHaveBeenCalledOnce();
  await render(1); expect(host.textContent).toBe("");
  await act(async () => vi.advanceTimersByTimeAsync(2999)); expect(host.textContent).toBe("");
  await render(1, "Profile unavailable"); expect(host.textContent).toContain("Profile unavailable"); expect(host.querySelector("button")).not.toBeNull();
  expect(host.querySelector(".loading-chip__spinner")).toBeNull();
});
