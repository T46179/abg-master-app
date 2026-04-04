import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { shouldConfirmDifficultySwitch, shouldShowPracticeIntro } from "../../app/viewHelpers";
import { trackEvent } from "../../core/analytics";
import { openCaseFeedbackForm } from "../../core/feedback";
import { shouldShowMetricReferences } from "../../core/metrics";
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
  savePendingPracticeSubmission,
  savePracticeSlotsCache
} from "../../core/protectedPracticeCache";
import { canUseClientSidePracticeFeedback, getCorrectAnswer, isCorrectAnswer, prettyStepLabel } from "../../core/practice";
import {
  canStartNewCase,
  getAccessibleDifficultyKeys,
  getDifficultyLabel,
  getDifficultyMeta,
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
import { ProgressBar } from "../primitives/ProgressBar";
import { Surface } from "../primitives/Surface";
import { PracticeDifficultyRail } from "../practice/PracticeDifficultyRail";
import { PracticeIntroModal } from "../practice/PracticeIntroModal";
import { QuestionFlowCard } from "../practice/QuestionFlowCard";
import { ResultsSummaryCard } from "../practice/ResultsSummaryCard";
import { ScenarioCard } from "../practice/ScenarioCard";
import { ValuePanels } from "../practice/ValuePanels";
import { ErrorView, LoadingView } from "../shared/StatusViews";

function isExpiredSlot(slot: IssuedPracticeSlot | null | undefined) {
  if (!slot?.expiresAt) return true;
  return new Date(slot.expiresAt).getTime() <= Date.now();
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

  const payload = state.payload;
  const progressionInput = {
    progressionConfig: payload?.progressionConfig ?? null,
    dashboardState: payload?.dashboardState ?? null,
    defaultUserState: payload?.defaultUserState ?? null,
    userState: state.userState,
    cases: []
  };
  const requestedDifficulty = searchParams.get("difficulty") ?? state.sessionState.currentDifficulty;
  const normalizedDifficulty = normalizeDifficultyKey(progressionInput, requestedDifficulty);
  const difficultyMeta = getDifficultyMeta(progressionInput);
  const accessibleDifficulties = getAccessibleDifficultyKeys(progressionInput);
  const canLoadCase = canStartNewCase(progressionInput);
  const currentCase = state.practiceState.currentCase;
  const summary = state.practiceState.lastCaseSummary;
  const currentStepIndex = state.sessionState.currentStepIndex;
  const currentStep = currentCase?.questions_flow?.[currentStepIndex] ?? null;
  const allowsClientSideFeedback = canUseClientSidePracticeFeedback(currentCase);
  const currentSelection = allowsClientSideFeedback ? null : state.sessionState.selectedAnswers[currentStepIndex] ?? null;
  const currentResult = allowsClientSideFeedback ? state.sessionState.stepResults[currentStepIndex] ?? null : null;
  const currentOptions = currentStep?.options ?? [];
  const totalSteps = currentCase?.questions_flow?.length ?? 0;
  const hasAnsweredSteps = state.sessionState.stepResults.some(result => Boolean(result));
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

  useEffect(() => {
    if (requestedDifficulty !== normalizedDifficulty) {
      setSearchParams({ difficulty: normalizedDifficulty }, { replace: true });
    }
  }, [normalizedDifficulty, requestedDifficulty, setSearchParams]);

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
      return !cachedSlot || cachedSlot.contentVersion !== payload.contentVersion || isExpiredSlot(cachedSlot);
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
          : "Protected practice temporarily unavailable."
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
      return;
    }

    void beginCase(normalizedDifficulty);
  }, [currentCase, introOpen, normalizedDifficulty, pendingDifficulty, shouldAutoLoadPracticeCase, shouldOpenPracticeIntro]);

  async function activateSlot(difficultyKey: string, slot: IssuedPracticeSlot) {
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
      caseStartMs: Date.now()
    });
    setRecentArchetypes(previous => rememberRecentArchetype(previous, slot.caseData));
    trackEvent("case_started", {
      case_id: slot.caseData.case_id,
      archetype: slot.caseData.archetype,
      difficulty: difficultyKey
    });
  }

  async function beginCase(difficultyKey: string, options?: { confirmAbandon?: boolean }) {
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
        syncMessage: "Protected practice temporarily unavailable."
      });
      return;
    }

    await activateSlot(nextDifficulty, slot);
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
        correct: isCorrectAnswer(currentCase, currentStep.key, option)
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
    patchSessionState({
      selectedAnswers: nextSelections
    });
  }

  async function submitCase() {
    if (!currentCase || !state.practiceState.currentCaseToken || !payload?.contentVersion || !state.supabase || !state.runtimeConfig) {
      return;
    }

    const answers = allowsClientSideFeedback
      ? state.sessionState.stepResults
          .filter((result): result is StepResult => Boolean(result))
          .map(result => ({ key: result.key, chosen: result.chosen }))
      : (currentCase.questions_flow ?? []).map((step, index) => {
          const selection = state.sessionState.selectedAnswers[index];
          return selection ? { key: step.key, chosen: selection.chosen } : null;
        }).filter((answer): answer is { key: string; chosen: string } => Boolean(answer));

    if (answers.length !== totalSteps) {
      patchPracticeState({
        syncMessage: "Answer every step before submitting the case."
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
      syncMessage: "Submitting your answers for protected grading."
    });

    try {
      const result = await submitProtectedPracticeCase(state.runtimeConfig, state.supabase, pendingSubmission);
      const nextUserState = applyProtectedCaseCompletion({
        userState: state.userState,
        summary: {
          ...result.summary,
          caseToken: pendingSubmission.caseToken
        },
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
        lastCaseSummary: {
          ...result.summary,
          caseToken: pendingSubmission.caseToken
        },
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
          syncMessage: "This case expired before it could be graded. Start a fresh case."
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
        syncMessage: "Your answers are saved locally. The case is not complete yet, and we will retry automatically."
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
            <Surface className="dashboard-progress-card">
              <div className="dashboard-progress-card__meta">
                <span>Level {state.userState.level}</span>
                <span>{finalLevelProgress.xpIntoLevel} / {finalLevelProgress.xpForNextLevel || finalLevelProgress.xpIntoLevel} XP</span>
              </div>
              <ProgressBar value={displayedResultsProgress ?? resultsStartProgress} animate />
            </Surface>
          ) : (
            <PracticeDifficultyRail items={difficultyItems} />
          )}

          {state.practiceState.syncMessage ? (
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
                  interactionDisabledMessage={interactionLocked ? "Protected grading retry is in progress. This case is locked until sync finishes." : null}
                />
              </div>
            </div>
          ) : state.practiceState.syncState === "unavailable" ? (
            <Surface className="practice-alert-card">
              Protected practice temporarily unavailable.
            </Surface>
          ) : (
            <Surface className="practice-alert-card">
              No protected case is ready for this difficulty yet. Try again in a moment.
            </Surface>
          )}
        </div>
      </main>
    </>
  );
}
