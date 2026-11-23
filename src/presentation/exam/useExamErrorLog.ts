import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RuntimeCall } from "../../core/examRuntime";
import { errorLogClient } from "../../core/examErrorLog";
import type { ErrorLogState } from "./errorLogTypes";
import { examplesFor } from "./errorLogExamples";

const freshForMs = 60_000;

export function useExamErrorLog(call: RuntimeCall | undefined, accountKey: string, attemptId?: string) {
  const client = useMemo(() => call ? errorLogClient(call) : null, [call, accountKey]);
  const cache = useMemo(() => ({
    latest: undefined as ErrorLogState | undefined,
    updatedAt: -Infinity,
    attempts: new Map<string, { savedSources: ErrorLogState["savedSources"]; updatedAt: number }>(),
  }), [client]);
  const [, redraw] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const mutating = useRef(false);

  const accept = useCallback((data: ErrorLogState) => {
    if (!client) return;
    cache.updatedAt = Date.now();
    cache.latest = data;
    if (data.attemptId) cache.attempts.set(data.attemptId, { savedSources: data.savedSources, updatedAt: cache.updatedAt });
    examplesFor(client).reconcile(data.entries);
    setError("");
    redraw(value => value + 1);
  }, [cache, client]);

  const load = useCallback((force = true) => {
    if (!client || mutating.current) return Promise.resolve();
    if (pending.current) return pending.current;
    const updatedAt = attemptId ? cache.attempts.get(attemptId)?.updatedAt ?? -Infinity : cache.updatedAt;
    if (!force && Date.now() - updatedAt < freshForMs) return Promise.resolve();
    const request = ++version.current;
    setLoading(true);
    pending.current = Promise.resolve().then(async () => {
      if (version.current !== request) return;
      const data = await client.list(attemptId);
      if (version.current === request) accept(data);
    }).catch(() => {
      if (version.current === request) setError("We couldn't load your Error Log. Please try again.");
    }).finally(() => {
      if (version.current === request) { pending.current = null; setLoading(false); }
    });
    return pending.current;
  }, [client, cache, attemptId, accept]);
  const active = useRef<{ cache: typeof cache; load: typeof load } | null>(null);
  useEffect(() => {
    active.current = { cache, load };
    setError(""); setLoading(Boolean(pending.current)); setBusy(false); mutating.current = false;
    const focus = () => { void load(false); };
    focus();
    window.addEventListener("focus", focus);
    return () => {
      active.current = null;
      ++version.current;
      pending.current = null;
      if (client) examplesFor(client).cancelPending();
      window.removeEventListener("focus", focus);
    };
  }, [cache, client, load]);

  async function mutate(action: () => Promise<ErrorLogState>) {
    if (mutating.current) throw new Error("Another Error log action is still saving.");
    mutating.current = true; setBusy(true);
    pending.current = null;
    const request = ++version.current;
    try {
      const data = await action();
      if (version.current === request) {
        accept(data);
      } else if (active.current?.cache === cache) {
        // Navigation changed the requested attempt while the write was committing.
        cache.updatedAt = -Infinity;
        if (data.attemptId) cache.attempts.delete(data.attemptId);
        if (!mutating.current) {
          pending.current = null;
          void active.current.load();
        }
      }
    } finally {
      if (version.current === request) { mutating.current = false; setBusy(false); setLoading(false); }
    }
  }
  const selection = attemptId ? cache.attempts.get(attemptId) : undefined;
  const data = useMemo(() => cache.latest && ({
    ...cache.latest, attemptId: selection ? attemptId! : null, savedSources: selection?.savedSources ?? {},
  }), [cache.latest, attemptId, selection]);
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
