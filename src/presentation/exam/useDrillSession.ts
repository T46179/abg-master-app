import { useEffect, useRef, useState } from "react";
import type { DrillLoader, DrillRequest, DrillSet } from "../../core/examDrills";

export function useDrillSession(loadDrill?: DrillLoader) {
  const [session, setSession] = useState<{ id: number; request: DrillRequest; set: DrillSet } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function start(input: DrillRequest) {
    if (!loadDrill || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setBusy(true);
    try {
      const set = await loadDrill(input, controller.signal);
      if (!controller.signal.aborted) setSession(previous => ({ id: (previous?.id ?? 0) + 1, request: input, set }));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "We couldn’t generate this drill. Please try again.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
  }

  function close() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setError("");
    setSession(null);
  }
  return { session, busy, error, start, close, setError };
}
