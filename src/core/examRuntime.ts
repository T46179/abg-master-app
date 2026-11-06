import type { SupabaseClient } from "@supabase/supabase-js";
import type { PressureUnit } from "./types";
import type { ExamAnswer, ExamQuestion, SittingState } from "../presentation/exam/sittingTypes";
import type { ExamFeedback } from "../presentation/exam/resultsTypes";
export type ExamPurpose = "standard" | "trial";
export type ExamKind = "mock" | "custom";
export interface ExamConfiguration { purpose?: ExamPurpose; examKind: ExamKind; excludedCategories: string[]; unitCount?: number; showTimer?: boolean; showRanges?: boolean }
export type WireAnswers = Record<string, ExamAnswer | { text: string; unit: string }>;
export interface RuntimeAttempt {
  id: string; status: "active" | "submitted" | "abandoned" | "invalidated"; revision: number;
  pressureUnit: PressureUnit; createdAt: string; presentedAt: string | null; finishedAt: string | null;
  feedbackTone?: "professional" | "supportive" | "ruthless";
  purpose?: ExamPurpose; trialVersion?: string | null;
  trialAllowanceState?: "available" | "reserved" | "consumed" | "released" | "historical";
  marksAvailable?: number; examKind?: ExamKind; excludedCategories?: string[];
  questions: ExamQuestion[]; answers: WireAnswers; feedback?: ExamFeedback;
  gradingStatus?: "pending" | "completed" | "failed"; marksAwarded?: number | null; canRetryGrading?: boolean;
  parts?: Array<{ partId: string; status: "pending" | "completed" | "failed"; marksAwarded?: number | null; marksAvailable?: number | null; criteria?: Record<string, number> | null }>;
}
export type RuntimeCall = <T>(operation: string, input: Record<string, unknown>) => Promise<T>;
export class ExamRuntimeError extends Error {
  constructor(public code: string, public transportFailure?: boolean) { super(code); }
}
export function runtimeCall(client: SupabaseClient): RuntimeCall {
  return async <T>(operation: string, input: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.functions.invoke("exam-runtime", { body: { operation, input } });
    if (error) {
      let code = "EXAM_UNAVAILABLE";
      try { const body = await error.context?.json(); if (/^EXAM_[A-Z_]+$/.test(body?.code)) code = body.code; } catch { /* Network/relay errors have no JSON body. */ }
      throw new ExamRuntimeError(code, error.name === "FunctionsFetchError");
    }
    if (!data || typeof data !== "object") throw new ExamRuntimeError("EXAM_UNAVAILABLE");
    return data as T;
  };
}
export function encodeAnswers(sitting: SittingState): WireAnswers {
  const parts = sitting.questions.flatMap(q => q.parts);
  return Object.fromEntries(Object.entries(sitting.answers).map(([id, value]) => {
    const part = parts.find(p => p.id === id);
    return [id, part?.kind === "numeric" ? { text: value as string, unit: part.pressureAnswer ? sitting.pressureUnit : part.answerUnit ?? "1" } : value];
  }));
}
export interface ExamNavigationPosition {
  questionId: string;
  partIdsByQuestion: Record<string, string>;
  phase: "active" | "review";
}
export function toSitting(attempt: RuntimeAttempt, navigation?: ExamNavigationPosition): SittingState {
  if (!Array.isArray(attempt.questions) || !attempt.questions.length || attempt.questions.some(q => !q.parts?.length)) throw new ExamRuntimeError("EXAM_INVALID_RESPONSE");
  const position = attempt.status === "active" && navigation && typeof navigation === "object" && !Array.isArray(navigation) ? navigation : undefined;
  const questionIndex = Math.max(0, attempt.questions.findIndex(q => q.id === position?.questionId));
  const savedParts = position?.partIdsByQuestion;
  const partIndices = savedParts && typeof savedParts === "object" && !Array.isArray(savedParts)
    ? Object.fromEntries(attempt.questions.flatMap(q => {
      const index = q.parts.findIndex(p => p.id === savedParts[q.id]);
      return index >= 0 ? [[q.id, index]] : [];
    })) : {};
  return { questions: attempt.questions, phase: attempt.status === "submitted" ? "complete" : position?.phase === "review" ? "review" : "active",
    questionIndex, partIndices, answers: Object.fromEntries(Object.entries(attempt.answers).map(([id, value]) =>
      [id, typeof value === "object" && !Array.isArray(value) ? value.text : value])), pressureUnit: attempt.pressureUnit,
    startedAt: Date.parse(attempt.presentedAt ?? attempt.createdAt), finishedAt: attempt.finishedAt ? Date.parse(attempt.finishedAt) : undefined,
    showRanges: true, showTimer: true };
}
interface Journal {
  purpose?: ExamPurpose;
  examKind?: ExamKind; excludedCategories?: string[]; unitCount?: number; showTimer?: boolean; showRanges?: boolean;
  requestId: string; recoveryKey: string; pressureUnit: PressureUnit; attemptId?: string; revision?: number;
  dirty?: WireAnswers; submission?: { requestId: string; answers: WireAnswers };
  navigation?: ExamNavigationPosition;
}
// Each mounted controller is a new writer. No sessionStorage ID that a duplicated tab could inherit.
export class ExamRuntimeSession {
  readonly writerId = crypto.randomUUID();
  attempt: RuntimeAttempt | null = null;
  journal: Journal | null;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly call: RuntimeCall, readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, readonly key: string) {
    const raw = storage.getItem(key);
    this.journal = raw ? JSON.parse(raw) : null;
  }
  private persist() { if (this.journal) this.storage.setItem(this.key, JSON.stringify(this.journal)); else this.storage.removeItem(this.key); }
  private accept(attempt: RuntimeAttempt) {
    this.attempt = attempt;
    if (this.journal) { this.journal.attemptId = attempt.id; this.journal.revision = attempt.revision; this.persist(); }
    return attempt;
  }
  private input() {
    if (!this.attempt || !this.journal) throw new ExamRuntimeError("EXAM_DEVICE_REQUIRED");
    return { attemptId: this.attempt.id, recoveryKey: this.journal.recoveryKey, writerId: this.writerId, revision: this.attempt.revision };
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.tail.then(action); this.tail = next.catch(() => undefined); return next;
  }
  async start(pressureUnit: PressureUnit, configuration: ExamConfiguration = { examKind: "mock", excludedCategories: [] }) {
    if (!this.journal) {
      this.journal = { purpose: configuration.purpose ?? "standard", unitCount: configuration.unitCount, showTimer: configuration.showTimer, showRanges: configuration.showRanges, examKind: configuration.examKind, excludedCategories: configuration.examKind === "mock" ? [] : [...new Set(configuration.excludedCategories)].sort(), requestId: crypto.randomUUID(), recoveryKey: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join(""), pressureUnit };
      this.persist(); // Persist before sending so a lost response never creates another attempt.
    }
    let result: RuntimeAttempt;
    try {
      result = await this.call<RuntimeAttempt>("start", { purpose: this.journal.purpose ?? "standard", requestId: this.journal.requestId, recoveryKey: this.journal.recoveryKey, pressureUnit: this.journal.pressureUnit, examKind: this.journal.examKind ?? "mock", excludedCategories: this.journal.excludedCategories ?? [], ...(this.journal.unitCount !== undefined ? { unitCount: this.journal.unitCount } : {}), writerId: this.writerId });
    } catch (error) {
      // This server rejection occurs only before a new attempt is inserted.
      // Network uncertainty and reused-request errors must retain the journal.
      if (!this.journal.attemptId && error instanceof ExamRuntimeError && ["EXAM_INVALID_CONFIGURATION", "EXAM_TRIAL_DISABLED", "EXAM_TRIAL_CONFIGURATION", "EXAM_TRIAL_UNAVAILABLE", "EXAM_ACCESS_DENIED"].includes(error.code)) {
        this.journal = null; this.persist();
      }
      throw error;
    }
    return this.accept(result);
  }
  async recover() {
    if (!this.journal) throw new ExamRuntimeError("EXAM_DEVICE_REQUIRED");
    if (!this.journal.attemptId) await this.start(this.journal.pressureUnit);
    const result = await this.call<RuntimeAttempt>("read", { attemptId: this.journal.attemptId, recoveryKey: this.journal.recoveryKey });
    if (result.status !== "active") return this.accept(result);
    // Never silently overwrite a newer server draft with this tab's unsent answers.
    if (this.journal.dirty && result.revision !== this.journal.revision && Object.entries(this.journal.dirty).some(([id, v]) => JSON.stringify(result.answers[id]) !== JSON.stringify(v))) {
      throw new ExamRuntimeError("EXAM_LOCAL_CONFLICT");
    }
    this.accept(result);
    return this.accept(await this.call<RuntimeAttempt>("claim", this.input()));
  }
  stage(answers: WireAnswers) {
    if (!this.journal || this.journal.submission) throw new ExamRuntimeError("EXAM_SUBMISSION_PENDING");
    this.journal.dirty = answers; this.persist();
  }
  save() { return this.serial(async () => {
    const answers = this.journal?.dirty;
    if (!answers || this.journal?.submission) return this.attempt!;
    const result = await this.call<RuntimeAttempt>("save", { ...this.input(), answers });
    if (this.journal?.dirty === answers) delete this.journal.dirty;
    return this.accept(result);
  }); }
  present(unitId: string) { return this.serial(async () => this.accept(await this.call<RuntimeAttempt>("present", { ...this.input(), unitId }))); }
  submit(answers: WireAnswers) {
    if (!this.journal) throw new ExamRuntimeError("EXAM_DEVICE_REQUIRED");
    this.journal.submission ??= { requestId: crypto.randomUUID(), answers };
    this.persist();
    return this.serial(async () => {
      const result = await this.call<RuntimeAttempt>("submit", { ...this.input(), ...this.journal!.submission });
      delete this.journal!.dirty; delete this.journal!.submission;
      return this.accept(result);
    });
  }
  abandon(attemptId: string) { return this.serial(async () => {
    await this.call("abandon", { attemptId, confirmed: true });
    this.attempt = null; this.journal = null; this.persist();
  }); }
  keepServerDraft() {
    if (!this.journal || this.journal.submission) return;
    this.storage.setItem(`${this.key}-conflict-backup`, JSON.stringify(this.journal));
    delete this.journal.dirty; this.persist();
  }
  cancelRejectedSubmission() { if (this.journal) { delete this.journal.submission; this.persist(); } }
  setDisplayPreferences(showTimer: boolean, showRanges: boolean) {
    if (this.journal) { this.journal.showTimer = showTimer; this.journal.showRanges = showRanges; this.persist(); }
  }
  setNavigation(sitting: SittingState) {
    if (!this.journal || this.journal.attemptId !== this.attempt?.id || this.attempt?.status !== "active" || sitting.phase === "complete") return;
    const question = sitting.questions[sitting.questionIndex];
    if (!question) return;
    const navigation: ExamNavigationPosition = {
      questionId: question.id,
      partIdsByQuestion: Object.fromEntries(sitting.questions.flatMap(q => {
        const part = q.parts[sitting.partIndices[q.id] ?? 0];
        return part ? [[q.id, part.id]] : [];
      })),
      phase: sitting.phase,
    };
    try {
      // Commit only after a successful write; failed optional data must not burden answer persistence.
      this.storage.setItem(this.key, JSON.stringify({ ...this.journal, navigation }));
      this.journal.navigation = navigation;
    } catch { /* Position is optional. Navigation and the existing answer journal stay usable. */ }
  }
  clear() { this.journal = null; this.attempt = null; this.persist(); }
}
