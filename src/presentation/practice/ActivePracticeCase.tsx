import type { RefObject } from "react";
import type { PressureUnit } from "../../core/metrics";
import type { AnswerSelection, CaseData, QuestionFlowStep, StepResult } from "../../core/types";
import { QuestionFlowCard } from "./QuestionFlowCard";
import { ScenarioCard } from "./ScenarioCard";
import { ValuePanels } from "./ValuePanels";

interface ActivePracticeCaseProps {
  caseItem: CaseData;
  questions: QuestionFlowStep[];
  currentStepIndex: number;
  currentStep: QuestionFlowStep | null;
  currentSelection: AnswerSelection | null;
  currentResult: StepResult | null;
  currentOptions: string[];
  selectedAnswers: AnswerSelection[];
  stepResults: StepResult[];
  showAdvancedRanges: boolean;
  showAbnormalHighlighting: boolean;
  pressureUnit?: PressureUnit;
  onToggleAdvancedRanges: () => void;
  onAnswer: (option: string) => void;
  onContinueStep: () => void;
  activeStepRef: RefObject<HTMLButtonElement | null>;
  interactionDisabled?: boolean;
  interactionDisabledMessage?: string | null;
  isSubmittingCase?: boolean;
  lastStepButtonLabel?: string;
  boostedXp?: boolean;
}

export function ActivePracticeCase({
  caseItem,
  questions,
  currentStepIndex,
  currentStep,
  currentSelection,
  currentResult,
  currentOptions,
  selectedAnswers,
  stepResults,
  showAdvancedRanges,
  showAbnormalHighlighting,
  pressureUnit,
  onToggleAdvancedRanges,
  onAnswer,
  onContinueStep,
  activeStepRef,
  interactionDisabled,
  interactionDisabledMessage,
  isSubmittingCase,
  lastStepButtonLabel,
  boostedXp = false
}: ActivePracticeCaseProps) {
  return (
    <div className="practice-stage">
      <div className="practice-stage__sidebar">
        <div className="practice-stage__sticky">
          <ScenarioCard clinicalStem={caseItem.clinical_stem} caseItem={caseItem} boostedXp={boostedXp} />
          <ValuePanels
            caseItem={caseItem}
            showAdvancedRanges={showAdvancedRanges}
            showAbnormalHighlighting={showAbnormalHighlighting}
            pressureUnit={pressureUnit}
            onToggleAdvancedRanges={onToggleAdvancedRanges}
          />
        </div>
      </div>

      <div className="practice-stage__main">
        <QuestionFlowCard
          caseItem={caseItem}
          questions={questions}
          currentStepIndex={currentStepIndex}
          currentStep={currentStep}
          currentSelection={currentSelection}
          currentResult={currentResult}
          currentOptions={currentOptions}
          selectedAnswers={selectedAnswers}
          stepResults={stepResults}
          onAnswer={onAnswer}
          onContinueStep={onContinueStep}
          activeStepRef={activeStepRef}
          interactionDisabled={interactionDisabled}
          interactionDisabledMessage={interactionDisabledMessage}
          isSubmittingCase={isSubmittingCase}
          lastStepButtonLabel={lastStepButtonLabel}
        />
      </div>
    </div>
  );
}
