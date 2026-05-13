import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import {
  getMissingPracticeSlotDifficulties,
  isExpiredPracticeSlot,
  preloadProtectedPracticeSlots
} from "../../app/protectedPracticeSlots";
import { PROTECTED_PRACTICE_MESSAGES, getProtectedPracticeUnavailableMessage } from "../../app/protectedPracticeMessages";
import {
  getCalibrationAllowedDifficulties,
  getPracticeDifficultyMismatchAction,
  resolvePracticeDifficulty,
  shouldConfirmDifficultySwitch,
  shouldShowPracticeIntro
} from "../../app/viewHelpers";
import { trackEvent } from "../../core/analytics";
import { createCalibrationCompletionRecord } from "../../core/calibration";
import { openCaseFeedbackForm } from "../../core/feedback";
import { shouldShowMetricReferences } from "../../core/metrics";
import { buildConciseStepFeedback } from "../../core/explanations";
import {
  applyProtectedCaseCompletion,
  buildPendingPracticeSubmission,
  isProtectedPracticeError,
  submitProtectedPracticeCase
} from "../../core/protectedPractice";
import {
  clearPracticeSlotCache,
  clearPendingPracticeSubmission,
  slotMatchesDifficultyKey,
  savePendingPracticeSubmission,
  savePracticeSlotsCache
} from "../../core/protectedPracticeCache";
import {
  canUseClientSidePracticeFeedback,
  getCorrectAnswer,
  isCorrectAnswer,
  prettyStepLabel,
  reconcileProtectedSummaryWithLockedStepResults
} from "../../core/practice";
import {
  canStartNewCase,
  getCalibrationCompletionFromUserState,
  getAccessibleDifficultyKeys,
  appendPracticeAttemptSummary,
  getAwardableXpWithReadinessGates,
  getDifficultyLabel,
  getDifficultyMeta,
  getLevelProgress,
  getMaxReachableLevel,
  getReleaseFlags,
  isPlacementXpBoostActive,
  mapProgressRowToUserState,
  normalizeDifficultyKey,
  syncUserStateDerivedFields
} from "../../core/progression";
import { completeCalibrationProgress } from "../../core/progressionSync";
import {
  buildStepOptionOverrides,
  createEmptySeenCasesState,
  markCaseSeen,
  rememberRecentArchetype
} from "../../core/selection";
import type { AnswerSelection, AnswerValue, CaseData, IssuedPracticeSlot, ProgressionConfig, StepResult } from "../../core/types";
import { getLearnUnlockMilestoneForLevelTransition } from "../learn/content";
import { LearnUnlockModal } from "../learn/LearnUnlockModal";
import { Surface } from "../primitives/Surface";
import { ActivePracticeCase } from "../practice/ActivePracticeCase";
import { CalibrationIntroModal } from "../practice/CalibrationIntroModal";
import { PracticeDifficultyRail } from "../practice/PracticeDifficultyRail";
import { ResultsSummaryCard, ResultsSummaryHeader } from "../practice/ResultsSummaryCard";
import { ErrorView, LoadingView } from "../shared/StatusViews";

interface ResultsXpAnimationState {
  level: number;
  xpProgressLabel: string;
  progressValue: number;
  animate: boolean;
  animationMode?: "default" | "steady";
  flash: boolean;
}

const animatedResultsSummaryKeys = new Set<string>();
const dismissedLearnUnlockKeys = new Set<string>();
const DIFFICULTY_UNLOCK_MODAL_SLUGS = new Set(["intermediate", "advanced", "master"]);

function formatResultsXpProgressLabel(xpIntoLevel: number, xpForNextLevel: number) {
  return `${xpIntoLevel} / ${xpForNextLevel || xpIntoLevel} XP`;
}

function getResultsXpResetLabel(progressionConfig: ProgressionConfig | null, level: number) {
  const xpForNextLevel = Number(progressionConfig?.xp_required_per_level?.[level] ?? 0);
  return `0 / ${xpForNextLevel || 0} XP`;
}

function getResultsXpRequiredForLevel(progressionConfig: ProgressionConfig | null, level: number) {
  return Number(progressionConfig?.xp_required_per_level?.[level] ?? 0);
}

function getResultsSummaryAnimationKey(summary: { caseToken?: string | null; caseId: string } | null | undefined) {
  if (!summary) return null;
  return summary.caseToken ?? summary.caseId;
}

function getReadinessGateProgressMessage(progressionConfig: ProgressionConfig | null, blockedDifficulty: string | null | undefined) {
  if (!blockedDifficulty) return null;
  const requirement = progressionConfig?.performance_unlock_requirements?.[blockedDifficulty];
  const minAccuracy = Math.max(0, Math.min(100, Number(requirement?.minStepAccuracyPercent ?? 75) || 75));
  const caseCount = Math.max(1, Math.round(Number(requirement?.lastCases ?? 5) || 5));
  return `You must reach ${minAccuracy}% accuracy over ${caseCount} cases to progress`;
}

export function ProtectedPracticeScreen() {
  const { state, setUserState, patchPracticeState, patchSessionState } = useAppContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [recentArchetypes, setRecentArchetypes] = useState<string[]>([]);
  const [introOpen, setIntroOpen] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<string | null>(null);
  const [displayedResultsProgress, setDisplayedResultsProgress] = useState<number | null>(null);
  const [dismissedLearnUnlockKey, setDismissedLearnUnlockKey] = useState<string | null>(null);
  const activeStepRef = useRef<HTMLButtonElement | null>(null);
  const introAcceptedRef = useRef(false);
  const difficultyReconciledRef = useRef(false);
  const latestCaseLoadRequestRef = useRef(0);
  const practiceOpenedTrackedRef = useRef(false);
  const caseStartTrackedRef = useRef(new Set<string>());
  const summaryViewTrackedRef = useRef(new Set<string>());

  const payload = state.payload;
  const calibrationRecord = getCalibrationCompletionFromUserState(state.userState) ?? state.storage?.loadCalibrationCompletion() ?? null;
  const progressionInput = {
    progressionConfig: payload?.progressionConfig ?? null,
    dashboardState: payload?.dashboardState ?? null,
    defaultUserState: payload?.defaultUserState ?? null,
    userState: state.userState,
    cases: []
  };
  const hasExplicitDifficultyParam = searchParams.has("difficulty");
  const requestedDifficultyParam = searchParams.get("difficulty");
  const releaseFlags = getReleaseFlags(payload?.progressionConfig ?? null);
  const difficultyResolution = resolvePracticeDifficulty({
    requestedDifficulty: requestedDifficultyParam,
    hasExplicitDifficultyParam,
    calibrationRecord,
    progressionInput,
    lastPracticeDifficulty: state.storage?.loadLastPracticeDifficulty() ?? null,
    enableCalibrationAccessGuard: releaseFlags.enableCalibrationAccessGuard
  });
  const normalizedDifficulty = difficultyResolution.resolvedDifficulty;
  const analyticsSource = searchParams.get("source") ?? undefined;
  const difficultyMeta = getDifficultyMeta(progressionInput);
  const accessibleDifficulties = getAccessibleDifficultyKeys(progressionInput);
  const canLoadCase = canStartNewCase(progressionInput);
  const currentCase = state.practiceState.currentCase;
  const summary = state.practiceState.lastCaseSummary;
  const activeCaseDifficulty = currentCase
    ? getDifficultyLabel(payload?.progressionConfig ?? null, Number(currentCase.difficulty_level ?? 1))
    : normalizedDifficulty;
  const difficultyMismatchAction = getPracticeDifficultyMismatchAction({
    hasExplicitDifficultyParam,
    hasActiveCase: Boolean(currentCase),
    hasSummary: Boolean(summary),
    activeCaseDifficulty: currentCase ? activeCaseDifficulty : null,
    normalizedDifficulty
  });
  const currentStepIndex = state.sessionState.currentStepIndex;
  const currentStep = currentCase?.questions_flow?.[currentStepIndex] ?? null;
  const allowsClientSideFeedback = canUseClientSidePracticeFeedback(currentCase);
  const currentResult = state.sessionState.stepResults[currentStepIndex] ?? null;
  const currentOptions = state.sessionState.stepOptionOverrides[currentStepIndex] ?? currentStep?.options ?? [];
  const totalSteps = currentCase?.questions_flow?.length ?? 0;
  const isFinalStep = currentStepIndex >= Math.max(0, totalSteps - 1);
  const currentSelection = !allowsClientSideFeedback && !currentResult
    ? state.sessionState.selectedAnswers[currentStepIndex] ?? null
    : null;
  const hasAnsweredSteps = allowsClientSideFeedback
    ? state.sessionState.stepResults.some(result => Boolean(result))
    : state.sessionState.selectedAnswers.some(result => Boolean(result));
  const showSummaryReferences = Boolean(summary && shouldShowMetricReferences(summary.caseData, state.sessionState.showAdvancedRanges));
  const currentDifficultyLevel = Number(currentCase?.difficulty_level ?? summary?.caseData.difficulty_level ?? 1);
  const showAbnormalHighlighting = currentDifficultyLevel <= 3;
  const shouldAutoLoadPracticeCase = !currentCase && !summary && canLoadCase;
  const isReadyForPracticeIntroGate = state.status === "ready" && Boolean(state.storage);
  const hasSeenPracticeIntro = state.storage?.loadPracticeIntroSeen() ?? false;
  const hasVisitedAppArea = state.storage?.loadAppAreaVisited() ?? false;
  const hasSeenStoredCases = Object.values(state.storage?.loadSeenCaseState() ?? {}).some(caseIds => caseIds.length > 0);
  const hasExistingPracticeProgress = Boolean(
    state.userState.casesCompleted > 0 ||
    state.userState.totalAnswers > 0 ||
    state.userState.correctAnswers > 0 ||
    state.userState.xp > 0 ||
    state.userState.level > 1 ||
    (Array.isArray(state.userState.appliedProtectedCaseTokens) && state.userState.appliedProtectedCaseTokens.length > 0) ||
    (Array.isArray(state.userState.recentResults) && state.userState.recentResults.length > 0) ||
    hasSeenStoredCases
  );
  const shouldOpenPracticeIntro = isReadyForPracticeIntroGate && shouldShowPracticeIntro(
    hasSeenPracticeIntro,
    hasVisitedAppArea,
    Boolean(currentCase),
    Boolean(summary),
    hasExistingPracticeProgress
  );
  const finalLevelProgress = getLevelProgress(payload?.progressionConfig ?? null, state.userState);
  const maxReachableLevel = getMaxReachableLevel(payload?.progressionConfig ?? null);
  const preAwardUserState = summary
    ? syncUserStateDerivedFields(
        {
          ...state.userState,
          xp: Math.max(0, state.userState.xp - summary.totalXpAward)
        },
        payload?.progressionConfig ?? null
      )
    : state.userState;
  const startingLevelProgress = getLevelProgress(payload?.progressionConfig ?? null, preAwardUserState);
  const resultsStartProgress = startingLevelProgress.progressPercent;
  const resultsXpStartLabel = formatResultsXpProgressLabel(startingLevelProgress.xpIntoLevel, startingLevelProgress.xpForNextLevel);
  const resultsXpFinalLabel = formatResultsXpProgressLabel(finalLevelProgress.xpIntoLevel, finalLevelProgress.xpForNextLevel);
  const summaryAnimationKey = getResultsSummaryAnimationKey(summary);
  const currentCaseBoostedXp = isPlacementXpBoostActive({
    progressionConfig: payload?.progressionConfig ?? null,
    userState: state.userState,
    difficultyLevel: currentCase?.difficulty_level
  });
  const summaryBoostedXp = isPlacementXpBoostActive({
    progressionConfig: payload?.progressionConfig ?? null,
    userState: preAwardUserState,
    difficultyLevel: summary?.caseData.difficulty_level
  });
  const [displayedResultsXp, setDisplayedResultsXp] = useState<ResultsXpAnimationState | null>(null);
  const shouldHoldAtReadinessGate = Boolean(
    summary &&
    startingLevelProgress.isBlockedByReadinessGate &&
    finalLevelProgress.isBlockedByReadinessGate
  );
  const readinessGateProgressMessage = finalLevelProgress.isBlockedByReadinessGate
    ? getReadinessGateProgressMessage(payload?.progressionConfig ?? null, finalLevelProgress.blockedDifficulty)
    : null;
  const nextAccessibleDifficulties = summary ? accessibleDifficulties : [];
  const calibrationAccessibleDifficulties = calibrationRecord
    ? getCalibrationAllowedDifficulties(calibrationRecord.placement)
    : [];
  const hasNewlyAccessibleDifficulty = (difficultyKey: string, unlockLevel: number) => (
    preAwardUserState.level < unlockLevel &&
    !calibrationAccessibleDifficulties.includes(difficultyKey) &&
    nextAccessibleDifficulties.includes(difficultyKey)
  );
  const levelUnlockMilestone = summary
    ? getLearnUnlockMilestoneForLevelTransition(preAwardUserState.level, state.userState.level)
    : null;
  const learnUnlockMilestone = levelUnlockMilestone && (
    !DIFFICULTY_UNLOCK_MODAL_SLUGS.has(levelUnlockMilestone.slug) ||
    hasNewlyAccessibleDifficulty(levelUnlockMilestone.slug, levelUnlockMilestone.unlockLevel)
  )
    ? levelUnlockMilestone
    : null;
  const learnUnlockKey = summary && learnUnlockMilestone
    ? `${summary.caseToken ?? summary.caseId}-${learnUnlockMilestone.unlockLevel}`
    : null;
  const shouldShowLearnUnlockModal = Boolean(
    learnUnlockKey &&
    learnUnlockMilestone &&
    learnUnlockKey !== dismissedLearnUnlockKey &&
    !dismissedLearnUnlockKeys.has(learnUnlockKey)
  );
  const interactionLocked = Boolean(
    state.practiceState.pendingSubmission &&
    state.practiceState.pendingSubmission.caseToken === state.practiceState.currentCaseToken
  );
  const isSubmittingCase =
    state.practiceState.syncState === "submitting" &&
    state.practiceState.pendingSubmission?.caseToken === state.practiceState.currentCaseToken;

  function withAnalyticsSource(params: Record<string, unknown>) {
    return analyticsSource ? { ...params, source: analyticsSource } : params;
  }

  function trackPracticeCaseStarted(difficultyKey: string, caseData: CaseData, caseToken?: string | null) {
    const trackingKey = `${difficultyKey}:${caseToken ?? caseData.case_id}`;
    if (caseStartTrackedRef.current.has(trackingKey)) return;

    caseStartTrackedRef.current.add(trackingKey);
    trackEvent("practice_case_started", withAnalyticsSource({
      difficulty: difficultyKey,
      case_id: caseData.case_id,
      archetype: caseData.archetype
    }));
  }

  function trackPracticeStepAnswered(isCorrect: boolean) {
    if (!currentCase || !currentStep) return;

    trackEvent("practice_step_answered", withAnalyticsSource({
      difficulty: activeCaseDifficulty,
      case_id: currentCase.case_id,
      archetype: currentCase.archetype,
      step: currentStep.key,
      is_correct: isCorrect,
      total_steps: totalSteps || undefined
    }));
  }

  useEffect(() => {
    if (difficultyResolution.shouldRedirect) {
      setSearchParams({ difficulty: normalizedDifficulty }, { replace: true });
    }
  }, [difficultyResolution.shouldRedirect, normalizedDifficulty, setSearchParams]);

  useEffect(() => {
    if (state.status !== "ready") return;
    if (!hasExplicitDifficultyParam && difficultyMismatchAction) return;
    state.storage?.saveLastPracticeDifficulty(normalizedDifficulty);
  }, [difficultyMismatchAction, hasExplicitDifficultyParam, normalizedDifficulty, state.status, state.storage]);

  useEffect(() => {
    if (!isReadyForPracticeIntroGate) return;
    if (hasExistingPracticeProgress && (!hasSeenPracticeIntro || !hasVisitedAppArea)) {
      if (!hasSeenPracticeIntro) state.storage?.savePracticeIntroSeen(true);
      if (!hasVisitedAppArea) state.storage?.saveAppAreaVisited(true);
    }
  }, [hasExistingPracticeProgress, hasSeenPracticeIntro, hasVisitedAppArea, isReadyForPracticeIntroGate, state.storage]);

  useEffect(() => {
    if (difficultyReconciledRef.current) return;
    if (!difficultyMismatchAction) return;

    difficultyReconciledRef.current = true;

    if (difficultyMismatchAction === "resume_active_case" && currentCase) {
      setSearchParams({ difficulty: activeCaseDifficulty }, { replace: true });
      return;
    }

    if (difficultyMismatchAction === "replace_active_case") {
      void handleDifficultyChange(normalizedDifficulty);
    }
  }, [activeCaseDifficulty, currentCase, difficultyMismatchAction, normalizedDifficulty, setSearchParams]);

  useEffect(() => {
    if (state.sessionState.currentDifficulty !== normalizedDifficulty) {
      patchSessionState({ currentDifficulty: normalizedDifficulty });
    }
  }, [normalizedDifficulty, patchSessionState, state.sessionState.currentDifficulty]);

  useEffect(() => {
    if (state.status !== "ready" || practiceOpenedTrackedRef.current) return;

    practiceOpenedTrackedRef.current = true;
    trackEvent("practice_opened", withAnalyticsSource({
      difficulty: normalizedDifficulty
    }));
  }, [normalizedDifficulty, state.status]);

  useEffect(() => {
    activeStepRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [currentStepIndex, normalizedDifficulty]);

  useEffect(() => {
    if (!summary) {
      setDisplayedResultsProgress(null);
      setDisplayedResultsXp(null);
      return;
    }

    const timeoutIds: number[] = [];
    const frameIds: number[] = [];
    const progressionConfig = payload?.progressionConfig ?? null;
    const finalLevel = state.userState.level;

    if (summaryAnimationKey && animatedResultsSummaryKeys.has(summaryAnimationKey)) {
      setDisplayedResultsProgress(finalLevelProgress.progressPercent);
      setDisplayedResultsXp({
        level: finalLevel,
        xpProgressLabel: resultsXpFinalLabel,
        progressValue: finalLevelProgress.progressPercent,
        animate: false,
        flash: false
      });
      return () => undefined;
    }

    if (summaryAnimationKey) {
      animatedResultsSummaryKeys.add(summaryAnimationKey);
    }

    if (shouldHoldAtReadinessGate) {
      setDisplayedResultsProgress(finalLevelProgress.progressPercent);
      setDisplayedResultsXp({
        level: finalLevel,
        xpProgressLabel: resultsXpFinalLabel,
        progressValue: finalLevelProgress.progressPercent,
        animate: false,
        flash: true
      });
      return () => undefined;
    }

    setDisplayedResultsProgress(resultsStartProgress);
    setDisplayedResultsXp({
      level: preAwardUserState.level,
      xpProgressLabel: resultsXpStartLabel,
      progressValue: resultsStartProgress,
      animate: true,
      flash: false
    });

    if (preAwardUserState.level === finalLevel) {
      timeoutIds.push(window.setTimeout(() => {
        setDisplayedResultsProgress(finalLevelProgress.progressPercent);
        setDisplayedResultsXp({
          level: finalLevel,
          xpProgressLabel: resultsXpFinalLabel,
          progressValue: finalLevelProgress.progressPercent,
          animate: true,
          flash: false
        });
      }, 500));
    } else {
      let elapsedMs = 250;
      for (let level = preAwardUserState.level; level < finalLevel; level += 1) {
        const xpForNextLevel = getResultsXpRequiredForLevel(progressionConfig, level);
        const fullLevelLabel = formatResultsXpProgressLabel(xpForNextLevel, xpForNextLevel);

        timeoutIds.push(window.setTimeout(() => {
          setDisplayedResultsProgress(100);
          setDisplayedResultsXp({
            level,
            xpProgressLabel: fullLevelLabel,
            progressValue: 100,
            animate: true,
            animationMode: "steady",
            flash: false
          });
        }, elapsedMs));

        elapsedMs += 1500;
        timeoutIds.push(window.setTimeout(() => {
          setDisplayedResultsXp(current => current ? { ...current, flash: true } : current);
        }, elapsedMs));

        timeoutIds.push(window.setTimeout(() => {
          setDisplayedResultsXp(current => current ? { ...current, flash: false } : current);
        }, elapsedMs + 520));

        elapsedMs += 80;
        timeoutIds.push(window.setTimeout(() => {
          setDisplayedResultsProgress(0);
          setDisplayedResultsXp({
            level: level + 1,
            xpProgressLabel: getResultsXpResetLabel(progressionConfig, level + 1),
            progressValue: 0,
            animate: false,
            flash: true
          });
        }, elapsedMs));

        elapsedMs += 16;
      }

      timeoutIds.push(window.setTimeout(() => {
        const frameId = window.requestAnimationFrame(() => {
          setDisplayedResultsProgress(finalLevelProgress.progressPercent);
          setDisplayedResultsXp({
            level: finalLevel,
            xpProgressLabel: resultsXpFinalLabel,
            progressValue: finalLevelProgress.progressPercent,
            animate: true,
            flash: false
          });
        });
        frameIds.push(frameId);
      }, elapsedMs));
    }

    return () => {
      timeoutIds.forEach(timeoutId => window.clearTimeout(timeoutId));
      frameIds.forEach(frameId => window.cancelAnimationFrame(frameId));
    };
  }, [
    finalLevelProgress.progressPercent,
    finalLevelProgress.xpForNextLevel,
    finalLevelProgress.xpIntoLevel,
    payload?.progressionConfig,
    preAwardUserState.level,
    resultsStartProgress,
    resultsXpFinalLabel,
    resultsXpStartLabel,
    shouldHoldAtReadinessGate,
    startingLevelProgress.xpForNextLevel,
    state.userState.level,
    summaryAnimationKey,
    summary?.caseId
  ]);

  useEffect(() => {
    if (!summary) return;

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [summary?.caseId]);

  useEffect(() => {
    if (!summary) return;

    const summaryKey = summary.caseToken ?? summary.caseId;
    if (summaryViewTrackedRef.current.has(summaryKey)) return;

    summaryViewTrackedRef.current.add(summaryKey);
    trackEvent("case_explanation_viewed", withAnalyticsSource({
      difficulty: summary.difficulty,
      case_id: summary.caseId,
      archetype: summary.caseData.archetype,
      total_steps: summary.totalSteps,
      correct_steps: summary.correctSteps
    }));
  }, [summary?.caseId, summary?.caseToken]);

  async function persistUserState(nextUserState: typeof state.userState) {
    await setUserState(nextUserState);
  }

  async function markAbandonedCase() {
    await persistUserState({
      ...state.userState,
      abandonedCases: state.userState.abandonedCases + 1
    });
  }

  async function fetchSlotsForDifficulties(difficulties: string[]) {
    if (!payload?.contentVersion || !state.supabase || !state.runtimeConfig) {
      patchPracticeState({
        syncState: "unavailable",
        syncMessage: PROTECTED_PRACTICE_MESSAGES.unavailableNotReady
      });
      return {};
    }

    const { slots, missingDifficulties } = getMissingPracticeSlotDifficulties({
      storage: window.localStorage,
      contentVersion: payload.contentVersion,
      userId: state.userId,
      currentSlots: state.practiceState.practiceSlotsByDifficulty,
      difficulties
    });

    if (!missingDifficulties.length) {
      return slots;
    }

    patchPracticeState({
      syncState: "loading_slots",
      syncMessage: null
    });

    try {
      const nextSlots = await preloadProtectedPracticeSlots({
        config: state.runtimeConfig,
        supabase: state.supabase,
        storage: window.localStorage,
        contentVersion: payload.contentVersion,
        userId: state.userId,
        currentSlots: state.practiceState.practiceSlotsByDifficulty,
        difficulties: missingDifficulties,
        selectionHints: {
          seenCaseIdsByDifficulty: state.storage?.loadSeenCaseState() ?? createEmptySeenCasesState(),
          recentArchetypes
        }
      });
      patchPracticeState({
        practiceSlotsByDifficulty: nextSlots,
        syncState: "idle",
        syncMessage: null
      });
      return nextSlots;
    } catch (error) {
      const hasAnyCachedSlot = difficulties.some(difficultyKey => Boolean(slots[difficultyKey]));
      patchPracticeState({
        syncState: hasAnyCachedSlot ? "idle" : "unavailable",
        syncMessage: hasAnyCachedSlot
          ? PROTECTED_PRACTICE_MESSAGES.refreshFailed
          : getProtectedPracticeUnavailableMessage()
      });
      return slots;
    }
  }

  useEffect(() => {
    if (!payload?.contentVersion) return;
    if (!accessibleDifficulties.length) return;
    const preloadDifficulties = shouldAutoLoadPracticeCase
      ? accessibleDifficulties.filter(difficultyKey => difficultyKey !== normalizedDifficulty)
      : accessibleDifficulties;
    if (!preloadDifficulties.length) return;
    void fetchSlotsForDifficulties(preloadDifficulties);
  }, [
    accessibleDifficulties.join("|"),
    normalizedDifficulty,
    payload?.contentVersion,
    recentArchetypes.join("|"),
    shouldAutoLoadPracticeCase,
    state.runtimeConfig
  ]);

  useEffect(() => {
    if (!isReadyForPracticeIntroGate) return;
    if (!shouldAutoLoadPracticeCase) return;
    if (introOpen) return;
    if (introAcceptedRef.current) {
      introAcceptedRef.current = false;
      return;
    }

    if (shouldOpenPracticeIntro) {
      state.storage?.savePracticeIntroSeen(true);
      state.storage?.saveAppAreaVisited(true);
      if (!introOpen || pendingDifficulty !== normalizedDifficulty) {
        setPendingDifficulty(normalizedDifficulty);
        setIntroOpen(true);
      }
      if (!currentCase) {
        void beginCase(normalizedDifficulty, { preview: true, confirmAbandon: false });
      }
      return;
    }

    if (!hasVisitedAppArea) {
      state.storage?.saveAppAreaVisited(true);
    }
    void beginCase(normalizedDifficulty);
  }, [currentCase, hasVisitedAppArea, introOpen, isReadyForPracticeIntroGate, normalizedDifficulty, pendingDifficulty, shouldAutoLoadPracticeCase, shouldOpenPracticeIntro, state.storage]);

  async function activateSlot(difficultyKey: string, slot: IssuedPracticeSlot, options?: { preview?: boolean }) {
    if (!slotMatchesDifficultyKey(slot, difficultyKey)) {
      patchPracticeState({
        currentCase: null,
        currentCaseToken: null,
        currentCaseExpiresAt: null,
        syncState: "unavailable",
        syncMessage: PROTECTED_PRACTICE_MESSAGES.caseMismatch
      });
      return;
    }

    patchPracticeState({
      currentCase: slot.caseData,
      currentCaseToken: slot.caseToken,
      currentCaseExpiresAt: slot.expiresAt,
      lastCaseSummary: null,
      syncMessage: null
    });
    patchSessionState({
      currentDifficulty: difficultyKey,
      currentStepIndex: 0,
      selectedAnswers: [],
      stepResults: [],
      stepOptionOverrides: buildStepOptionOverrides(slot.caseData, payload?.cases ?? []),
      caseStartMs: options?.preview ? null : Date.now()
    });
    setRecentArchetypes(previous => rememberRecentArchetype(previous, slot.caseData));
    if (!options?.preview) {
      trackPracticeCaseStarted(difficultyKey, slot.caseData, slot.caseToken);
    }
  }

  function activatePreviewedSlot(difficultyKey: string) {
    if (!currentCase) return;

    patchSessionState({
      currentDifficulty: difficultyKey,
      caseStartMs: Date.now()
    });
    trackPracticeCaseStarted(difficultyKey, currentCase, state.practiceState.currentCaseToken);
  }

  async function beginCase(difficultyKey: string, options?: { confirmAbandon?: boolean; preview?: boolean }) {
    const nextDifficulty = normalizeDifficultyKey(progressionInput, difficultyKey);
    const shouldConfirmAbandon = options?.confirmAbandon ?? true;
    const requestId = latestCaseLoadRequestRef.current + 1;
    latestCaseLoadRequestRef.current = requestId;

    if (shouldConfirmAbandon && currentCase && !summary && hasAnsweredSteps) {
      const confirmed = window.confirm("Start a new case? Your current case progress will be lost.");
      if (!confirmed) return;
      await markAbandonedCase();
    }

    const slots = await fetchSlotsForDifficulties([nextDifficulty]);
    if (requestId !== latestCaseLoadRequestRef.current) return;

    const slot = slots[nextDifficulty];
    if (!slot || isExpiredPracticeSlot(slot)) {
      patchPracticeState({
        syncState: "unavailable",
        syncMessage: getProtectedPracticeUnavailableMessage()
      });
      return;
    }

    await activateSlot(nextDifficulty, slot, { preview: options?.preview });
  }

  function requestCaseStart(difficultyKey: string) {
    const shouldOpenIntro = shouldShowPracticeIntro(
      state.storage?.loadPracticeIntroSeen() ?? false,
      state.storage?.loadAppAreaVisited() ?? false,
      Boolean(currentCase),
      Boolean(summary),
      hasExistingPracticeProgress
    );

    if (shouldOpenIntro) {
      state.storage?.savePracticeIntroSeen(true);
      state.storage?.saveAppAreaVisited(true);
      setPendingDifficulty(difficultyKey);
      setIntroOpen(true);
      return;
    }

    state.storage?.saveAppAreaVisited(true);
    void beginCase(difficultyKey);
  }

  function handleContinueFromIntro() {
    state.storage?.savePracticeIntroSeen(true);
    state.storage?.saveAppAreaVisited(true);
    introAcceptedRef.current = true;
    setIntroOpen(false);
    setPendingDifficulty(null);
    navigate("/calibration");
  }

  async function handleSkipCalibrationIntro() {
    state.storage?.savePracticeIntroSeen(true);
    state.storage?.saveAppAreaVisited(true);
    const completion = createCalibrationCompletionRecord("beginner");
    state.storage?.saveCalibrationCompletion(completion);
    if (state.supabase) {
      try {
        const progress = await completeCalibrationProgress({
          supabase: state.supabase,
          progressionConfig: payload?.progressionConfig ?? null,
          placement: "beginner",
          completion,
          attemptPayload: { source: "skip_intro" }
        });
        const progressPatch = mapProgressRowToUserState(progress);
        if (progressPatch) {
          await persistUserState(syncUserStateDerivedFields({
            ...state.userState,
            ...progressPatch
          }, payload?.progressionConfig ?? null));
        }
      } catch {
        // Local completion remains as a fallback if Supabase sync is unavailable.
      }
    }
    introAcceptedRef.current = true;
    setIntroOpen(false);
    setPendingDifficulty(null);
    setSearchParams({ difficulty: "beginner" }, { replace: true });
    void beginCase("beginner", { confirmAbandon: false });
  }

  async function handleDifficultyChange(nextDifficulty: string) {
    const nextNormalizedDifficulty = normalizeDifficultyKey(progressionInput, nextDifficulty);
    const hasActiveUnfinishedCase = Boolean(currentCase && !summary);

    // User-initiated switches should bypass the initial route reconciliation flow.
    difficultyReconciledRef.current = true;

    if (shouldConfirmDifficultySwitch(hasActiveUnfinishedCase, hasAnsweredSteps)) {
      const confirmed = window.confirm("Switch difficulty and load a new case? Your current case progress will be lost.");
      trackEvent("practice_difficulty_changed", {
        from_difficulty: normalizedDifficulty,
        to_difficulty: nextNormalizedDifficulty,
        had_answers: true,
        confirmed
      });
      if (!confirmed) return;

      await markAbandonedCase();
      trackEvent("case_abandoned", {
        case_id: currentCase?.case_id,
        archetype: currentCase?.archetype,
        from_difficulty: normalizedDifficulty,
        to_difficulty: nextNormalizedDifficulty,
        reason: "difficulty_switch"
      });
    } else {
      trackEvent("practice_difficulty_changed", {
        from_difficulty: normalizedDifficulty,
        to_difficulty: nextNormalizedDifficulty,
        had_answers: hasAnsweredSteps,
        confirmed: true
      });
    }

    setSearchParams({ difficulty: nextNormalizedDifficulty });
    state.storage?.saveLastPracticeDifficulty(nextNormalizedDifficulty);
    await beginCase(nextNormalizedDifficulty, { confirmAbandon: false });
  }

  function handleAdvancedRangesToggle() {
    const nextValue = !state.sessionState.showAdvancedRanges;
    patchSessionState({ showAdvancedRanges: nextValue });
    state.storage?.saveAdvancedRangesPreference(nextValue);
  }

  function handleAnswer(option: string) {
    if (!currentStep || !currentCase || currentResult || interactionLocked) return;

    if (currentStep.selection_mode === "multi") {
      const currentChosen = state.sessionState.selectedAnswers[currentStepIndex]?.chosen;
      const currentValues = Array.isArray(currentChosen) ? currentChosen : [];
      const nextValues = currentValues.includes(option)
        ? currentValues.filter(value => value !== option)
        : [...currentValues, option];
      const nextSelections = [...state.sessionState.selectedAnswers];

      if (nextValues.length) {
        nextSelections[currentStepIndex] = {
          key: currentStep.key,
          label: currentStep.label ?? prettyStepLabel(currentStep.key),
          prompt: currentStep.prompt,
          chosen: nextValues
        };
      } else {
        delete nextSelections[currentStepIndex];
      }

      patchSessionState({ selectedAnswers: nextSelections });
      patchPracticeState({ syncMessage: null });
      return;
    }

    if (allowsClientSideFeedback) {
      const nextResults = [...state.sessionState.stepResults];
      nextResults[currentStepIndex] = {
        key: currentStep.key,
        label: currentStep.label ?? prettyStepLabel(currentStep.key),
        prompt: currentStep.prompt,
        chosen: option,
        correctAnswer: getCorrectAnswer(currentCase, currentStep.key),
        correct: isCorrectAnswer(currentCase, currentStep.key, option),
        feedback: buildConciseStepFeedback(currentCase, currentStep.key)
      };

      patchSessionState({
        stepResults: nextResults,
        selectedAnswers: []
      });

      trackPracticeStepAnswered(Boolean(nextResults[currentStepIndex]?.correct));
      return;
    }

    const nextSelections = [...state.sessionState.selectedAnswers];
    nextSelections[currentStepIndex] = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen: option
    };

    const correctAnswer = getCorrectAnswer(currentCase, currentStep.key);
    const correct = isCorrectAnswer(currentCase, currentStep.key, option);

    if (correct) {
      if (currentStepIndex >= totalSteps - 1) {
        patchSessionState({
          selectedAnswers: nextSelections
        });
        trackPracticeStepAnswered(true);
        return;
      }

      patchSessionState({
        selectedAnswers: nextSelections,
        currentStepIndex: currentStepIndex + 1
      });
      trackPracticeStepAnswered(true);
      return;
    }

    const nextResults = [...state.sessionState.stepResults];
    nextResults[currentStepIndex] = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen: option,
      correctAnswer,
      correct: false
    };
    patchSessionState({
      selectedAnswers: nextSelections,
      stepResults: nextResults
    });
    trackPracticeStepAnswered(false);
  }

  async function submitCase(selectedAnswersOverride?: AnswerSelection[]) {
    if (!currentCase || !state.practiceState.currentCaseToken || !payload?.contentVersion || !state.supabase || !state.runtimeConfig) {
      return;
    }

    const answers = allowsClientSideFeedback
      ? state.sessionState.stepResults
          .filter((result): result is StepResult => Boolean(result))
          .map(result => ({ key: result.key, chosen: result.chosen }))
      : (selectedAnswersOverride ?? state.sessionState.selectedAnswers)
          .filter((selection): selection is AnswerSelection => Boolean(selection))
          .map(selection => ({
            key: selection.key,
            chosen: selection.chosen
          }));

    if (answers.length !== totalSteps) {
      patchPracticeState({
        syncMessage: PROTECTED_PRACTICE_MESSAGES.answerAllSteps
      });
      return;
    }

    const elapsedSeconds = state.sessionState.caseStartMs
      ? Math.max(0, (Date.now() - state.sessionState.caseStartMs) / 1000)
      : 0;
    const pendingSubmission = buildPendingPracticeSubmission({
      caseToken: state.practiceState.currentCaseToken,
      caseId: currentCase.case_id,
      contentVersion: payload.contentVersion,
      difficultyKey: normalizedDifficulty,
      answers,
      elapsedSeconds,
      timedMode: state.sessionState.timedMode,
      clientCompletedAt: new Date().toISOString()
    });

    savePendingPracticeSubmission(window.localStorage, pendingSubmission);
    patchPracticeState({
      pendingSubmission,
      syncState: "submitting",
      syncMessage: null
    });

    try {
      const result = await submitProtectedPracticeCase(state.runtimeConfig, state.supabase, pendingSubmission);
      const progressPatch = mapProgressRowToUserState(result.progress);
      const reconciledSummary = reconcileProtectedSummaryWithLockedStepResults({
        summary: {
          ...result.summary,
          caseToken: pendingSubmission.caseToken
        },
        lockedStepResults: state.sessionState.stepResults,
        progressionConfig: payload.progressionConfig ?? null
      });
      const currentAttempt = {
        difficulty: normalizedDifficulty,
        correctSteps: reconciledSummary.correctSteps,
        totalSteps: reconciledSummary.totalSteps,
        completedAt: pendingSubmission.clientCompletedAt
      };
      const nextRecentPracticeAttempts = appendPracticeAttemptSummary(state.userState, currentAttempt);
      const cappedSummary = {
        ...reconciledSummary,
        totalXpAward: result.progress
          ? result.summary.totalXpAward
          : getAwardableXpWithReadinessGates({
              progressionConfig: payload.progressionConfig ?? null,
              userState: state.userState,
              requestedXp: reconciledSummary.totalXpAward,
              attemptsIncludingCurrent: nextRecentPracticeAttempts
            })
      };
      const nextUserState = progressPatch
        ? syncUserStateDerivedFields({
          ...state.userState,
          ...progressPatch,
          recentResults: [...state.userState.recentResults, reconciledSummary.correctSteps === reconciledSummary.totalSteps].slice(-20),
          recentPracticeAttempts: nextRecentPracticeAttempts
        }, payload.progressionConfig)
        : applyProtectedCaseCompletion({
          userState: state.userState,
          summary: cappedSummary,
          progressionConfig: payload.progressionConfig
        });
      if (nextUserState !== state.userState) {
        await persistUserState(nextUserState);
      }

      const seenCasesByDifficulty = state.storage?.loadSeenCaseState() ?? createEmptySeenCasesState();
      state.storage?.saveSeenCaseState(markCaseSeen(seenCasesByDifficulty, currentCase, payload.progressionConfig ?? null));

      const nextSlots = {
        ...state.practiceState.practiceSlotsByDifficulty,
        [normalizedDifficulty]: {
          ...result.replacementSlot,
          contentVersion: payload.contentVersion,
          difficultyKey: normalizedDifficulty
        }
      };
      savePracticeSlotsCache(window.localStorage, nextSlots, state.userId);
      clearPendingPracticeSubmission(window.localStorage);

      patchPracticeState({
        currentCase: null,
        currentCaseToken: null,
        currentCaseExpiresAt: null,
        lastCaseSummary: cappedSummary,
        practiceSlotsByDifficulty: nextSlots,
        pendingSubmission: null,
        syncState: "idle",
        syncMessage: null
      });
      patchSessionState({
        currentStepIndex: 0,
        selectedAnswers: [],
        stepResults: [],
        stepOptionOverrides: {},
        caseStartMs: null
      });

      trackEvent("practice_case_completed", withAnalyticsSource({
        case_id: currentCase.case_id,
        archetype: currentCase.archetype,
        difficulty: normalizedDifficulty,
        total_steps: cappedSummary.totalSteps,
        correct_steps: cappedSummary.correctSteps,
        completed: true
      }));
    } catch (error) {
      if (
        isProtectedPracticeError(error) &&
        (error.code === "CASE_TOKEN_EXPIRED" || (error.code === "CASE_SLOT_UNAVAILABLE" && error.status === 404))
      ) {
        const nextSlots = clearPracticeSlotCache(
          window.localStorage,
          state.practiceState.practiceSlotsByDifficulty,
          normalizedDifficulty,
          pendingSubmission.caseToken,
          state.userId
        );
        savePracticeSlotsCache(window.localStorage, nextSlots, state.userId);
        clearPendingPracticeSubmission(window.localStorage);
        patchPracticeState({
          currentCase: null,
          currentCaseToken: null,
          currentCaseExpiresAt: null,
          practiceSlotsByDifficulty: nextSlots,
          pendingSubmission: null,
          syncState: "idle",
          syncMessage: PROTECTED_PRACTICE_MESSAGES.caseExpiredBeforeCheck
        });
        patchSessionState({
          currentStepIndex: 0,
          selectedAnswers: [],
          stepResults: [],
          stepOptionOverrides: {},
          caseStartMs: null
        });
        return;
      }

      patchPracticeState({
        pendingSubmission,
        syncState: "pending_retry",
        syncMessage: PROTECTED_PRACTICE_MESSAGES.savedUntilOnline
      });
    }
  }

  function handleContinueStep() {
    if (interactionLocked) return;

    if (currentStep?.selection_mode === "multi" && currentCase && !currentResult) {
      const currentSelection = state.sessionState.selectedAnswers[currentStepIndex] ?? null;
      const chosen: AnswerValue = Array.isArray(currentSelection?.chosen) ? currentSelection.chosen : [];

      if (!chosen.length) {
        patchPracticeState({
          syncMessage: PROTECTED_PRACTICE_MESSAGES.answerAllSteps
        });
        return;
      }

      const correctAnswer = getCorrectAnswer(currentCase, currentStep.key);
      const correct = isCorrectAnswer(currentCase, currentStep.key, chosen);

      if (allowsClientSideFeedback) {
        const nextResults = [...state.sessionState.stepResults];
        nextResults[currentStepIndex] = {
          key: currentStep.key,
          label: currentStep.label ?? prettyStepLabel(currentStep.key),
          prompt: currentStep.prompt,
          chosen,
          correctAnswer,
          correct,
          feedback: buildConciseStepFeedback(currentCase, currentStep.key)
        };
        patchSessionState({ stepResults: nextResults });
        trackPracticeStepAnswered(correct);
        return;
      }

      if (correct) {
        trackPracticeStepAnswered(true);
        if (currentStepIndex < totalSteps - 1) {
          patchSessionState({ currentStepIndex: currentStepIndex + 1 });
          return;
        }
        void submitCase(state.sessionState.selectedAnswers);
        return;
      }

      const nextResults = [...state.sessionState.stepResults];
      nextResults[currentStepIndex] = {
        key: currentStep.key,
        label: currentStep.label ?? prettyStepLabel(currentStep.key),
        prompt: currentStep.prompt,
        chosen,
        correctAnswer,
        correct: false
      };
      patchSessionState({ stepResults: nextResults });
      trackPracticeStepAnswered(false);
      return;
    }

    if (currentStepIndex < totalSteps - 1) {
      patchSessionState({ currentStepIndex: currentStepIndex + 1 });
      return;
    }

    void submitCase();
  }

  function handleOpenFeedback() {
    if (!summary) return;
    openCaseFeedbackForm(summary);
  }

  function handleNextCaseFromSummary() {
    if (!summary) return;

    const nextSlot = state.practiceState.practiceSlotsByDifficulty[normalizedDifficulty];
    trackEvent("practice_next_case_clicked", {
      difficulty: normalizedDifficulty,
      completed_case_id: summary.caseId,
      next_case_id: nextSlot?.caseData.case_id,
      archetype: summary.caseData.archetype,
      source: "case_summary"
    });
    requestCaseStart(normalizedDifficulty);
  }

  if (state.status === "loading" || state.status === "idle") return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;

  const difficultyItems = difficultyMeta.map(item => {
    const isAccessible = accessibleDifficulties.includes(item.key);
    return {
      key: item.key,
      label: item.label,
      active: item.key === normalizedDifficulty,
      disabled: !isAccessible,
      onClick: () => {
        if (!isAccessible || item.key === normalizedDifficulty) return;
        void handleDifficultyChange(item.key);
      }
    };
  });
  const displayedSummaryLevel = shouldHoldAtReadinessGate
    ? state.userState.level
    : displayedResultsXp?.level ?? state.userState.level;
  const displayedSummaryLevelLabel = finalLevelProgress.isMaxLevel &&
    maxReachableLevel != null &&
    displayedSummaryLevel >= maxReachableLevel
    ? "Max Level"
    : undefined;

  return (
    <>
      <LearnUnlockModal
        level={shouldShowLearnUnlockModal ? learnUnlockMilestone : null}
        onClose={() => {
          if (learnUnlockKey) {
            dismissedLearnUnlockKeys.add(learnUnlockKey);
            setDismissedLearnUnlockKey(learnUnlockKey);
          }
        }}
      />

      <CalibrationIntroModal
        open={introOpen}
        onContinue={handleContinueFromIntro}
        onSkip={handleSkipCalibrationIntro}
      />

      <main className="app-shell__page practice-screen">
        <div className="practice-screen__container">
          {summary ? (
            <ResultsSummaryHeader
              summary={summary}
              level={displayedSummaryLevel}
              levelLabel={displayedSummaryLevelLabel}
              xpProgressLabel={displayedResultsXp?.xpProgressLabel ?? resultsXpFinalLabel}
              progressValue={shouldHoldAtReadinessGate
                ? finalLevelProgress.progressPercent
                : displayedResultsXp?.progressValue ?? displayedResultsProgress ?? resultsStartProgress}
              progressAnimate={shouldHoldAtReadinessGate ? false : displayedResultsXp?.animate}
              progressAnimationMode={displayedResultsXp?.animationMode}
              progressFlash={shouldHoldAtReadinessGate ? true : displayedResultsXp?.flash}
              xpProgressNotice={readinessGateProgressMessage ?? undefined}
              xpProgressBlocked={finalLevelProgress.isBlockedByReadinessGate && !shouldHoldAtReadinessGate}
              boostedXp={summaryBoostedXp}
            />
          ) : (
            <PracticeDifficultyRail items={difficultyItems} />
          )}

          {state.practiceState.syncMessage &&
          state.practiceState.syncState !== "pending_retry" &&
          state.practiceState.syncState !== "unavailable" ? (
            <Surface className="practice-alert-card">
              {state.practiceState.syncMessage}
            </Surface>
          ) : null}

          {!canLoadCase ? (
            <Surface className="practice-alert-card">
              Daily case limit reached for the current runtime rules. Practice loading is blocked until those rules
              change or progress resets.
            </Surface>
          ) : null}

          {summary ? (
            <ResultsSummaryCard
              summary={summary}
              caseItem={summary.caseData}
              showSummaryReferences={showSummaryReferences}
              showAbnormalHighlighting={showAbnormalHighlighting}
              onNextCase={handleNextCaseFromSummary}
              onOpenFeedback={handleOpenFeedback}
              storage={state.storage}
            />
          ) : currentCase ? (
            <ActivePracticeCase
              caseItem={currentCase}
              questions={currentCase.questions_flow ?? []}
              currentStepIndex={currentStepIndex}
              currentStep={currentStep}
              currentSelection={currentSelection as AnswerSelection | null}
              currentResult={currentResult}
              currentOptions={currentOptions}
              selectedAnswers={allowsClientSideFeedback ? [] : state.sessionState.selectedAnswers}
              stepResults={state.sessionState.stepResults}
              showAdvancedRanges={state.sessionState.showAdvancedRanges}
              showAbnormalHighlighting={showAbnormalHighlighting}
              onToggleAdvancedRanges={handleAdvancedRangesToggle}
              onAnswer={handleAnswer}
              onContinueStep={handleContinueStep}
              activeStepRef={activeStepRef}
              interactionDisabled={interactionLocked}
              interactionDisabledMessage={
                interactionLocked && !isSubmittingCase
                  ? PROTECTED_PRACTICE_MESSAGES.interactionLocked
                  : null
              }
              isSubmittingCase={isSubmittingCase}
              boostedXp={currentCaseBoostedXp}
            />
          ) : state.practiceState.syncState === "unavailable" ? (
            <Surface className="practice-alert-card">
              {state.practiceState.syncMessage ?? getProtectedPracticeUnavailableMessage()}
            </Surface>
          ) : (
            <div className="status-screen status-screen--loading">
              <div className="loading-chip" role="status" aria-live="polite">
                <span className="loading-chip__spinner" aria-hidden="true" />
                <span>Loading cases</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
