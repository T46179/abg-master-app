import { useEffect, useRef, useState } from "react";
import type { PressureUnit } from "../../core/types";
import type { GradingStatus } from "./resultsTypes";
import type { SittingState } from "./sittingTypes";
import { demoFeedback } from "./demoFeedback.dev";
import { demoErrorLogSave } from "./errorLogFixtures.dev";
import ExamResultsPresentation from "./ExamResultsPresentation";
export default function ExamResultsPrototype({ sitting, onExit, pressureUnit = sitting.pressureUnit, initiallyComplete = false }: {
  sitting: SittingState; onExit: () => void; pressureUnit?: PressureUnit; initiallyComplete?: boolean;
}) {
  const parts = sitting.questions.flatMap(q => q.parts);
  const [savedExamples, setSavedExamples] = useState<Record<string, string[]>>({});
  const errorLogPresentation = Object.fromEntries(Object.entries(demoErrorLogSave).map(([partId, concepts]) =>
    [partId, concepts.map(c => ({ ...c, saved: c.saved || savedExamples[partId]?.includes(c.id) }))]));
  const [statuses, setStatuses] = useState<Record<string, GradingStatus>>(() => initiallyComplete ? Object.fromEntries(parts.map(part => [part.id, "completed"])) : {});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  function startSimulation() {
    clearTimers(); setStatuses({});
    parts.forEach((part, i) => {
      timers.current.push(setTimeout(() => setStatuses(current => ({ ...current, [part.id]: "completed" })),
        part.kind === "concept" || part.kind === "numeric" ? 9000 + i * 500 : 1200 + i * 200));
    });
  }
  // Review preferences are deliberately excluded: only a new submitted snapshot restarts the demo.
  useEffect(() => { if (!initiallyComplete) startSimulation(); return clearTimers; }, [sitting, initiallyComplete]);
  function retryFailed() {
    const failedIds = parts.filter(part => statuses[part.id] === "failed").map(part => part.id);
    if (!failedIds.length) return;
    setStatuses(current => ({ ...current, ...Object.fromEntries(failedIds.map(id => [id, "pending"])) }));
    failedIds.forEach(id => timers.current.push(setTimeout(() =>
      setStatuses(current => ({ ...current, [id]: "completed" })), 2500)));
  }
  const grades = Object.fromEntries(parts.map((part, index) => {
    const answer = sitting.answers[part.id];
    const answered = Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim());
    const score = !answered ? 0 : part.marks > 1 ? part.marks - 1 : index % 3 === 0 ? 0 : part.marks;
    return [part.id, { status: statuses[part.id] ?? "pending", score,
      criteria: Object.fromEntries((demoFeedback[part.id]?.criteria ?? []).map((c, i) => [c.id, i < score ? 1 : 0])) }];
  }));
  return <ExamResultsPresentation sitting={sitting} onExit={onExit} pressureUnit={pressureUnit} feedback={demoFeedback} grades={grades} errorLogPresentation={errorLogPresentation}
    onErrorLogSave={async (partId, ids) => setSavedExamples(current => ({ ...current, [partId]: [...new Set([...(current[partId] ?? []), ...ids])] }))}
    onRetry={retryFailed} notice={
    <aside className="exam-results__prototype">
      <strong>Development preview</strong> — marks and criterion decisions are illustrative, not an assessment of your answers. Nothing is saved.
      <p>Error log examples: Question 1 Part 2 (single), Question 3 Part 2 (numeric), Question 5 Part 1 (already saved), Question 5 Part 4 (multiple). Saves are temporary and do not update the Error log page.</p>
      <details><summary>Preview grading states</summary><div className="exam-results__controls">
        <button type="button" onClick={startSimulation}>Replay grading delay</button>
        <button type="button" onClick={() => { clearTimers(); setStatuses(Object.fromEntries(parts.map(p => [p.id, "completed"]))); }}>Complete grading</button>
        <button type="button" onClick={() => { clearTimers(); setStatuses(Object.fromEntries(parts.map((p, i) => [p.id, i === 0 ? "failed" : "completed"]))); }}>Simulate grading failure</button>
      </div></details>
    </aside>
  } />;
}
