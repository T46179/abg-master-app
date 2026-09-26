import type { PressureUnit } from "../../core/types";
import type { ExamAnswer, ExamQuestion, SittingState } from "./sittingTypes";

export type SittingAction =
  | { type: "start"; questions: ExamQuestion[]; pressureUnit: PressureUnit; now: number }
  | { type: "jump"; questionIndex: number; partIndex?: number }
  | { type: "answer"; partId: string; value: ExamAnswer }
  | { type: "review" }
  | { type: "return" }
  | { type: "ranges" }
  | { type: "timer" }
  | { type: "submit"; now: number }
  | { type: "exit" };

export function isAnswered(value: ExamAnswer | undefined) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}
export function unansweredCount(state: SittingState) {
  return state.questions.reduce((sum, q) => sum + q.parts.filter(p => !isAnswered(state.answers[p.id])).length, 0);
}
export function elapsedSeconds(state: SittingState, now: number) {
  return Math.max(0, Math.floor(((state.finishedAt ?? now) - state.startedAt) / 1000));
}
export function sittingReducer(state: SittingState | null, action: SittingAction): SittingState | null {
  if (action.type === "exit") return null;
  if (action.type === "start") {
    if (state && state.phase !== "complete") return state;
    if (!action.questions.length || action.questions.some(q => !q.parts.length)) return state;
    return { questions: action.questions, phase: "active", questionIndex: 0, partIndices: {},
      answers: {}, pressureUnit: action.pressureUnit, showRanges: true, showTimer: true, startedAt: action.now };
  }
  if (!state || state.phase === "complete") return state;
  switch (action.type) {
    case "jump": {
      const q = state.questions[action.questionIndex];
      if (!q) return state;
      const pi = action.partIndex ?? state.partIndices[q.id] ?? 0;
      if (!q.parts[pi]) return state;
      return { ...state, phase: "active", questionIndex: action.questionIndex,
        partIndices: { ...state.partIndices, [q.id]: pi } };
    }
    case "answer":
      if (state.phase !== "active" || !state.questions.some(q => q.parts.some(p => p.id === action.partId))) return state;
      return { ...state, answers: { ...state.answers, [action.partId]: Array.isArray(action.value) ? [...action.value] : action.value } };
    case "review": return { ...state, phase: "review" };
    case "return": return { ...state, phase: "active" };
    case "ranges": return { ...state, showRanges: !state.showRanges };
    case "timer": return { ...state, showTimer: !state.showTimer };
    case "submit": return state.phase === "review" ? { ...state, phase: "complete", finishedAt: action.now } : state;
  }
}

