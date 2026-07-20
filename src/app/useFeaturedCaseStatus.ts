import { useCallback, useEffect, useState } from "react";
import { loadFeaturedCaseStatus } from "../core/featuredCase";
import type { FeaturedCaseStatus } from "../core/types";
import { useAppContext } from "./AppProvider";

const unavailableStatus: FeaturedCaseStatus = {
  releaseId: null,
  state: "unavailable",
  ctaEligible: false,
  opened: false
};

export function useFeaturedCaseStatus() {
  const { state } = useAppContext();
  const [status, setStatus] = useState<FeaturedCaseStatus>(unavailableStatus);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (
      state.status !== "ready" ||
      !state.payload?.featuredRelease?.releaseId ||
      !state.runtimeConfig ||
      !state.supabase
    ) {
      setStatus(unavailableStatus);
      setLoading(false);
      return unavailableStatus;
    }

    setLoading(true);
    try {
      const next = await loadFeaturedCaseStatus(state.runtimeConfig, state.supabase);
      setStatus(next);
      return next;
    } catch {
      setStatus(unavailableStatus);
      return unavailableStatus;
    } finally {
      setLoading(false);
    }
  }, [
    state.payload?.featuredRelease?.releaseId,
    state.runtimeConfig,
    state.status,
    state.supabase,
    state.userId
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh, state.userState.casesCompleted, state.userState.resetAt]);

  return { status, loading, refresh };
}
