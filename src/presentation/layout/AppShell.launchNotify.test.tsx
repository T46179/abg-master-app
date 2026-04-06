// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retryPendingSubmissionNow = vi.fn();
const discardPendingSubmission = vi.fn();
const patchSessionState = vi.fn();
const trackEvent = vi.fn();
const trackPageView = vi.fn();

vi.mock("../../app/AppProvider", () => ({
  useAppContext: () => ({
    state: {
      practiceState: {
        syncState: "idle",
        syncMessage: null,
        lastCaseSummary: null,
        pendingSubmission: null
      },
      payload: {
        progressionConfig: null,
        dashboardState: null,
        defaultUserState: null,
        cases: []
      },
      userState: {},
      appStatus: {
        warnings: {},
        blocking: null
      }
    },
    patchSessionState,
    retryPendingSubmissionNow,
    discardPendingSubmission
  })
}));

vi.mock("../../core/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  trackPageView: (...args: unknown[]) => trackPageView(...args)
}));

import { AppShell } from "./AppShell";

describe("AppShell launch notify flow", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    patchSessionState.mockReset();
    retryPendingSubmissionNow.mockReset();
    discardPendingSubmission.mockReset();
    trackEvent.mockReset();
    trackPageView.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn());
    if (!window.requestAnimationFrame) {
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
      vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle));
    }
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderShell() {
    act(() => {
      root.render(
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      );
    });
  }

  function getButtons() {
    return Array.from(container.querySelectorAll("button"));
  }

  function getDesktopStayUpdatedButton() {
    return getButtons().find((button) => button.textContent?.includes("Stay Updated")) ?? null;
  }

  function getMobileStayUpdatedButton() {
    return getButtons().find((button) => button.getAttribute("aria-label") === "Stay Updated") ?? null;
  }

  function getSubmitButton() {
    return getButtons().find((button) => button.textContent?.includes("Notify Me") || button.textContent?.includes("Sending...")) ?? null;
  }

  function getLaunchNotifyForm() {
    return container.querySelector("form");
  }

  function setEmailInputValue(value: string) {
    const emailInput = container.querySelector<HTMLInputElement>("#launch-notify-email");
    expect(emailInput).toBeTruthy();

    if (!emailInput) return;

    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(emailInput, value);
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("opens the modal from both nav triggers", () => {
    renderShell();

    const desktopButton = getDesktopStayUpdatedButton();
    const mobileButton = getMobileStayUpdatedButton();

    expect(desktopButton).toBeTruthy();
    expect(mobileButton).toBeTruthy();

    act(() => {
      desktopButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Stay in the Loop");
    expect(container.querySelector(".launch-notify-modal__icon")).toBeNull();

    const closeButton = getButtons().find((button) => button.getAttribute("aria-label") === "Close stay updated modal");
    act(() => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      mobileButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Stay in the Loop");
  });

  it("rejects malformed emails without submitting and marks the input invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderShell();

    act(() => {
      getDesktopStayUpdatedButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      setEmailInputValue("test");
    });

    const emailInput = container.querySelector<HTMLInputElement>("#launch-notify-email");
    const submitButton = getSubmitButton();

    expect(emailInput?.className).not.toContain("is-invalid");
    expect(emailInput?.getAttribute("aria-invalid")).toBe("false");
    expect(submitButton?.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      getLaunchNotifyForm()?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(emailInput?.className).toContain("is-invalid");
    expect(emailInput?.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Enter a valid email address.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits only the email field and shows success feedback", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderShell();

    act(() => {
      getDesktopStayUpdatedButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      setEmailInputValue("user@example.com");
    });

    await act(async () => {
      getLaunchNotifyForm()?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://submit-form.com/8T8RZZaL6", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ email: "user@example.com" })
    });

    expect(getSubmitButton()?.textContent).toContain("Sending...");
    expect(getSubmitButton()?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      resolveFetch?.(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("We'll let you know when there are new updates to share.");
    expect(trackEvent).toHaveBeenCalledWith("launch_notify_submitted");
  });

  it("shows inline errors when the Formspark submit fails", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    renderShell();

    act(() => {
      getDesktopStayUpdatedButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      setEmailInputValue("user@example.com");
    });

    await act(async () => {
      getLaunchNotifyForm()?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("That didn't work. Please try again.");
  });

  it("closes the modal from the close button, backdrop click, and Escape", () => {
    renderShell();

    act(() => {
      getDesktopStayUpdatedButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Stay in the Loop");

    const closeButton = getButtons().find((button) => button.getAttribute("aria-label") === "Close stay updated modal");
    act(() => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("Stay in the Loop");

    act(() => {
      getDesktopStayUpdatedButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const backdrop = container.querySelector(".modal-backdrop");
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      backdrop?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("Stay in the Loop");

    act(() => {
      getDesktopStayUpdatedButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.textContent).not.toContain("Stay in the Loop");
  });

  it("does not close the modal when a pointer starts inside the modal and ends on the backdrop", () => {
    renderShell();

    act(() => {
      getDesktopStayUpdatedButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const emailInput = container.querySelector<HTMLInputElement>("#launch-notify-email");
    const backdrop = container.querySelector(".modal-backdrop");

    act(() => {
      emailInput?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      backdrop?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Stay in the Loop");
  });
});
