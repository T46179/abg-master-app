import { useEffect, useState } from "react";
import { useAppContext } from "../../app/AppProvider";

const DEFAULT_CASES_SOLVED_COUNT = 0;
const CASES_SOLVED_METRIC_KEY = "cases_solved";

export function usePublicCasesSolvedCount() {
  const { state } = useAppContext();
  const [casesSolvedCount, setCasesSolvedCount] = useState(DEFAULT_CASES_SOLVED_COUNT);
  const [casesSolvedLoaded, setCasesSolvedLoaded] = useState(false);

  useEffect(() => {
    if (state.status !== "ready") return;

    if (!state.supabaseEnabled || !state.supabase) {
      setCasesSolvedLoaded(true);
      return;
    }

    const activeSupabase = state.supabase;
    let cancelled = false;

    async function loadCasesSolvedCount() {
      const { data, error } = await activeSupabase
        .from("public_site_metrics")
        .select("metric_value")
        .eq("metric_key", CASES_SOLVED_METRIC_KEY)
        .maybeSingle();

      if (cancelled) return;

      const metricCount = Number(data?.metric_value);
      if (!error && Number.isFinite(metricCount) && metricCount >= 0) {
        setCasesSolvedCount(metricCount);
        setCasesSolvedLoaded(true);
        return;
      }

      const { count, error: attemptsCountError } = await activeSupabase
        .from("attempts")
        .select("*", { count: "exact", head: true })
        .eq("mode", "practice");

      if (cancelled || attemptsCountError) {
        setCasesSolvedLoaded(true);
        return;
      }

      if (typeof count === "number" && count >= 0) {
        setCasesSolvedCount(count);
      }

      setCasesSolvedLoaded(true);
    }

    void loadCasesSolvedCount();

    return () => {
      cancelled = true;
    };
  }, [state.status, state.supabase, state.supabaseEnabled]);

  return { casesSolvedCount, casesSolvedLoaded };
}
