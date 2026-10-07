import type { RuntimeCall } from "./examRuntime";
import type { HistoryFilter, AttemptPresentation, HistoryPresentation } from "../presentation/exam/presentationTypes";

export type HistoryCursor = { finishedAt: string; id: string };
export interface HistoryRow {
  id: string; createdAt: string; presentedAt: string | null; finishedAt: string;
  examKind: "mock" | "custom"; excludedCategories: string[]; caseCount: number;
  marksAvailable: number; marksAwarded: number | null;
  gradingStatus: "completed" | "pending" | "failed"; canRetryGrading: boolean;
}
export interface HistoryPage {
  attempts: HistoryRow[]; nextCursor: HistoryCursor | null; total: number;
  latestAttemptId: string | null;
  counts: Record<HistoryFilter, number>;
  summary: { submitted: number; average: number | null; best: number | null; trend: number[]; totalCases: number; awaiting: number; pending: number };
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
const count = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const percent = (v: unknown) => v === null || (count(v) && (v as number) <= 100);
export function verifyHistoryPage(v: unknown): HistoryPage {
  if (!object(v) || !Array.isArray(v.attempts) || v.attempts.length > 20
    || v.attempts.some((r: any) => !object(r) || !uuid(r.id) || !date(r.createdAt) || !date(r.finishedAt)
      || (r.presentedAt !== null && !date(r.presentedAt)) || !["mock", "custom"].includes(r.examKind)
      || !Array.isArray(r.excludedCategories) || r.excludedCategories.some((id: unknown) => typeof id !== "string")
      || !count(r.caseCount) || r.caseCount < 1 || !count(r.marksAvailable) || r.marksAvailable < 1
      || !["completed", "pending", "failed"].includes(r.gradingStatus) || typeof r.canRetryGrading !== "boolean"
      || (r.gradingStatus === "completed" ? !count(r.marksAwarded) || r.marksAwarded > r.marksAvailable : r.marksAwarded !== null))
    || new Set(v.attempts.map((r: any) => r.id)).size !== v.attempts.length
    || !count(v.total) || v.total < v.attempts.length || !object(v.counts)
    || ![v.counts.all, v.counts.mock, v.counts.custom].every(count) || v.counts.all !== v.counts.mock + v.counts.custom
    || (v.latestAttemptId !== null && !uuid(v.latestAttemptId)) || (v.counts.all === 0) !== (v.latestAttemptId === null)
    || !object(v.summary) || ![v.summary.submitted, v.summary.totalCases, v.summary.awaiting, v.summary.pending].every(count)
    || v.summary.submitted !== v.counts.all || v.summary.awaiting > v.counts.all || v.summary.pending > v.summary.awaiting
    || !percent(v.summary.average) || !percent(v.summary.best) || !Array.isArray(v.summary.trend)
    || v.summary.trend.length > 10 || v.summary.trend.some((n: unknown) => n === null || !percent(n))
    || (v.nextCursor !== null && (!object(v.nextCursor) || !uuid(v.nextCursor.id) || !date(v.nextCursor.finishedAt)
      || !v.attempts.length || v.nextCursor.id !== v.attempts.at(-1).id || v.nextCursor.finishedAt !== v.attempts.at(-1).finishedAt))) {
    throw new Error("Couldn’t verify your exam history. Please retry.");
  }
  return v as HistoryPage;
}
export async function readHistoryPage(call: RuntimeCall, filter: HistoryFilter, cursor?: HistoryCursor) {
  const page = verifyHistoryPage(await call("history_page", { filter, ...(cursor ? { cursor } : {}) }));
  if (page.total !== page.counts[filter] || page.attempts.some(r => filter !== "all" && r.examKind !== filter)) throw new Error("History filter could not be verified.");
  return page;
}
export function historyPresentation(page: HistoryPage, rows: HistoryRow[], labels: Record<string, string>): HistoryPresentation {
  const attempts: AttemptPresentation[] = rows.map(r => {
    const start = r.presentedAt ? Date.parse(r.presentedAt) : NaN;
    const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((Date.parse(r.finishedAt) - start) / 1000)) : null;
    return { id: r.id, kind: r.examKind, finishedAt: r.finishedAt,
      date: new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(r.finishedAt)),
      time: new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date(r.finishedAt)),
      exclusions: r.excludedCategories.map(id => labels[id] ?? id), cases: r.caseCount,
      elapsed: seconds === null ? "—" : `${Math.floor(seconds / 60)}m ${seconds % 60}s`,
      awarded: r.marksAwarded, available: r.marksAvailable, status: r.gradingStatus, canRetryGrading: r.canRetryGrading };
  });
  return { attempts, counts: page.counts, ...page.summary };
}
