// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseData } from "../../core/types";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const loadAuthoredCasePreviewPayload = vi.hoisted(() => vi.fn());
const buildStepOptionOverrides = vi.hoisted(() => vi.fn((_caseItem: unknown, _cases: unknown[]) => ({})));
const renderOrder: string[] = [];
let latestQuestionFlowCardProps: Record<string, unknown> | null = null;
let latestValuePanelsProps: Record<string, unknown> | null = null;
let latestResultsSummaryCardProps: Record<string, unknown> | null = null;

vi.mock("../../core/authoredCasePreview", async importOriginal => {
  const actual = await importOriginal<typeof import("../../core/authoredCasePreview")>();
  return {
    ...actual,
    isAuthoredCasePreviewEnabled: () => true,
    loadAuthoredCasePreviewPayload: () => loadAuthoredCasePreviewPayload()
  };
});

vi.mock("../../core/selection", async importOriginal => {
  const actual = await importOriginal<typeof import("../../core/selection")>();
  return {
    ...actual,
    buildStepOptionOverrides: (caseItem: unknown, cases: unknown[]) => buildStepOptionOverrides(caseItem, cases)
  };
});

vi.mock("../practice/QuestionFlowCard", () => ({
  QuestionFlowCard: (props: Record<string, unknown>) => {
    latestQuestionFlowCardProps = props;
    renderOrder.push("questions");
    return <div data-testid="questions" />;
  }
}));

vi.mock("../practice/ScenarioCard", () => ({
  ScenarioCard: () => {
    renderOrder.push("scenario");
    return <div data-testid="scenario" />;
  }
}));

vi.mock("../practice/ValuePanels", () => ({
  ValuePanels: (props: Record<string, unknown>) => {
    latestValuePanelsProps = props;
    renderOrder.push("values");
    return <div data-testid="values" />;
  }
}));

vi.mock("../practice/ResultsSummaryCard", () => ({
  ResultsSummaryCard: (props: Record<string, unknown>) => {
    latestResultsSummaryCardProps = props;
    return null;
  },
  ResultsSummaryHeader: () => null
}));

import { CasePreviewScreen } from "./CasePreviewScreen";

function makeCase(caseId: string, overrides: Partial<CaseData> = {}): CaseData {
  return {
    case_id: caseId,
    source_type: "authored",
    clinical_stem: `${caseId} stem`,
    difficulty_level: 4,
    inputs: {
      gas: { ph: 7.2, paco2_mmHg: 22, hco3_mmolL: 12 },
      electrolytes: { na_mmolL: 132, cl_mmolL: 95 }
    },
    questions_flow: [
      { key: "ph_status", options: ["Acidaemia", "Alkalaemia", "Normal"] },
      { key: "final_diagnosis", options: ["raw correct", "raw distractor"] }
    ],
    answer_key: {
      ph_status: "Acidaemia",
      final_diagnosis: "raw correct"
    },
    ...overrides
  };
}

describe("CasePreviewScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderOrder.length = 0;
    latestQuestionFlowCardProps = null;
    latestValuePanelsProps = null;
    latestResultsSummaryCardProps = null;
    loadAuthoredCasePreviewPayload.mockReset();
    buildStepOptionOverrides.mockReset();
    buildStepOptionOverrides.mockReturnValue({});
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderPreview(caseId: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/case-preview/${caseId}`]}>
          <Routes>
            <Route path="/case-preview/:caseId" element={<CasePreviewScreen />} />
          </Routes>
        </MemoryRouter>
      );
    });
    await act(async () => {});
  }

  it("selects the exact requested authored case", async () => {
    const requestedCase = makeCase("AUTHORED_REQUESTED");
    loadAuthoredCasePreviewPayload.mockResolvedValue({
      cases: [makeCase("AUTHORED_OTHER"), requestedCase]
    });

    await renderPreview("AUTHORED_REQUESTED");

    expect(latestValuePanelsProps?.caseItem).toMatchObject({ case_id: "AUTHORED_REQUESTED" });
    expect(latestQuestionFlowCardProps?.caseItem).toMatchObject({ case_id: "AUTHORED_REQUESTED" });
  });

  it("uses the normal practice active-case ordering", async () => {
    loadAuthoredCasePreviewPayload.mockResolvedValue({ cases: [makeCase("AUTHORED_001")] });

    await renderPreview("AUTHORED_001");

    expect(renderOrder).toEqual(["scenario", "values", "questions"]);
  });

  it("uses prepared option overrides for the current step", async () => {
    buildStepOptionOverrides.mockReturnValue({ 0: ["shuffled", "options"] });
    loadAuthoredCasePreviewPayload.mockResolvedValue({ cases: [makeCase("AUTHORED_001")] });

    await renderPreview("AUTHORED_001");

    expect(latestQuestionFlowCardProps?.currentOptions).toEqual(["shuffled", "options"]);
  });

  it("delivers authored compensation analysis to the preview result summary", async () => {
    const compensation = {
      targetAnalyte: "paco2" as const,
      measuredValue: 22,
      unit: "mmHg" as const,
      comparisonBands: [
        { id: "expected", role: "expected" as const, labelKey: "expected_range", low: 24, high: 28 }
      ],
      comparisons: [{ bandId: "expected", relationship: "below" as const }],
      interpretationKey: "below_expected_range"
    };
    loadAuthoredCasePreviewPayload.mockResolvedValue({
      cases: [makeCase("AUTHORED_001", { analysis: { compensation } })]
    });

    await renderPreview("AUTHORED_001");

    await act(async () => {
      (latestQuestionFlowCardProps?.onAnswer as (option: string) => void)("Acidaemia");
    });
    await act(async () => {
      (latestQuestionFlowCardProps?.onContinueStep as () => void)();
    });
    await act(async () => {
      (latestQuestionFlowCardProps?.onAnswer as (option: string) => void)("raw correct");
    });

    expect((latestResultsSummaryCardProps?.summary as { analysis?: unknown }).analysis).toEqual({ compensation });
  });
});
