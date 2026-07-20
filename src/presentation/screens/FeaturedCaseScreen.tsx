import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import {
  clearFeaturedCaseDraft,
  confirmFeaturedCaseOpen,
  ensureFeaturedCaseAnalyticsContext,
  FEATURED_CASE_DRAFT_VERSION,
  loadFeaturedCaseDraft,
  loadFeaturedCaseIntroSeen,
  prepareFeaturedCase,
  saveFeaturedCaseDraft,
  saveFeaturedCaseIntroSeen,
  submitFeaturedCase
} from "../../core/featuredCase";
import {
  buildFeaturedCaseEntryUrl,
  resolveFeaturedCaseEntry,
  trackFeaturedCaseEntry,
  trackFeaturedCaseMilestone,
  type FeaturedCaseAnalyticsContext,
  type FeaturedCaseAnalyticsPropertiesInput,
  type FeaturedCaseMilestone
} from "../../core/featuredCaseAnalytics";
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
  FeaturedCaseComparison,
  StepResult
} from "../../core/types";
import { ActivePracticeCase } from "../practice/ActivePracticeCase";
import { FeaturedCaseIntroModal } from "../practice/FeaturedCaseIntroModal";
import { ResultsSummaryCard, ResultsSummaryHeader } from "../practice/ResultsSummaryCard";
import { Surface } from "../primitives/Surface";
import { useElementViewed } from "../primitives/useElementViewed";
import { ErrorView, LoadingView } from "../shared/StatusViews";

export function FeaturedCaseScreen() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedEntry = useMemo(
    () => resolveFeaturedCaseEntry(searchParams),
    [searchParams]
  );
  const [caseItem, setCaseItem] = useState<CaseData | null>(null);
  const [caseToken, setCaseToken] = useState<string | null>(null);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerSelection[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [analyticsContext, setAnalyticsContext] = useState<FeaturedCaseAnalyticsContext | null>(null);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [comparison, setComparison] = useState<FeaturedCaseComparison | null>(null);
  const [summaryIsReplay, setSummaryIsReplay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSeenFeaturedIntro, setHasSeenFeaturedIntro] = useState(
    () => loadFeaturedCaseIntroSeen(window.localStorage)
  );
  const [focusCaseAfterIntro, setFocusCaseAfterIntro] = useState(false);
  const [showAdvancedRanges, setShowAdvancedRanges] = useState(
    () => state.storage?.loadAdvancedRangesPreference() ?? false
  );
  const caseStartRef = useRef(Date.now());
  const activeStepRef = useRef<HTMLButtonElement | null>(null);
  const emittedAnalyticsUuidsRef = useRef(new Set<string>());
  const introSeenAtLoadRef = useRef(hasSeenFeaturedIntro);

  useEffect(() => {
    if (state.status !== "ready") return;
    if (!state.runtimeConfig || !state.payload?.featuredRelease?.releaseId) {
      setError("There is no current Featured Case.");
      setLoading(false);
      return;
    }

    if (!state.supabase) {
      if (state.supabaseEnabled && !state.syncUnavailable) {
        setError(null);
        setLoading(true);
        return;
      }

      setError("Cloud access is unavailable. Please refresh and try again.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setLoading(true);
    prepareFeaturedCase(state.runtimeConfig, state.supabase)
      .then(async result => {
        if (cancelled) return;
        const expectedDraft = {
          userId: state.userId,
          releaseId: result.releaseId,
          caseToken: result.slot.caseToken
        };
        const savedDraft = loadFeaturedCaseDraft(window.localStorage, expectedDraft);
        const draft = await ensureFeaturedCaseAnalyticsContext(
          window.localStorage,
          expectedDraft,
          {
            entrySource: requestedEntry.entrySource,
            action: requestedEntry.action,
            isReplay: requestedEntry.isReplay,
            introShown: !introSeenAtLoadRef.current
          },
          savedDraft ?? {
            version: FEATURED_CASE_DRAFT_VERSION,
            userId: state.userId,
            releaseId: result.releaseId,
            caseToken: result.slot.caseToken,
            currentStepIndex: 0,
            selectedAnswers: [],
            stepResults: [],
            savedAt: new Date().toISOString()
          }
        );
        if (cancelled) return;
        const maxStepIndex = Math.max(0, (result.slot.caseData.questions_flow?.length ?? 1) - 1);
        setReleaseId(result.releaseId);
        setCaseToken(result.slot.caseToken);
        setCaseItem(result.slot.caseData);
        setSelectedAnswers(draft.selectedAnswers);
        setStepResults(draft.stepResults);
        setCurrentStepIndex(Math.min(maxStepIndex, Math.max(0, draft.currentStepIndex)));
        setAnalyticsContext(draft.analytics ?? null);
        caseStartRef.current = Date.now();
        setError(null);
        setLoading(false);

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (!cancelled) {
          if (draft.analytics && !draft.analytics.tracked.opened) {
            const openedContext: FeaturedCaseAnalyticsContext = {
              ...draft.analytics,
              tracked: {
                ...draft.analytics.tracked,
                opened: true
              }
            };
            emittedAnalyticsUuidsRef.current.add(draft.analytics.eventUuids.opened);
            trackFeaturedCaseMilestone(
              "featured_case_opened",
              {
                releaseId: result.releaseId,
                entrySource: draft.analytics.entrySource,
                action: draft.analytics.action,
                learnerLevel: state.userState.level,
                normalCasesCompleted: state.userState.casesCompleted,
                isReplay: draft.analytics.isReplay,
                introShown: draft.analytics.introShown,
                analyticsAttemptId: draft.analytics.attemptId
              },
              draft.analytics.eventUuids.opened
            );
            saveFeaturedCaseDraft(window.localStorage, {
              ...draft,
              analytics: openedContext,
              savedAt: new Date().toISOString()
            });
            setAnalyticsContext(openedContext);
          }
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
    state.supabaseEnabled,
    state.syncUnavailable,
    state.userId,
    state.userState.casesCompleted,
    state.userState.level,
    requestedEntry.action,
    requestedEntry.entrySource,
    requestedEntry.isReplay
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
      analytics: analyticsContext ?? undefined,
      savedAt: new Date().toISOString()
    });
  }, [
    analyticsContext,
    caseToken,
    currentStepIndex,
    loading,
    releaseId,
    selectedAnswers,
    state.userId,
    stepResults,
    summary
  ]);

  useEffect(() => {
    if (!focusCaseAfterIntro || !hasSeenFeaturedIntro) return;
    const frameId = window.requestAnimationFrame(() => {
      activeStepRef.current?.focus();
      setFocusCaseAfterIntro(false);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [focusCaseAfterIntro, hasSeenFeaturedIntro]);

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
  const showFeaturedIntro = Boolean(
    caseItem &&
    caseToken &&
    releaseId &&
    !summary &&
    !hasSeenFeaturedIntro
  );
  const featuredSummaryEntryRef = useElementViewed<HTMLAnchorElement>({
    enabled: Boolean(summary && releaseId),
    trackingKey: `${releaseId ?? "none"}:featured_summary:retry`,
    onViewed: () => {
      if (!releaseId) return;
      trackFeaturedCaseEntry("featured_case_entry_viewed", {
        releaseId,
        entrySource: "featured_summary",
        action: "retry",
        learnerLevel: state.userState.level,
        normalCasesCompleted: state.userState.casesCompleted,
        isReplay: true
      });
    }
  });

  function getAttemptAnalyticsProperties(
    context: FeaturedCaseAnalyticsContext,
    extra: Partial<Pick<FeaturedCaseAnalyticsPropertiesInput, "isCanonical" | "elapsedSeconds">> = {}
  ): FeaturedCaseAnalyticsPropertiesInput | null {
    if (!releaseId) return null;
    return {
      releaseId,
      entrySource: context.entrySource,
      action: context.action,
      learnerLevel: state.userState.level,
      normalCasesCompleted: state.userState.casesCompleted,
      isReplay: context.isReplay,
      introShown: context.introShown,
      analyticsAttemptId: context.attemptId,
      ...extra
    };
  }

  function trackAttemptMilestone(
    milestone: FeaturedCaseMilestone,
    eventName:
      | "featured_case_opened"
      | "featured_case_engaged"
      | "featured_case_completed"
      | "featured_case_intro_begin_clicked",
    extra?: Partial<Pick<FeaturedCaseAnalyticsPropertiesInput, "isCanonical" | "elapsedSeconds">>
  ) {
    const context = analyticsContext;
    if (!context || context.tracked[milestone]) return;
    const eventUuid = context.eventUuids[milestone];
    if (emittedAnalyticsUuidsRef.current.has(eventUuid)) return;
    const properties = getAttemptAnalyticsProperties(context, extra);
    if (!properties) return;

    emittedAnalyticsUuidsRef.current.add(eventUuid);
    trackFeaturedCaseMilestone(eventName, properties, eventUuid);
    setAnalyticsContext(current => {
      if (!current || current.attemptId !== context.attemptId) return current;
      return {
        ...current,
        tracked: {
          ...current.tracked,
          [milestone]: true
        }
      };
    });
  }

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
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - caseStartRef.current) / 1000));
    try {
      const result = await submitFeaturedCase(state.runtimeConfig, state.supabase, {
        caseToken,
        answers,
        elapsedSeconds,
        clientCompletedAt: new Date().toISOString()
      });
      trackAttemptMilestone("completed", "featured_case_completed", {
        isCanonical: result.isCanonical,
        elapsedSeconds
      });
      clearFeaturedCaseDraft(window.localStorage);
      setSummary(result.summary);
      setComparison(result.comparison);
      setSummaryIsReplay(!result.isCanonical);
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
    trackAttemptMilestone("engaged", "featured_case_engaged");

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

  function handleBeginFeaturedCase() {
    trackAttemptMilestone("intro_begin", "featured_case_intro_begin_clicked");
    saveFeaturedCaseIntroSeen(window.localStorage);
    setHasSeenFeaturedIntro(true);
    setFocusCaseAfterIntro(true);
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
            featuredComparison={comparison}
            featuredIsReplay={summaryIsReplay}
          />
          <ResultsSummaryCard
            summary={summary}
            caseItem={summary.caseData}
            showSummaryReferences={showSummaryReferences}
            showAbnormalHighlighting={showAbnormalHighlighting}
            onNextCase={() => navigate("/dashboard")}
            primaryActionLabel="Back to dashboard"
            secondaryActionLabel="Retry Featured Case"
            secondaryActionHref={buildFeaturedCaseEntryUrl("featured_summary", "retry")}
            secondaryActionRef={featuredSummaryEntryRef}
            onSecondaryActionClick={() => {
              trackFeaturedCaseEntry("featured_case_entry_clicked", {
                releaseId,
                entrySource: "featured_summary",
                action: "retry",
                learnerLevel: state.userState.level,
                normalCasesCompleted: state.userState.casesCompleted,
                isReplay: true
              });
            }}
            storage={state.storage}
          />
        </div>
      </main>
    );
  }

  return (
    <>
      <FeaturedCaseIntroModal
        open={showFeaturedIntro}
        onBegin={handleBeginFeaturedCase}
      />
      <main
        className="app-shell__page practice-screen"
        aria-hidden={showFeaturedIntro || undefined}
        inert={showFeaturedIntro || undefined}
      >
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
    </>
  );
}
