import { getRuntimeAssetPath } from "./runtime";
import type { CaseData } from "./types";

export function isAuthoredCasePreviewEnabled(env = import.meta.env): boolean {
  return Boolean(env.DEV || env.VITE_ENABLE_AUTHORED_CASE_PREVIEW === "true");
}

export function normalizeDevHashRoute(location: Location = window.location, env = import.meta.env): boolean {
  if (!isAuthoredCasePreviewEnabled(env)) return false;
  const hashPath = location.hash.startsWith("#/") ? location.hash.slice(1) : "";
  if (!hashPath.startsWith("/case-preview/") && hashPath !== "/dev/authored-cases") return false;

  const nextUrl = new URL(location.href);
  nextUrl.pathname = `${import.meta.env.BASE_URL.replace(/\/$/, "")}${hashPath}`.replace(/\/{2,}/g, "/");
  nextUrl.hash = "";
  window.history.replaceState(null, "", nextUrl);
  return true;
}

export interface AuthoredCasePreviewPayload {
  cases: CaseData[];
  allCases: CaseData[];
}

export async function loadAuthoredCasePreviewPayload(fetchImpl: typeof fetch = fetch): Promise<AuthoredCasePreviewPayload> {
  const response = await fetchImpl(getRuntimeAssetPath("abg_cases.json"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load authored case preview payload: ${response.status}`);
  }

  const payload = await response.json();
  const allCases = Array.isArray(payload?.cases) ? payload.cases as CaseData[] : [];
  return {
    cases: allCases.filter(caseItem => caseItem.source_type === "authored"),
    allCases
  };
}

export function findApprovedAuthoredPreviewCase(cases: CaseData[], caseId: string): CaseData | null {
  const normalizedCaseId = String(caseId ?? "").trim();
  return cases.find(caseItem => caseItem.source_type === "authored" && caseItem.case_id === normalizedCaseId) ?? null;
}
