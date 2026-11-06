import { useEffect, useRef } from "react";
import { useAppContext } from "./AppProvider";
import { useAccountBrowserStorage, useOptionalAccountWorkspace } from "./AccountWorkspace";
import { preloadProtectedPracticeSlots } from "./protectedPracticeSlots";
import { canStartNewCase, getAccessibleDifficultyKeys, getHighestAccessibleDifficultyKey } from "../core/progression";
import { createEmptySeenCasesState } from "../core/selection";

/** Account-dependent preloading is separate from the stable landing presentation. */
export function useLandingPracticePreload() {
  const { state, patchPracticeState } = useAppContext();
  const browserStorage = useAccountBrowserStorage();
  const workspace = useOptionalAccountWorkspace();
  const practicePreloadKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== "ready" || (workspace && !workspace.isCurrent())) return;
    const payload = state.payload;
    const runtimeConfig = state.runtimeConfig;
    const supabase = state.supabase;
    const storage = state.storage;
    if (!payload?.contentVersion || !runtimeConfig) return;
    if (!supabase || !storage || typeof window === "undefined") return;
    const activeRuntimeConfig = runtimeConfig;
    const activeSupabase = supabase;
    const contentVersion = payload.contentVersion;

    const progressionInput = {
      progressionConfig: payload.progressionConfig ?? null,
      dashboardState: payload.dashboardState ?? null,
      defaultUserState: payload.defaultUserState ?? null,
      userState: state.userState,
      cases: []
    };
    if (!canStartNewCase(progressionInput)) return;

    const accessibleDifficulties = getAccessibleDifficultyKeys(progressionInput);
    const highestDifficulty = getHighestAccessibleDifficultyKey(progressionInput);
    if (!accessibleDifficulties.includes(highestDifficulty)) return;

    const preloadKey = [
      state.userId ?? "anonymous",
      contentVersion,
      highestDifficulty,
      accessibleDifficulties.join("|")
    ].join(":");
    if (practicePreloadKeyRef.current === preloadKey) return;
    practicePreloadKeyRef.current = preloadKey;

    let cancelled = false;
    const selectionHints = {
      seenCaseIdsByDifficulty: storage.loadSeenCaseState() ?? createEmptySeenCasesState(),
      recentArchetypes: []
    };

    async function preloadPracticeSlots() {
      try {
        const primarySlots = await preloadProtectedPracticeSlots({
          isCurrent: () => !cancelled && (!workspace || workspace.isCurrent()),
          config: activeRuntimeConfig,
          supabase: activeSupabase,
          storage: browserStorage,
          contentVersion,
          userId: state.userId,
          currentSlots: state.practiceState.practiceSlotsByDifficulty,
          difficulties: [highestDifficulty],
          selectionHints
        });
        if (cancelled || (workspace && !workspace.isCurrent())) return;

        patchPracticeState({
          practiceSlotsByDifficulty: primarySlots
        });

        const remainingDifficulties = accessibleDifficulties.filter(difficultyKey => difficultyKey !== highestDifficulty);
        if (!remainingDifficulties.length) return;

        const nextSlots = await preloadProtectedPracticeSlots({
          isCurrent: () => !cancelled && (!workspace || workspace.isCurrent()),
          config: activeRuntimeConfig,
          supabase: activeSupabase,
          storage: browserStorage,
          contentVersion,
          userId: state.userId,
          currentSlots: primarySlots,
          difficulties: remainingDifficulties,
          selectionHints
        });
        if (cancelled || (workspace && !workspace.isCurrent())) return;

        patchPracticeState({
          practiceSlotsByDifficulty: nextSlots
        });
      } catch {
        // Practice remains responsible for showing any slot-loading error if the user enters the flow.
      }
    }

    void preloadPracticeSlots();

    return () => {
      cancelled = true;
      if (practicePreloadKeyRef.current === preloadKey) practicePreloadKeyRef.current = null;
    };
  }, [
    workspace,
    patchPracticeState,
    state.payload?.contentVersion,
    state.runtimeConfig,
    state.status,
    state.storage,
    state.supabase,
    state.userId,
    state.userState
  ]);
}
