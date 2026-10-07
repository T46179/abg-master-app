import { useState } from "react";
import type { PressureUnit } from "../../core/types";
import type { SittingState } from "./sittingTypes";
import { demoQuestions } from "./demoFixtures.dev";
import ExamResultsPrototype from "./ExamResultsPrototype.dev";

// Reopen a completed presentation snapshot without starting or submitting a real exam.
export default function ExamLatestResultPreview({ onExit, pressureUnit }: { onExit: () => void; pressureUnit: PressureUnit }) {
  const [sitting] = useState<SittingState>(() => ({
    questions: demoQuestions, phase: "complete", questionIndex: 0, partIndices: {}, answers: {},
    pressureUnit, showRanges: true, showTimer: true, startedAt: 0, finishedAt: 900000
  }));
  return <ExamResultsPrototype sitting={sitting} onExit={onExit} pressureUnit={pressureUnit} initiallyComplete />;
}
