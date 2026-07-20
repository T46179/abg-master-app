import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import {
  clearFeaturedCaseDraft,
  confirmFeaturedCaseOpen,
  FEATURED_CASE_DRAFT_VERSION,
  loadFeaturedCaseDraft,
  prepareFeaturedCase,
  saveFeaturedCaseDraft,
  submitFeaturedCase
} from "../../core/featuredCase";
import { isProtectedPracticeError } from "../../core/protectedPractice";
import { shouldShowMetricReferences } from "../../core/metrics";
import { buildConciseStepFeedback } from "../../core/explanations";
import {
  canUseClientSidePracticeFeedback,
  getCorrectAnswer,
  isCorrectAnswer,
  prettyStepLabel
} from "../../core/practice";
import type {
  AnswerSelection,
  AnswerValue,
  CaseData,
  CaseSummary,
  StepResult
} from "../../core/types";
import { ActivePracticeCase } from "../practice/ActivePracticeCase";
import { ResultsSummaryCard, ResultsSummaryHeader } from "../practice/ResultsSummaryCard";
import { Surface } from "../primitives/Surface";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function FeaturedCaseScreen() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<CaseData | null>(null);
  const [caseToken, setCaseToken] = useState<string | null>(null);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerSelection[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedRanges, setShowAdvancedRanges] = useState(
    () => state.storage?.loadAdvancedRangesPreference() ?? false
  );
  const caseStartRef = useRef(Date.now());
  const activeStepRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (state.status !== "ready") return;
    if (!state.runtimeConfig || !state.supabase || !state.payload?.featuredRelease?.releaseId) {
      setError("There is no current Featured Case.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    prepareFeaturedCase(state.runtimeConfig, state.supabase)
      .then(async result => {
        if (cancelled) return;
        const draft = loadFeaturedCaseDraft(window.localStorage, {
          userId: state.userId,
          releaseId: result.releaseId,
          caseToken: result.slot.caseToken
        });
        const maxStepIndex = Math.max(0, (result.slot.caseData.questions_flow?.length ?? 1) - 1);
        setReleaseId(result.releaseId);
        setCaseToken(result.slot.caseToken);
        setCaseItem(result.slot.caseData);
        setSelectedAnswers(draft?.selectedAnswers ?? []);
        setStepResults(draft?.stepResults ?? []);
        setCurrentStepIndex(Math.min(maxStepIndex, Math.max(0, draft?.currentStepIndex ?? 0)));
        caseStartRef.current = Date.now();
        setLoading(false);

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (!cancelled) {
          await confirmFeaturedCaseOpen(state.supabase!, result.slot.caseToken).catch(() => undefined);
        }
      })
      .catch(caught => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "The Featured Case could not be loaded.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    state.payload?.featuredRelease?.releaseId,
    state.runtimeConfig,
    state.status,
    state.supabase,
    state.userId
  ]);

  useEffect(() => {
    if (!releaseId || !caseToken || summary || loading) return;
    saveFeaturedCaseDraft(window.localStorage, {
      version: FEATURED_CASE_DRAFT_VERSION,
      userId: state.userId,
      releaseId,
      caseToken,
      currentStepIndex,
      selectedAnswers,
      stepResults,
      savedAt: new Date().toISOString()
    });
  }, [
    caseToken,
    currentStepIndex,
    loading,
    releaseId,
    selectedAnswers,
    state.userId,
    stepResults,
    summary
  ]);

  const questions = caseItem?.questions_flow ?? [];
  const currentStep = questions[currentStepIndex] ?? null;
  const allowsClientSideFeedback = canUseClientSidePracticeFeedback(caseItem);
  const currentResult = stepResults[currentStepIndex] ?? null;
  const currentSelection = !allowsClientSideFeedback && !currentResult
    ? selectedAnswers[currentStepIndex] ?? null
    : null;
  const currentOptions = currentStep?.options ?? [];
  const selectedValues = useMemo(
    () => Array.isArray(currentSelection?.chosen) ? currentSelection.chosen : [],
    [currentSelection]
  );
  const showAbnormalHighlighting = Number(caseItem?.difficulty_level ?? 1) <= 3;
  const showSummaryReferences = Boolean(
    summary && shouldShowMetricReferences(summary.caseData, showAdvancedRanges)
  );

  function updateSelection(chosen: AnswerValue): AnswerSelection[] {
    if (!currentStep) return selectedAnswers;
    const next = [...selectedAnswers];
    if (Array.isArray(chosen) && !chosen.length) {
      delete next[currentStepIndex];
    } else {
      next[currentStepIndex] = {
        key: currentStep.key,
        label: currentStep.label ?? prettyStepLabel(currentStep.key),
        prompt: currentStep.prompt,
        chosen
      };
    }
    setSelectedAnswers(next);
    return next;
  }

  async function finishCase(nextSelections: AnswerSelection[] = selectedAnswers) {
    if (!state.runtimeConfig || !state.supabase || !caseToken || !caseItem) return;
    const answers = allowsClientSideFeedback
      ? stepResults
          .filter((result): result is StepResult => Boolean(result))
          .map(result => ({ key: result.key, chosen: result.chosen }))
      : nextSelections
          .filter((selection): selection is AnswerSelection => Boolean(selection))
          .map(selection => ({ key: selection.key, chosen: selection.chosen }));
    if (answers.length !== questions.length) {
      setError("Answer every step before submitting the Featured Case.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFeaturedCase(state.runtimeConfig, state.supabase, {
        caseToken,
        answers,
        elapsedSeconds: Math.max(0, Math.round((Date.now() - caseStartRef.current) / 1000)),
        clientCompletedAt: new Date().toISOString()
      });
      clearFeaturedCaseDraft(window.localStorage);
      setSummary(result.summary);
    } catch (caught) {
      if (
        isProtectedPracticeError(caught) &&
        (caught.code === "FEATURED_RELEASE_RETIRED" || caught.code === "FEATURED_RESET_STALE")
      ) {
        clearFeaturedCaseDraft(window.localStorage);
      }
      setError(caught instanceof Error ? caught.message : "The Featured Case could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleAnswer(option: string) {
    if (!currentStep || !caseItem || currentResult || submitting) return;
    setError(null);

    if (currentStep.selection_mode === "multi") {
      const nextValues = selectedValues.includes(option)
        ? selectedValues.filter(value => value !== option)
        : [...selectedValues, option];
      updateSelection(nextValues);
      return;
    }

    if (allowsClientSideFeedback) {
      const nextResults = [...stepResults];
      nextResults[currentStepIndex] = {
        key: currentStep.key,
        label: currentStep.label ?? prettyStepLabel(currentStep.key),
        prompt: currentStep.prompt,
        chosen: option,
        correctAnswer: getCorrectAnswer(caseItem, currentStep.key),
        correct: isCorrectAnswer(caseItem, currentStep.key, option),
        feedback: buildConciseStepFeedback(caseItem, currentStep.key)
      };
      setStepResults(nextResults);
      setSelectedAnswers([]);
      return;
    }

    const nextSelections = updateSelection(option);
    const correctAnswer = getCorrectAnswer(caseItem, currentStep.key);
    const correct = isCorrectAnswer(caseItem, currentStep.key, option);

    if (correct) {
      if (currentStepIndex < questions.length - 1) {
        setCurrentStepIndex(index => index + 1);
      }
      return;
    }

    const nextResults = [...stepResults];
    nextResults[currentStepIndex] = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen: option,
      correctAnswer,
      correct: false
    };
    setSelectedAnswers(nextSelections);
    setStepResults(nextResults);
  }

  function handleContinueStep() {
    if (!currentStep || !caseItem || submitting) return;
    setError(null);

    if (currentStep.selection_mode === "multi" && !currentResult) {
      const selected = selectedAnswers[currentStepIndex] ?? null;
      const chosen: AnswerValue = Array.isArray(selected?.chosen) ? selected.chosen : [];
      if (!chosen.length) {
        setError("Answer every step before submitting the Featured Case.");
        return;
      }

      const correctAnswer = getCorrectAnswer(caseItem, currentStep.key);
      const correct = isCorrectAnswer(caseItem, currentStep.key, chosen);

      if (allowsClientSideFeedback) {
        const nextResults = [...stepResults];
        nextResults[currentStepIndex] = {
          key: currentStep.key,
          label: currentStep.label ?? prettyStepLabel(currentStep.key),
          prompt: currentStep.prompt,
          chosen,
          correctAnswer,
          correct,
          feedback: buildConciseStepFeedback(caseItem, currentStep.key)
        };
        setStepResults(nextResults);
        return;
      }

      if (correct) {
        if (currentStepIndex < questions.length - 1) {
          setCurrentStepIndex(index => index + 1);
          return;
        }
        void finishCase(selectedAnswers);
        return;
      }

      const nextResults = [...stepResults];
      nextResults[currentStepIndex] = {
        key: currentStep.key,
        label: currentStep.label ?? prettyStepLabel(currentStep.key),
        prompt: currentStep.prompt,
        chosen,
        correctAnswer,
        correct: false
      };
      setStepResults(nextResults);
      return;
    }

    if (currentStepIndex < questions.length - 1) {
      setCurrentStepIndex(index => index + 1);
      return;
    }

    void finishCase();
  }

  if (state.status === "idle" || state.status === "loading" || loading) return <LoadingView />;
  if (state.status === "error") return <ErrorView message={state.errorMessage} />;
  if (!caseItem || !caseToken || !releaseId) {
    return (
      <main className="app-shell__page practice-screen">
        <div className="practice-screen__container">
          <ErrorView message={error ?? "There is no current Featured Case."} />
          <Link className="figma-button figma-button--secondary" to="/dashboard">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  if (summary) {
    return (
      <main className="app-shell__page practice-screen">
        <div className="practice-screen__container">
          <ResultsSummaryHeader
            mode="featured"
            summary={summary}
            level={state.userState.level}
            xpProgressLabel=""
            progressValue={0}
          />
          <ResultsSummaryCard
            summary={summary}
            caseItem={summary.caseData}
            showSummaryReferences={showSummaryReferences}
            showAbnormalHighlighting={showAbnormalHighlighting}
            onNextCase={() => navigate("/dashboard")}
            primaryActionLabel="Back to dashboard"
            secondaryActionLabel="Retry Featured Case"
            secondaryActionHref="/featured-case?replay=1"
            storage={state.storage}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell__page practice-screen">
      <div className="practice-screen__container">
        {error ? <Surface className="practice-alert-card">{error}</Surface> : null}
        <ActivePracticeCase
          caseItem={caseItem}
          questions={questions}
          currentStepIndex={currentStepIndex}
          currentStep={currentStep}
          currentSelection={currentSelection}
          currentResult={currentResult}
          currentOptions={currentOptions}
          selectedAnswers={allowsClientSideFeedback ? [] : selectedAnswers}
          stepResults={stepResults}
          showAdvancedRanges={showAdvancedRanges}
          showAbnormalHighlighting={showAbnormalHighlighting}
          onToggleAdvancedRanges={() => {
            const next = !showAdvancedRanges;
            setShowAdvancedRanges(next);
            state.storage?.saveAdvancedRangesPreference(next);
          }}
          onAnswer={handleAnswer}
          onContinueStep={handleContinueStep}
          activeStepRef={activeStepRef}
          interactionDisabled={submitting}
          isSubmittingCase={submitting}
          lastStepButtonLabel="Submit Featured Case"
        />
      </div>
    </main>
  );
}
