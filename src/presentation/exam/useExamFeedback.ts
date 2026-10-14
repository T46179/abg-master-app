import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeCall } from "../../core/examRuntime";
import { feedbackOperation, type SavedFeedbackState } from "../../core/examFeedback";

export function useExamFeedback(call: RuntimeCall | undefined, accountKey: string, attemptId?: string) {
  const context = JSON.stringify([accountKey, attemptId]);
  const current = useRef(context); current.current = context;
  const version = useRef(0), mutating = useRef(false);
  const [stored, setStored] = useState<{ context: string; data: SavedFeedbackState }>();
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [votingPart, setVotingPart] = useState<string>();
  const [error, setError] = useState(""), [now, setNow] = useState(Date.now);
  const data = stored?.context === context ? stored.data : undefined;
  const refresh = useCallback(async () => {
    if (!call || !attemptId || mutating.current) return;
    const request = ++version.current;
    setLoading(true);
    try {
      const next = await feedbackOperation(call, "feedback_read", attemptId);
      if (current.current === context && version.current === request) { setStored({ context, data: next }); setError(""); }
    } catch {
      if (current.current === context && version.current === request) setError("Couldn’t refresh feedback. Please try again.");
    } finally {
      if (current.current === context && version.current === request) setLoading(false);
    }
  }, [call, attemptId, context]);
  useEffect(() => {
    ++version.current; mutating.current = false; setLoading(false); setBusy(false); setVotingPart(undefined); setError("");
    void refresh();
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => { ++version.current; window.removeEventListener("focus", focus); };
  }, [refresh]);
  useEffect(() => {
    if (data?.status !== "pending") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (document.visibilityState !== "hidden") await refresh();
      if (!cancelled) timer = setTimeout(poll, 2000);
    }
    timer = setTimeout(poll, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [data?.status, refresh]);
  useEffect(() => {
    setNow(Date.now());
    if (!data?.retryAfter || Date.parse(data.retryAfter) <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data?.retryAfter]);
  const retrySeconds = data?.retryAfter ? Math.max(0, Math.ceil((Date.parse(data.retryAfter) - now) / 1000)) : 0;
  async function mutate(operation: string, extra: Record<string, unknown> = {}) {
    if (!call || !attemptId || mutating.current) return;
    mutating.current = true; const request = ++version.current;
    if (operation === "feedback_vote") setVotingPart(extra.partId as string); else setBusy(true);
    setLoading(false); setError("");
    try {
      const next = await feedbackOperation(call, operation, attemptId, extra);
      if (current.current === context && version.current === request) setStored({ context, data: next });
    } catch {
      if (current.current === context && version.current === request) setError(operation === "feedback_vote"
        ? "Couldn’t save your response. Please try again." : "Couldn’t get feedback. Please try again.");
    } finally {
      if (current.current === context && version.current === request) {
        mutating.current = false; setBusy(false); setVotingPart(undefined);
      }
    }
  }
  return { data, loading, busy, votingPart, error, retrySeconds, refresh,
    request: () => data?.status === "completed" || data?.status === "pending" ? Promise.resolve() : mutate("feedback_request"),
    retry: () => data?.status === "failed" && data.canRetry && retrySeconds === 0 ? mutate("feedback_retry") : Promise.resolve(),
    vote: (partId: string, helpful: boolean) => data?.status === "completed" && data.generationId
      ? mutate("feedback_vote", { generationId: data.generationId, partId, helpful }) : Promise.resolve(),
  };
}
export type ExamFeedbackControls = ReturnType<typeof useExamFeedback>;
