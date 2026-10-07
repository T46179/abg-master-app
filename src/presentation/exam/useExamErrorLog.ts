import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RuntimeCall } from "../../core/examRuntime";
import { errorLogClient } from "../../core/examErrorLog";
import type { ErrorLogState } from "./errorLogTypes";

export function useExamErrorLog(call: RuntimeCall | undefined, accountKey: string, attemptId?: string) {
  const client = useMemo(() => call ? errorLogClient(call) : null, [call]);
  const [stored, setStored] = useState<{ key: string; data: ErrorLogState }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const mutating = useRef(false);
  const context = `${accountKey}:${attemptId ?? "room"}`;
  const current = useRef(context);
  current.current = context;
  const load = useCallback(async () => {
    if (!client || mutating.current) return;
    const request = ++version.current;
    setLoading(true);
    try {
      const data = await client.list(attemptId);
      if (current.current === context && version.current === request) { setStored({ key: accountKey, data }); setError(""); }
    } catch {
      if (current.current === context && version.current === request) setError("Couldn’t refresh your Error log. Please retry.");
    } finally {
      if (current.current === context && version.current === request) setLoading(false);
    }
  }, [client, accountKey, attemptId, context]);
  useEffect(() => {
    setError(""); setLoading(false); setBusy(false); mutating.current = false;
    void load();
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => { ++version.current; window.removeEventListener("focus", focus); };
  }, [load]);
  async function mutate(action: () => Promise<ErrorLogState>) {
    if (mutating.current) throw new Error("Another Error log action is still saving.");
    mutating.current = true; setBusy(true);
    const request = ++version.current;
    try {
      const data = await action();
      if (current.current === context && version.current === request) { setStored({ key: accountKey, data }); setError(""); }
    } finally {
      if (current.current === context && version.current === request) { mutating.current = false; setBusy(false); setLoading(false); }
    }
  }
  const data = stored?.key === accountKey ? stored.data : undefined;
  return { data, error, loading, busy, refresh: load, client,
    save: (partId: string, conceptIds: string[]) => {
      if (!client || !attemptId) return Promise.reject(new Error("Error log is unavailable. Please retry."));
      return mutate(() => client.save(attemptId, partId, conceptIds));
    },
    review: (conceptId: string, archive: boolean) => {
      if (!client) return Promise.reject(new Error("Error log is unavailable. Please retry."));
      return mutate(() => client.review(conceptId, archive));
    },
  };
}
