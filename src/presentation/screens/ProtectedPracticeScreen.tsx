import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import {
  getPracticeDifficultyMismatchAction,
  shouldConfirmDifficultySwitch,
  shouldShowPracticeIntro
} from "../../app/viewHelpers";
import { trackEvent } from "../../core/analytics";
import { openCaseFeedbackForm } from "../../core/feedback";
import { shouldShowMetricReferences } from "../../core/metrics";
import { buildConciseStepFeedback } from "../../core/explanations";
import {
  applyProtectedCaseCompletion,
  buildPendingPracticeSubmission,
  isProtectedPracticeError,
  prepareProtectedPracticeCases,
  submitProtectedPracticeCase
} from "../../core/protectedPractice";
import {
  clearPendingPracticeSubmission,
  loadPracticeSlotsCache,
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
  getAccessibleDifficultyKeys,
  getAwardableXp,
  getDifficultyLabel,
  getDifficultyMeta,
  getHighestAccessibleDifficultyKey,
  getLevelProgress,
  normalizeDifficultyKey,
  syncUserStateDerivedFields
} from "../../core/progression";
import {
  createEmptySeenCasesState,
  markCaseSeen,
  rememberRecentArchetype
} from "../../core/selection";
import type { AnswerSelection, IssuedPracticeSlot, StepResult } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { PracticeDifficultyRail } from "../practice/PracticeDifficultyRail";
import { PracticeIntroModal } from "../practice/PracticeIntroModal";
import { QuestionFlowCard } from "../practice/QuestionFlowCard";
import { ResultsSummaryCard, ResultsSummaryHeader } from "../practice/ResultsSummaryCard";
import { ScenarioCard } from "../practice/ScenarioCard";
import { ValuePanels } from "../practice/ValuePanels";
import { ErrorView, LoadingView } from "../shared/StatusViews";

function isExpiredSlot(slot: IssuedPracticeSlot | null | undefined) {
  if (!slot?.expiresAt) return true;
  return new Date(slot.expiresAt).getTime() <= Date.now();
}

function getProtectedPracticeUnavailableMessage() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You're offline. Reconnect to load a new case.";
  }

  return "Protected practice temporarily unavailable.";
}

export function ProtectedPracticeScreen() {
  const { state, setUserState, patchPracticeState, patchSessionState } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [recentArchetypes, setRecentArchetypes] = useState<string[]>([]);
  const [introOpen, setIntroOpen] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<string | null>(null);
  const [displayedResultsProgress, setDisplayedResultsProgress] = useState<number | null>(null);
  const activeStepRef = useRef<HTMLButtonElement | null>(null);
  const introAcceptedRef = useRef(false);
  const difficultyReconciledRef = useRef(false);

  const payload = state.payload;
  const progressionInput = {
    progressionConfig: payload?.progressionConfig ?? null,
    dashboardState: payload?.dashboardState ?? null,
    defaultUserState: payload?.defaultUserState ?? null,
    userState: state.userState,
    cases: []
  };
  const defaultDifficulty = getHighestAccessibleDifficultyKey(progressionInput);
  const hasExplicitDifficultyParam = searchParams.has("difficulty");
  const requestedDifficulty = searchParams.get("difficulty") ?? defaultDifficulty;
  const normalizedDifficulty = normalizeDifficultyKey(progressionInput, requestedDifficulty);
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
  const currentOptions = currentStep?.options ?? [];
  const totalSteps = currentCase?.questions_flow?.length ?? 0;
  const isFinalStep = currentStepIndex >= Math.max(0, totalSteps - 1);
  const currentSelection = !allowsClientSideFeedback && isFinalStep && !currentResult
    ? state.sessionState.selectedAnswers[currentStepIndex] ?? null
    : null;
  const hasAnsweredSteps = allowsClientSideFeedback
    ? state.sessionState.stepResults.some(result => Boolean(result))
    : state.sessionState.selectedAnswers.some(result => Boolean(result));
  const showSummaryReferences = Boolean(summary && shouldShowMetricReferences(summary.caseData, state.sessionState.showAdvancedRanges));
  const currentDifficultyLevel = Number(currentCase?.difficulty_level ?? summary?.caseData.difficulty_level ?? 1);
  const showAbnormalHighlighting = currentDifficultyLevel <= 3;
  const shouldAutoLoadPracticeCase = !currentCase && !summary && canLoadCase;
  const hasSeenPracticeIntro = state.storage?.loadPracticeIntroSeen() ?? false;
  const shouldOpenPracticeIntro = shouldShowPracticeIntro(hasSeenPracticeIntro, Boolean(currentCase), Boolean(summary));
  const finalLevelProgress = getLevelProgress(payload?.progressionConfig ?? null, state.userState);
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
  const resultsStartProgress = summary && preAwardUserState.level !== state.userState.level ? 0 : startingLevelProgress.progressPercent;
  const interactionLocked = Boolean(
    state.practiceState.pendingSubmission &&
    state.practiceState.pendingSubmission.caseToken === state.practiceState.currentCaseToken
  );
  const isSubmittingCase =
    state.practiceState.syncState === "submitting" &&
    state.practiceState.pendingSubmission?.caseToken === state.practiceState.currentCaseToken;

  useEffect(() => {
    if (requestedDifficulty !== normalizedDifficulty) {
      setSearchParams({ difficulty: normalizedDifficulty }, { replace: true });
    }
  }, [normalizedDifficulty, requestedDifficulty, setSearchParams]);

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
    activeStepRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [currentStepIndex, normalizedDifficulty]);

  useEffect(() => {
    if (!summary) {
      setDisplayedResultsProgress(null);
      return;
    }

    setDisplayedResultsProgress(resultsStartProgress);
    const timeoutId = window.setTimeout(() => {
      setDisplayedResultsProgress(finalLevelProgress.progressPercent);
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [summary?.caseId, resultsStartProgress, finalLevelProgress.progressPercent]);

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
        syncMessage: "Protected practice is unavailable until Supabase is configured."
      });
      return {};
    }

    const missingDifficulties = difficulties.filter(difficultyKey => {
      const cachedSlot = state.practiceState.practiceSlotsByDifficulty[difficultyKey];
      return !cachedSlot ||
        !slotMatchesDifficultyKey(cachedSlot, difficultyKey) ||
        cachedSlot.contentVersion !== payload.contentVersion ||
        isExpiredSlot(cachedSlot);
    });

    if (!missingDifficulties.length) {
      return state.practiceState.practiceSlotsByDifficulty;
    }

    patchPracticeState({
      syncState: "loading_slots",
      syncMessage: null
    });

    try {
      const response = await prepareProtectedPracticeCases(state.runtimeConfig, state.supabase, {
        contentVersion: payload.contentVersion,
        difficulties: missingDifficulties,
        selectionHints: {
          seenCaseIdsByDifficulty: state.storage?.loadSeenCaseState() ?? createEmptySeenCasesState(),
          recentArchetypes
        }
      });

      const nextSlots = {
        ...loadPracticeSlotsCache(window.localStorage, response.contentVersion),
        ...state.practiceState.practiceSlotsByDifficulty,
        ...response.slots
      };
      for (const difficultyKey of Object.keys(nextSlots)) {
        if (!slotMatchesDifficultyKey(nextSlots[difficultyKey], difficultyKey)) {
          nextSlots[difficultyKey] = null;
        }
      }
      savePracticeSlotsCache(window.localStorage, nextSlots);
      patchPracticeState({
        practiceSlotsByDifficulty: nextSlots,
        syncState: "idle",
        syncMessage: null
      });
      return nextSlots;
    } catch (error) {
      const hasAnyCachedSlot = difficulties.some(difficultyKey => Boolean(state.practiceState.practiceSlotsByDifficulty[difficultyKey]));
      patchPracticeState({
        syncState: hasAnyCachedSlot ? "idle" : "unavailable",
        syncMessage: hasAnyCachedSlot
          ? "Unable to refresh protected case slots right now."
          : getProtectedPracticeUnavailableMessage()
      });
      return state.practiceState.practiceSlotsByDifficulty;
    }
  }

  useEffect(() => {
    if (!payload?.contentVersion || !state.runtimeConfig?.ENABLE_PROTECTED_CASE_DELIVERY) return;
    if (!accessibleDifficulties.length) return;
    void fetchSlotsForDifficulties(accessibleDifficulties);
  }, [
    accessibleDifficulties.join("|"),
    payload?.contentVersion,
    recentArchetypes.join("|"),
    state.runtimeConfig?.ENABLE_PROTECTED_CASE_DELIVERY
  ]);

  useEffect(() => {
    if (!shouldAutoLoadPracticeCase) return;
    if (introAcceptedRef.current) {
      introAcceptedRef.current = false;
      return;
    }

    if (shouldOpenPracticeIntro) {
      if (!introOpen || pendingDifficulty !== normalizedDifficulty) {
        setPendingDifficulty(normalizedDifficulty);
        setIntroOpen(true);
      }
      if (!currentCase) {
        void beginCase(normalizedDifficulty, { preview: true, confirmAbandon: false });
      }
      return;
    }

    void beginCase(normalizedDifficulty);
  }, [currentCase, introOpen, normalizedDifficulty, pendingDifficulty, shouldAutoLoadPracticeCase, shouldOpenPracticeIntro]);

  async function activateSlot(difficultyKey: string, slot: IssuedPracticeSlot, options?: { preview?: boolean }) {
    if (!slotMatchesDifficultyKey(slot, difficultyKey)) {
      patchPracticeState({
        currentCase: null,
        currentCaseToken: null,
        currentCaseExpiresAt: null,
        syncState: "unavailable",
        syncMessage: "The selected case did not match the requested difficulty. Please try again."
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
      stepOptionOverrides: {},
      caseStartMs: options?.preview ? null : Date.now()
    });
    setRecentArchetypes(previous => rememberRecentArchetype(previous, slot.caseData));
    if (!options?.preview) {
      trackEvent("case_started", {
        case_id: slot.caseData.case_id,
        archetype: slot.caseData.archetype,
        difficulty: difficultyKey
      });
    }
  }

  function activatePreviewedSlot(difficultyKey: string) {
    if (!currentCase) return;

    patchSessionState({
      currentDifficulty: difficultyKey,
      caseStartMs: Date.now()
    });
    trackEvent("case_started", {
      case_id: currentCase.case_id,
      archetype: currentCase.archetype,
      difficulty: difficultyKey
    });
  }

  async function beginCase(difficultyKey: string, options?: { confirmAbandon?: boolean; preview?: boolean }) {
    const nextDifficulty = normalizeDifficultyKey(progressionInput, difficultyKey);
    const shouldConfirmAbandon = options?.confirmAbandon ?? true;

    if (shouldConfirmAbandon && currentCase && !summary && hasAnsweredSteps) {
      const confirmed = window.confirm("Start a new case? Your current case progress will be lost.");
      if (!confirmed) return;
      await markAbandonedCase();
    }

    const slots = await fetchSlotsForDifficulties([nextDifficulty]);
    const slot = slots[nextDifficulty];
    if (!slot || isExpiredSlot(slot)) {
      patchPracticeState({
        syncState: "unavailable",
        syncMessage: getProtectedPracticeUnavailableMessage()
      });
      return;
    }

    await activateSlot(nextDifficulty, slot, { preview: options?.preview });
  }

  function requestCaseStart(difficultyKey: string) {
    if (!state.storage?.loadPracticeIntroSeen()) {
      setPendingDifficulty(difficultyKey);
      setIntroOpen(true);
      return;
    }

    void beginCase(difficultyKey);
  }

  function handleContinueFromIntro() {
    state.storage?.savePracticeIntroSeen(true);
    const nextDifficulty = pendingDifficulty ?? normalizedDifficulty;
    introAcceptedRef.current = true;
    setIntroOpen(false);
    setPendingDifficulty(null);
    if (currentCase && !summary && activeCaseDifficulty === nextDifficulty) {
      activatePreviewedSlot(nextDifficulty);
      return;
    }
    void beginCase(nextDifficulty);
  }

  async function handleDifficultyChange(nextDifficulty: string) {
    const nextNormalizedDifficulty = normalizeDifficultyKey(progressionInput, nextDifficulty);
    const hasActiveUnfinishedCase = Boolean(currentCase && !summary);

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
    await beginCase(nextNormalizedDifficulty, { confirmAbandon: false });
  }

  function handleAdvancedRangesToggle() {
    const nextValue = !state.sessionState.showAdvancedRanges;
    patchSessionState({ showAdvancedRanges: nextValue });
    state.storage?.saveAdvancedRangesPreference(nextValue);
  }

  function handleAnswer(option: string) {
    if (!currentStep || !currentCase || currentResult || interactionLocked) return;

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

      trackEvent("step_answered", {
        case_id: currentCase.case_id,
        step: currentStep.key,
        correct: nextResults[currentStepIndex]?.correct
      });
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
        trackEvent("step_answered", {
          case_id: currentCase.case_id,
          step: currentStep.key,
          correct: true
        });
        return;
      }

      patchSessionState({
        selectedAnswers: nextSelections,
        currentStepIndex: currentStepIndex + 1
      });
      trackEvent("step_answered", {
        case_id: currentCase.case_id,
        step: currentStep.key,
        correct: true
      });
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
    trackEvent("step_answered", {
      case_id: currentCase.case_id,
      step: currentStep.key,
      correct: false
    });
  }

  async function submitCase(selectedAnswersOverride?: AnswerSelection[]) {
    if (!currentCase || !state.practiceState.currentCaseToken || !payload?.contentVersion || !state.supabase || !state.runtimeConfig) {
      return;
    }

    const answers = allowsClientSideFeedback
      ? state.sessionState.stepResults
          .filter((result): result is StepResult => Boolean(result))
          .map(result => ({ key: result.key, chosen: result.chosen }))
      : (selectedAnswersOverride ?? state.sessionState.selectedAnswers).map(selection => ({
          key: selection.key,
          chosen: selection.chosen
        }));

    if (answers.length !== totalSteps) {
      patchPracticeState({
        syncMessage: "Please answer all steps before submitting."
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
      const reconciledSummary = reconcileProtectedSummaryWithLockedStepResults({
        summary: {
          ...result.summary,
          caseToken: pendingSubmission.caseToken
        },
        lockedStepResults: state.sessionState.stepResults,
        progressionConfig: payload.progressionConfig ?? null
      });
      const cappedSummary = {
        ...reconciledSummary,
        totalXpAward: getAwardableXp(payload.progressionConfig ?? null, state.userState.xp, reconciledSummary.totalXpAward)
      };
      const nextUserState = applyProtectedCaseCompletion({
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
      savePracticeSlotsCache(window.localStorage, nextSlots);
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

      trackEvent("case_completed", {
        case_id: currentCase.case_id,
        archetype: currentCase.archetype,
        difficulty: normalizedDifficulty,
        accuracy: result.summary.accuracy,
        elapsed_seconds: Math.round(elapsedSeconds)
      });
    } catch (error) {
      if (isProtectedPracticeError(error) && error.code === "CASE_TOKEN_EXPIRED") {
        const nextSlots = {
          ...state.practiceState.practiceSlotsByDifficulty,
          [normalizedDifficulty]: null
        };
        savePracticeSlotsCache(window.localStorage, nextSlots);
        clearPendingPracticeSubmission(window.localStorage);
        patchPracticeState({
          currentCase: null,
          currentCaseToken: null,
          currentCaseExpiresAt: null,
          practiceSlotsByDifficulty: nextSlots,
          pendingSubmission: null,
          syncState: "idle",
          syncMessage: "This case expired before it could be checked. Please start a new one."
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
        syncMessage: "Your answers are saved. We’ll complete this case automatically once it reconnects."
      });
    }
  }

  function handleContinueStep() {
    if (interactionLocked) return;

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

  return (
    <>
      <PracticeIntroModal
        open={introOpen}
        onContinue={handleContinueFromIntro}
      />

      <main className="app-shell__page practice-screen">
        <div className="practice-screen__container">
          {summary ? (
            <ResultsSummaryHeader
              summary={summary}
              level={state.userState.level}
              xpProgressLabel={`${finalLevelProgress.xpIntoLevel} / ${finalLevelProgress.xpForNextLevel || finalLevelProgress.xpIntoLevel} XP`}
              progressValue={displayedResultsProgress ?? resultsStartProgress}
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
              onNextCase={() => requestCaseStart(normalizedDifficulty)}
              onOpenFeedback={handleOpenFeedback}
              storage={state.storage}
            />
          ) : currentCase ? (
            <div className="practice-stage">
              <div className="practice-stage__sidebar">
                <div className="practice-stage__sticky">
                  <ScenarioCard clinicalStem={currentCase.clinical_stem} />
                  <ValuePanels
                    caseItem={currentCase}
                    showAdvancedRanges={state.sessionState.showAdvancedRanges}
                    showAbnormalHighlighting={showAbnormalHighlighting}
                    onToggleAdvancedRanges={handleAdvancedRangesToggle}
                  />
                </div>
              </div>

              <div className="practice-stage__main">
                <QuestionFlowCard
                  caseItem={currentCase}
                  questions={currentCase.questions_flow ?? []}
                  currentStepIndex={currentStepIndex}
                  currentStep={currentStep}
                  currentSelection={currentSelection as AnswerSelection | null}
                  currentResult={currentResult}
                  currentOptions={currentOptions}
                  selectedAnswers={allowsClientSideFeedback ? [] : state.sessionState.selectedAnswers}
                  stepResults={state.sessionState.stepResults}
                  onAnswer={handleAnswer}
                  onContinueStep={handleContinueStep}
                  activeStepRef={activeStepRef}
                  interactionDisabled={interactionLocked}
                  interactionDisabledMessage={
                    interactionLocked && !isSubmittingCase
                      ? "We're finishing your submission. This case is locked for now."
                      : null
                  }
                  isSubmittingCase={isSubmittingCase}
                />
              </div>
            </div>
          ) : state.practiceState.syncState === "unavailable" ? (
            <Surface className="practice-alert-card">
              {getProtectedPracticeUnavailableMessage()}
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
