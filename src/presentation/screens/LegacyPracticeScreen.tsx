import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { shouldConfirmDifficultySwitch, shouldShowPracticeIntro } from "../../app/viewHelpers";
import { trackEvent } from "../../core/analytics";
import { createAttemptRecord } from "../../core/attempts";
import { buildConciseStepFeedback } from "../../core/explanations";
import { openCaseFeedbackForm } from "../../core/feedback";
import { shouldShowMetricReferences } from "../../core/metrics";
import {
  applyPracticeOutcome,
  buildFinalStepResults,
  canUseClientSidePracticeFeedback,
  getCorrectAnswer,
  isCorrectAnswer,
  prettyStepLabel
} from "../../core/practice";
import {
  buildStepOptionOverrides,
  createEmptySeenCasesState,
  getEligibleCasesForDifficulty,
  pickRandom,
  rememberRecentArchetype
} from "../../core/selection";
import {
  canStartNewCase,
  getAccessibleDifficultyKeys,
  getDifficultyLabel,
  getHighestAccessibleDifficultyKey,
  getLevelProgress,
  getDifficultyMeta,
  normalizeDifficultyKey,
  syncUserStateDerivedFields
} from "../../core/progression";
import type { StepResult } from "../../core/types";
import { Surface } from "../primitives/Surface";
import { PracticeDifficultyRail } from "../practice/PracticeDifficultyRail";
import { PracticeIntroModal } from "../practice/PracticeIntroModal";
import { QuestionFlowCard } from "../practice/QuestionFlowCard";
import { ResultsSummaryCard, ResultsSummaryHeader } from "../practice/ResultsSummaryCard";
import { ScenarioCard } from "../practice/ScenarioCard";
import { ValuePanels } from "../practice/ValuePanels";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function LegacyPracticeScreen() {
  const { state, setUserState, patchSessionState, patchPracticeState } = useAppContext();
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
    cases: payload?.cases ?? []
  };

  const defaultDifficulty = getHighestAccessibleDifficultyKey(progressionInput);
  const requestedDifficulty = searchParams.get("difficulty") ?? defaultDifficulty;
  const normalizedDifficulty = normalizeDifficultyKey(progressionInput, requestedDifficulty);
  const difficultyMeta = getDifficultyMeta(progressionInput);
  const finalLevelProgress = getLevelProgress(payload?.progressionConfig ?? null, state.userState);
  const accessibleDifficulties = getAccessibleDifficultyKeys(progressionInput);
  const canLoadCase = canStartNewCase(progressionInput);
  const currentCase = state.practiceState.currentCase;
  const summary = state.practiceState.lastCaseSummary;
  const currentStepIndex = state.sessionState.currentStepIndex;
  const currentStep = currentCase?.questions_flow?.[currentStepIndex] ?? null;
  const allowsClientSideFeedback = canUseClientSidePracticeFeedback(currentCase);
  const currentResult = state.sessionState.stepResults[currentStepIndex] ?? null;
  const currentOptions = currentStep
    ? state.sessionState.stepOptionOverrides[currentStepIndex] ?? currentStep.options ?? []
    : [];
  const totalSteps = currentCase?.questions_flow?.length ?? 0;
  const isFinalStep = currentStepIndex >= Math.max(0, totalSteps - 1);
  const currentSelection = !allowsClientSideFeedback && isFinalStep && !currentResult
    ? state.sessionState.selectedAnswers[currentStepIndex] ?? null
    : null;
  const hasAnsweredSteps = allowsClientSideFeedback
    ? state.sessionState.stepResults.some(result => Boolean(result))
    : state.sessionState.selectedAnswers.some(result => Boolean(result));
  const activeCaseDifficulty = currentCase
    ? getDifficultyLabel(payload?.progressionConfig ?? null, Number(currentCase.difficulty_level ?? 1))
    : normalizedDifficulty;
  const currentDifficultyLevel = Number(currentCase?.difficulty_level ?? summary?.caseData.difficulty_level ?? 1);
  const showAbnormalHighlighting = currentDifficultyLevel <= 3;
  const shouldAutoLoadPracticeCase = !currentCase && !summary && canLoadCase && Boolean(payload?.cases.length);
  const hasSeenPracticeIntro = state.storage?.loadPracticeIntroSeen() ?? false;
  const shouldOpenPracticeIntro = shouldShowPracticeIntro(hasSeenPracticeIntro, Boolean(currentCase), Boolean(summary));
  const showSummaryReferences = Boolean(summary && shouldShowMetricReferences(summary.caseData, state.sessionState.showAdvancedRanges));
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
  const resultsStartProgress = summary && preAwardUserState.level !== state.userState.level
    ? 0
    : startingLevelProgress.progressPercent;

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
        void loadCaseForDifficulty(normalizedDifficulty, { preview: true });
      }
      return;
    }

    void beginCase(normalizedDifficulty);
  }, [currentCase, introOpen, normalizedDifficulty, pendingDifficulty, shouldAutoLoadPracticeCase, shouldOpenPracticeIntro]);

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

  async function updateUserState(nextUserState: typeof state.userState) {
    await setUserState(nextUserState);
  }

  async function markAbandonedCase() {
    const nextUserState = {
      ...state.userState,
      abandonedCases: state.userState.abandonedCases + 1
    };
    await updateUserState(nextUserState);
  }

  async function loadCaseForDifficulty(difficultyKey: string, options?: { preview?: boolean }) {
    const nextDifficulty = normalizeDifficultyKey(progressionInput, difficultyKey);

    if (!payload?.cases.length || !canLoadCase) {
      patchPracticeState({ currentCase: null, lastCaseSummary: null });
      patchSessionState({
        currentDifficulty: nextDifficulty,
        currentStepIndex: 0,
        selectedAnswers: [],
        stepResults: [],
        stepOptionOverrides: {},
        caseStartMs: null
      });
      return;
    }

    const seenCasesByDifficulty = state.storage?.loadSeenCaseState() ?? createEmptySeenCasesState();
    const eligibleCases = getEligibleCasesForDifficulty({
      cases: payload.cases,
      difficultyKey: nextDifficulty,
      progressionConfig: payload.progressionConfig ?? null,
      seenCasesByDifficulty,
      recentArchetypes
    });

    const nextCase = pickRandom(eligibleCases);
    if (!nextCase) {
      patchPracticeState({ currentCase: null, lastCaseSummary: null });
      patchSessionState({
        currentDifficulty: nextDifficulty,
        currentStepIndex: 0,
        selectedAnswers: [],
        stepResults: [],
        stepOptionOverrides: {},
        caseStartMs: null
      });
      return;
    }

    patchPracticeState({ currentCase: nextCase, lastCaseSummary: null });
    patchSessionState({
      currentDifficulty: nextDifficulty,
      currentStepIndex: 0,
      selectedAnswers: [],
      stepResults: [],
      stepOptionOverrides: buildStepOptionOverrides(nextCase, payload.cases),
      caseStartMs: options?.preview ? null : Date.now()
    });
    setRecentArchetypes(previous => rememberRecentArchetype(previous, nextCase));
    if (!options?.preview) {
      trackEvent("case_started", {
        case_id: nextCase.case_id,
        archetype: nextCase.archetype,
        difficulty: nextDifficulty
      });
    }
  }

  function activateLoadedCase(difficultyKey: string) {
    if (!currentCase) return;

    const nextDifficulty = normalizeDifficultyKey(progressionInput, difficultyKey);
    patchSessionState({
      currentDifficulty: nextDifficulty,
      caseStartMs: Date.now()
    });
    trackEvent("case_started", {
      case_id: currentCase.case_id,
      archetype: currentCase.archetype,
      difficulty: nextDifficulty
    });
  }

  async function beginCase(difficultyKey: string) {
    const nextDifficulty = normalizeDifficultyKey(progressionInput, difficultyKey);

    if (currentCase && !summary) {
      const confirmed = window.confirm("Start a new case? Your current case progress will be lost.");
      if (!confirmed) return;
      await markAbandonedCase();
    }

    await loadCaseForDifficulty(nextDifficulty);
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
    if (currentCase && !summary) {
      activateLoadedCase(nextDifficulty);
      return;
    }
    void beginCase(nextDifficulty);
  }

  async function handleDifficultyChange(nextDifficulty: string) {
    const nextNormalizedDifficulty = normalizeDifficultyKey(progressionInput, nextDifficulty);
    const fromDifficulty = activeCaseDifficulty;
    const hasActiveUnfinishedCase = Boolean(currentCase && !summary);

    if (shouldConfirmDifficultySwitch(hasActiveUnfinishedCase, hasAnsweredSteps)) {
      const confirmed = window.confirm("Switch difficulty and load a new case? Your current case progress will be lost.");
      trackEvent("practice_difficulty_changed", {
        from_difficulty: fromDifficulty,
        to_difficulty: nextNormalizedDifficulty,
        had_answers: true,
        confirmed
      });

      if (!confirmed) return;

      await markAbandonedCase();
      trackEvent("case_abandoned", {
        case_id: currentCase?.case_id,
        archetype: currentCase?.archetype,
        from_difficulty: fromDifficulty,
        to_difficulty: nextNormalizedDifficulty,
        reason: "difficulty_switch"
      });
    } else {
      trackEvent("practice_difficulty_changed", {
        from_difficulty: fromDifficulty,
        to_difficulty: nextNormalizedDifficulty,
        had_answers: hasAnsweredSteps,
        confirmed: true
      });
    }

    setSearchParams({ difficulty: nextNormalizedDifficulty });
    await loadCaseForDifficulty(nextNormalizedDifficulty);
  }

  function handleAdvancedRangesToggle() {
    const nextValue = !state.sessionState.showAdvancedRanges;
    patchSessionState({ showAdvancedRanges: nextValue });
    state.storage?.saveAdvancedRangesPreference(nextValue);
  }

  function handleAnswer(option: string) {
    if (!currentCase || !currentStep || currentResult || currentSelection) return;

    if (!allowsClientSideFeedback) {
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
          patchSessionState({ selectedAnswers: nextSelections });
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
        correct: false,
        feedback: null
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
      return;
    }

    const stepResult: StepResult = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen: option,
      correctAnswer: getCorrectAnswer(currentCase, currentStep.key),
      correct: isCorrectAnswer(currentCase, currentStep.key, option),
      feedback: buildConciseStepFeedback(currentCase, currentStep.key)
    };

    const nextResults = [...state.sessionState.stepResults];
    nextResults[currentStepIndex] = stepResult;
    patchSessionState({ stepResults: nextResults });

    trackEvent("step_answered", {
      case_id: currentCase.case_id,
      step: currentStep.key,
      correct: stepResult.correct
    });
  }

  async function finishCase(selectedAnswersOverride?: typeof state.sessionState.selectedAnswers) {
    if (!currentCase) return;

    const elapsedSeconds = state.sessionState.caseStartMs
      ? Math.max(0, (Date.now() - state.sessionState.caseStartMs) / 1000)
      : 0;
    const stepResults = allowsClientSideFeedback
      ? state.sessionState.stepResults.filter((result): result is StepResult => Boolean(result))
      : buildFinalStepResults({
          caseItem: currentCase,
          selectedAnswers: selectedAnswersOverride ?? state.sessionState.selectedAnswers,
          existingStepResults: state.sessionState.stepResults
        });
    const seenCasesByDifficulty = state.storage?.loadSeenCaseState() ?? createEmptySeenCasesState();
    const outcome = applyPracticeOutcome({
      caseItem: currentCase,
      userState: state.userState,
      progressionConfig: payload?.progressionConfig ?? null,
      seenCasesByDifficulty,
      stepResults,
      elapsedSeconds,
      timedMode: state.sessionState.timedMode
    });

    state.storage?.saveSeenCaseState(outcome.seenCasesByDifficulty);
    await updateUserState(outcome.userState);
    await state.storage?.saveAttempt(createAttemptRecord({
      userId: state.userId ?? null,
      caseItem: currentCase,
      difficultyLabel: getDifficultyLabel(payload?.progressionConfig ?? null, Number(currentCase.difficulty_level ?? 1)),
      elapsedSeconds,
      correctSteps: outcome.summary.correctSteps,
      totalSteps: outcome.summary.totalSteps,
      totalXpAward: outcome.summary.totalXpAward,
      completedAt: new Date().toISOString(),
      stepResults,
      contentVersion: payload?.contentVersion ?? null
    }));

    patchPracticeState({ currentCase: null, lastCaseSummary: outcome.summary });
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
      accuracy: outcome.summary.accuracy,
      elapsed_seconds: Math.round(elapsedSeconds)
    });
  }

  function handleOpenFeedback() {
    if (!summary) return;
    const opened = openCaseFeedbackForm(summary);
    if (!opened) return;

    trackEvent("feedback_opened", {
      case_id: summary.caseId
    });
  }

  function handleContinueStep() {
    if (!currentCase) return;

    if (currentStepIndex < totalSteps - 1) {
      patchSessionState({ currentStepIndex: currentStepIndex + 1 });
      return;
    }

    void finishCase();
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
                  currentSelection={currentSelection}
                  currentResult={currentResult}
                  currentOptions={currentOptions}
                  selectedAnswers={allowsClientSideFeedback ? [] : state.sessionState.selectedAnswers}
                  stepResults={state.sessionState.stepResults}
                  onAnswer={handleAnswer}
                  onContinueStep={handleContinueStep}
                  activeStepRef={activeStepRef}
                />
              </div>
            </div>
          ) : (
            <Surface className="practice-alert-card">
              No case is currently available for this difficulty. Try another unlocked level or reset progress.
            </Surface>
          )}
        </div>
      </main>
    </>
  );
}
