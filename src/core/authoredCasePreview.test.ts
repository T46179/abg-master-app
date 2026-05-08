// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  normalizeDevHashRoute,
  findApprovedAuthoredPreviewCase,
  isAuthoredCasePreviewEnabled,
  loadAuthoredCasePreviewPayload
} from "./authoredCasePreview";
import type { CaseData } from "./types";

const authoredCase = {
  case_id: "AUTHORED_001",
  source_type: "authored",
  title: "Requested authored case"
} satisfies CaseData;

const otherAuthoredCase = {
  case_id: "AUTHORED_002",
  source_type: "authored",
  title: "Other authored case"
} satisfies CaseData;

describe("authored case preview helpers", () => {
  it("preserves authored source_type while filtering preview payload cases", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        cases: [
          authoredCase,
          { case_id: "GENERATED_001", title: "Generated case" }
        ]
      })
    })) as unknown as typeof fetch;

    const payload = await loadAuthoredCasePreviewPayload(fetchImpl);

    expect(payload.cases).toEqual([authoredCase]);
    expect(payload.allCases).toHaveLength(2);
    expect(payload.cases[0].source_type).toBe("authored");
  });

  it("selects the exact requested case_id for preview", () => {
    const selectedCase = findApprovedAuthoredPreviewCase([authoredCase, otherAuthoredCase], "AUTHORED_002");

    expect(selectedCase?.case_id).toBe("AUTHORED_002");
  });

  it("does not fall back to another authored case when the requested case_id is missing", () => {
    const selectedCase = findApprovedAuthoredPreviewCase([authoredCase], "MISSING_CASE");

    expect(selectedCase).toBeNull();
  });

  it("keeps preview routes disabled outside dev or explicit staging flag", () => {
    expect(isAuthoredCasePreviewEnabled({ DEV: false, VITE_ENABLE_AUTHORED_CASE_PREVIEW: "false" } as unknown as ImportMetaEnv)).toBe(false);
    expect(isAuthoredCasePreviewEnabled({ DEV: false, VITE_ENABLE_AUTHORED_CASE_PREVIEW: "true" } as unknown as ImportMetaEnv)).toBe(true);
  });

  it("normalizes hash preview routes into browser routes", () => {
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    const normalized = normalizeDevHashRoute(
      { href: "http://127.0.0.1:5173/#/case-preview/AUTHORED_001", hash: "#/case-preview/AUTHORED_001" } as Location,
      { DEV: true, BASE_URL: "/" } as unknown as ImportMetaEnv
    );

    expect(normalized).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, "", expect.objectContaining({
      pathname: "/case-preview/AUTHORED_001",
      hash: ""
    }));
    replaceState.mockRestore();
  });
});
