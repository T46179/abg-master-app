import type { ErrorInfo } from "react";
import { describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => {
  const caughtErrorDelegate = vi.fn();

  return {
    caughtErrorDelegate,
    reactErrorHandler: vi.fn(() => caughtErrorDelegate)
  };
});

vi.mock("@sentry/react", () => ({
  reactErrorHandler: sentryMocks.reactErrorHandler
}));

import { handleCaughtReactError } from "./monitoring";

describe("React monitoring", () => {
  it("retains console evidence and forwards caught errors to Sentry", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("translated DOM changed");
    const errorInfo: ErrorInfo = { componentStack: "\n    at QuestionFlowCard" };

    handleCaughtReactError(error, errorInfo);

    expect(consoleError).toHaveBeenCalledWith(
      "React caught an error",
      error,
      errorInfo.componentStack
    );
    expect(sentryMocks.caughtErrorDelegate).toHaveBeenCalledWith(error, errorInfo);
    consoleError.mockRestore();
  });
});
