import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { findApprovedAuthoredPreviewCase, isAuthoredCasePreviewEnabled, loadAuthoredCasePreviewPayload } from "../../core/authoredCasePreview";
import { composeCaseStructuredExplanation } from "../../core/explanations";
import { shouldShowMetricReferences } from "../../core/metrics";
import { getCorrectAnswer, isCorrectAnswer, prettyStepLabel } from "../../core/practice";
import { getDifficultyLabel } from "../../core/progression";
import type { AnswerSelection, AnswerValue, CaseData, CaseSummary, StepResult } from "../../core/types";
import { QuestionFlowCard } from "../practice/QuestionFlowCard";
import { ResultsSummaryCard, ResultsSummaryHeader } from "../practice/ResultsSummaryCard";
import { ScenarioCard } from "../practice/ScenarioCard";
import { ValuePanels } from "../practice/ValuePanels";
import { ErrorView, LoadingView } from "../shared/StatusViews";

function buildPreviewSummary(caseItem: CaseData, stepResults: StepResult[], elapsedSeconds: number): CaseSummary {
  const correctSteps = stepResults.filter(result => result.correct).length;
  const totalSteps = stepResults.length;
  return {
    caseId: caseItem.case_id,
    title: caseItem.title ?? "Authored case preview",
    difficulty: getDifficultyLabel(null, Number(caseItem.difficulty_level ?? 1)),
    explanation: composeCaseStructuredExplanation(caseItem, stepResults),
    learningObjective: caseItem.learning_objective ?? "",
    elapsedSeconds,
    accuracy: totalSteps ? Math.round((correctSteps / totalSteps) * 100) : 0,
    correctSteps,
    totalSteps,
    totalXpAward: 0,
    baseXp: 0,
    perfectBonus: 0,
    speedBonus: 0,
    level: 1,
    stepResults,
    caseData: caseItem
  };
}

export function CasePreviewScreen() {
  const { caseId = "" } = useParams();
  const [caseItem, setCaseItem] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerSelection[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [showAdvancedRanges, setShowAdvancedRanges] = useState(false);
  const caseStartRef = useRef<number>(Date.now());
  const activeStepRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isAuthoredCasePreviewEnabled()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    loadAuthoredCasePreviewPayload()
      .then(payload => {
        if (cancelled) return;
        const foundCase = findApprovedAuthoredPreviewCase(payload.cases, caseId);
        if (!foundCase) {
          setError("The requested authored case is unavailable.");
        } else {
          setCaseItem(foundCase);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Authored case preview is unavailable in this environment.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const currentStep = caseItem?.questions_flow?.[currentStepIndex] ?? null;
  const currentResult = stepResults[currentStepIndex] ?? null;
  const currentSelection = selectedAnswers[currentStepIndex] ?? null;
  const totalSteps = caseItem?.questions_flow?.length ?? 0;
  const currentOptions = currentStep?.options ?? [];
  const currentDifficultyLevel = Number(caseItem?.difficulty_level ?? 1);
  const showAbnormalHighlighting = currentDifficultyLevel <= 3;
  const showSummaryReferences = Boolean(summary && shouldShowMetricReferences(summary.caseData, showAdvancedRanges));

  const selectedValues = useMemo(() => (
    Array.isArray(currentSelection?.chosen) ? currentSelection.chosen : []
  ), [currentSelection]);

  function finishCase(nextStepResults: StepResult[]) {
    if (!caseItem) return;
    setSummary(buildPreviewSummary(caseItem, nextStepResults, Math.max(0, (Date.now() - caseStartRef.current) / 1000)));
  }

  function setSelection(stepIndex: number, chosen: AnswerValue) {
    if (!currentStep) return;
    const nextSelections = [...selectedAnswers];
    nextSelections[stepIndex] = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen
    };
    setSelectedAnswers(nextSelections);
  }

  function recordResult(chosen: AnswerValue) {
    if (!caseItem || !currentStep) return stepResults;
    const nextResults = [...stepResults];
    nextResults[currentStepIndex] = {
      key: currentStep.key,
      label: currentStep.label ?? prettyStepLabel(currentStep.key),
      prompt: currentStep.prompt,
      chosen,
      correctAnswer: getCorrectAnswer(caseItem, currentStep.key),
      correct: isCorrectAnswer(caseItem, currentStep.key, chosen),
      feedback: null
    };
    setStepResults(nextResults);
    return nextResults;
  }

  function handleAnswer(option: string) {
    if (!caseItem || !currentStep || currentResult) return;

    if (currentStep.selection_mode === "multi") {
      const nextValues = selectedValues.includes(option)
        ? selectedValues.filter(value => value !== option)
        : [...selectedValues, option];
      setSelection(currentStepIndex, nextValues);
      return;
    }

    setSelection(currentStepIndex, option);
    const nextResults = recordResult(option);
    if (currentStepIndex >= totalSteps - 1) {
      finishCase(nextResults);
    }
  }

  function handleContinueStep() {
    if (!caseItem || !currentStep) return;
    const chosen = currentStep.selection_mode === "multi"
      ? selectedValues
      : currentSelection?.chosen ?? "";
    if ((Array.isArray(chosen) && !chosen.length) || (!Array.isArray(chosen) && !chosen)) return;

    const nextResults = stepResults[currentStepIndex]
      ? stepResults
      : recordResult(chosen);

    if (currentStepIndex >= totalSteps - 1) {
      finishCase(nextResults);
      return;
    }

    setCurrentStepIndex(index => index + 1);
  }

  function handleRestart() {
    setCurrentStepIndex(0);
    setSelectedAnswers([]);
    setStepResults([]);
    setSummary(null);
    caseStartRef.current = Date.now();
  }

  if (!isAuthoredCasePreviewEnabled()) {
    return <ErrorView message="This page is only available in development or staging." />;
  }

  if (loading) return <LoadingView />;
  if (error || !caseItem) return <ErrorView message={error ?? "The requested authored case could not be found."} />;

  if (summary) {
    return (
      <main className="app-shell__page practice-screen">
        <div className="practice-screen__container">
          <ResultsSummaryHeader summary={summary} level={1} xpProgressLabel="Preview" progressValue={0} />
          <ResultsSummaryCard
            summary={summary}
            caseItem={caseItem}
            showSummaryReferences={showSummaryReferences}
            showAbnormalHighlighting={showAbnormalHighlighting}
            onNextCase={handleRestart}
            onOpenFeedback={() => {}}
            storage={null}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell__page practice-screen">
      <div className="practice-screen__container">
        <ValuePanels
          caseItem={caseItem}
          showAdvancedRanges={showAdvancedRanges}
          showAbnormalHighlighting={showAbnormalHighlighting}
          onToggleAdvancedRanges={() => setShowAdvancedRanges(value => !value)}
        />
        <ScenarioCard clinicalStem={caseItem.clinical_stem} />
        <QuestionFlowCard
          caseItem={caseItem}
          questions={caseItem.questions_flow ?? []}
          currentStepIndex={currentStepIndex}
          currentStep={currentStep}
          currentSelection={currentSelection}
          currentResult={currentResult}
          currentOptions={currentOptions}
          selectedAnswers={selectedAnswers}
          stepResults={stepResults}
          onAnswer={handleAnswer}
          onContinueStep={handleContinueStep}
          activeStepRef={activeStepRef}
        />
      </div>
    </main>
  );
}
