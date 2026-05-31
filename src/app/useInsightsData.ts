import { useEffect, useState } from "react";
import { useAppContext } from "./AppProvider";
import {
  buildInsightsViewModel,
  createInsightsLoadingViewModel,
  createInsightsUnauthenticatedViewModel,
  createInsightsUnavailableViewModel,
  fetchInsightsAttempts,
  type InsightsViewModel
} from "../core/insights";

export function useInsightsData(): InsightsViewModel {
  const { state } = useAppContext();
  const [viewModel, setViewModel] = useState<InsightsViewModel>(() => createInsightsLoadingViewModel());

  useEffect(() => {
    let cancelled = false;

    if (state.status !== "ready") {
      setViewModel(createInsightsLoadingViewModel());
      return () => {
        cancelled = true;
      };
    }

    if (!state.userId) {
      setViewModel(createInsightsUnauthenticatedViewModel());
      return () => {
        cancelled = true;
      };
    }

    if (!state.supabase || !state.supabaseEnabled) {
      setViewModel(createInsightsUnavailableViewModel("insights.supabase_unavailable"));
      return () => {
        cancelled = true;
      };
    }

    setViewModel(createInsightsLoadingViewModel());

    void fetchInsightsAttempts({
      supabase: state.supabase,
      userId: state.userId,
      progressionConfig: state.payload?.progressionConfig ?? null
    })
      .then(result => {
        if (cancelled) return;
        setViewModel(buildInsightsViewModel({
          attempts: result.attempts,
          totalAttemptCount: result.totalAttemptCount,
          userState: state.userState,
          progressionConfig: state.payload?.progressionConfig ?? null,
          availableCases: state.payload?.cases ?? []
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setViewModel(createInsightsUnavailableViewModel());
      });

    return () => {
      cancelled = true;
    };
  }, [
    state.payload,
    state.status,
    state.supabase,
    state.supabaseEnabled,
    state.userId,
    state.userState
  ]);

  return viewModel;
}
