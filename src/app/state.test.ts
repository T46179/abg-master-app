import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "./state";

describe("app session preferences", () => {
  it("preserves the pressure unit across partial case and practice resets", () => {
    const withKPa = {
      ...initialAppState,
      sessionState: {
        ...initialAppState.sessionState,
        pressureUnit: "kPa" as const,
        currentStepIndex: 4,
        caseStartMs: 1234
      }
    };

    const afterNewCase = appReducer(withKPa, {
      type: "session_state_patched",
      patch: {
        currentStepIndex: 0,
        selectedAnswers: [],
        stepResults: [],
        stepOptionOverrides: {},
        caseStartMs: null
      }
    });
    const afterSummaryNavigation = appReducer(afterNewCase, {
      type: "practice_state_patched",
      patch: {
        currentCase: null,
        lastCaseSummary: null
      }
    });

    expect(afterNewCase.sessionState.pressureUnit).toBe("kPa");
    expect(afterSummaryNavigation.sessionState.pressureUnit).toBe("kPa");
  });
});
