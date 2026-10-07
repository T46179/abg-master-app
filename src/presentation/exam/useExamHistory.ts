import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeCall } from "../../core/examRuntime";
import { readHistoryPage, type HistoryPage, type HistoryRow } from "../../core/examHistory";
import type { HistoryFilter } from "./presentationTypes";

type Loaded = { page: HistoryPage; rows: HistoryRow[]; pages: number };
export function useExamHistory(call: RuntimeCall | undefined, accountKey: string, enabled: boolean) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [cache, setCache] = useState<{ key: string; latestAttemptId?: string | null; filters: Partial<Record<HistoryFilter, Loaded>> }>({ key: accountKey, filters: {} });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const version = useRef(0);
  const inFlight = useRef<number | undefined>(undefined);
  const current = useRef({ accountKey, filter }); current.current = { accountKey, filter };
  const cacheRef = useRef(cache); cacheRef.current = cache;
  const loaded = cache.key === accountKey ? cache.filters[filter] : undefined;
  const latest = cache.key === accountKey ? cache.latestAttemptId : undefined;
  const refresh = useCallback(async (more = false) => {
    if (!call || inFlight.current !== undefined) return;
    const request = ++version.current; inFlight.current = request;
    setLoading(true);
    const previous = cacheRef.current.key === accountKey ? cacheRef.current.filters[filter] : undefined;
    try {
      let page: HistoryPage;
      let rows: HistoryRow[];
      let pages: number;
      if (more && previous?.page.nextCursor) {
        page = await readHistoryPage(call, filter, previous.page.nextCursor);
        if (page.attempts.some(r => previous.rows.some(p => p.id === r.id))) throw new Error("History changed; refresh before loading more.");
        rows = [...previous.rows, ...page.attempts]; pages = previous.pages + 1;
      } else {
        page = await readHistoryPage(call, filter); rows = [...page.attempts]; pages = 1;
        while (pages < (previous?.pages ?? 1) && page.nextCursor) {
          page = await readHistoryPage(call, filter, page.nextCursor); rows.push(...page.attempts); ++pages;
        }
      }
      if (version.current === request && current.current.accountKey === accountKey && current.current.filter === filter) {
        setCache(old => ({ key: accountKey, latestAttemptId: page.latestAttemptId, filters: { ...(old.key === accountKey ? old.filters : {}), [filter]: { page, rows, pages } } })); setError("");
      }
    } catch (cause) {
      if (version.current === request && current.current.accountKey === accountKey && current.current.filter === filter) setError(cause instanceof Error ? cause.message : "Couldn’t refresh your exams. Please retry.");
    } finally { if (inFlight.current === request) inFlight.current = undefined; if (version.current === request && current.current.accountKey === accountKey && current.current.filter === filter) setLoading(false); }
  }, [call, accountKey, filter]);
  useEffect(() => { setFilter("all"); setError(""); setLoading(false); ++version.current; inFlight.current = undefined; }, [accountKey]);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const focus = () => void refresh(); window.addEventListener("focus", focus);
    return () => { ++version.current; inFlight.current = undefined; window.removeEventListener("focus", focus); };
  }, [refresh, enabled]);
  const pending = loaded?.page.summary.pending ?? 0;
  useEffect(() => {
    if (!enabled || !pending) return;
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [enabled, pending, refresh]);
  return { filter, setFilter, data: loaded, latestAttemptId: latest, error, loading, refresh: () => refresh(), loadMore: () => refresh(true) };
}
