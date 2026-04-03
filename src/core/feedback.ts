import type { CaseSummary } from "./types";

const FEEDBACK_FORM_BASE_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScrfFqV6EwEDzIWkYcfFrUw4L-zjmwj0aIDg2bwNPwMYBTz6Q/viewform";

export function getCaseFeedbackFormUrl(summary: CaseSummary | null): string | null {
  const caseItem = summary?.caseData;
  const gas = caseItem?.inputs?.gas;
  const caseId = caseItem?.case_id;

  if (!caseId || gas?.ph == null || gas?.paco2_mmHg == null || gas?.hco3_mmolL == null) {
    return null;
  }

  const valuesSummary = `pH ${gas.ph} / PaCO2 ${gas.paco2_mmHg} / HCO3 ${gas.hco3_mmolL}`;
  const params = new URLSearchParams({
    usp: "pp_url",
    "entry.2070020822": caseId,
    "entry.134622764": valuesSummary
  });

  return `${FEEDBACK_FORM_BASE_URL}?${params.toString()}`;
}

export function openCaseFeedbackForm(summary: CaseSummary | null): boolean {
  const url = getCaseFeedbackFormUrl(summary);
  if (!url) return false;

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

