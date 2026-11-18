import type { SupabaseClient } from "@supabase/supabase-js";
import type { PressureUnit } from "./types";
import type { ExamAnswer, ExamQuestion, SittingState } from "../presentation/exam/sittingTypes";
import type { ExamFeedback } from "../presentation/exam/resultsTypes";
export type ExamPurpose = "standard" | "trial";
export type ExamKind = "mock" | "custom";
export interface ExamConfiguration { purpose?: ExamPurpose; examKind: ExamKind; excludedCategories: string[]; unitCount?: number; snapshotIds?: string[]; showTimer?: boolean; showRanges?: boolean }
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
  examKind?: ExamKind; excludedCategories?: string[]; unitCount?: number; snapshotIds?: string[]; showTimer?: boolean; showRanges?: boolean;
  requestId: string; recoveryKey: string; pressureUnit: PressureUnit; attemptId?: string; revision?: number;
  dirty?: WireAnswers; submission?: { requestId: string; answers: WireAnswers };
  navigation?: ExamNavigationPosition;
  pendingPresentedUnitIds?: string[];
  acknowledgedPresentedUnitIds?: string[];
}

type WriterLock = { id: string; release: () => void };

export class ExamRuntimeSession {
  attempt: RuntimeAttempt | null = null;
  journal: Journal | null;
  private tail: Promise<unknown> = Promise.resolve();
  private writer?: WriterLock;
  private acquiring?: Promise<WriterLock>;
  private generation = 0;
  constructor(readonly call: RuntimeCall, readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, readonly key: string, private readonly locks: Pick<LockManager, "request"> | undefined = globalThis.navigator?.locks) {
    this.journal = this.readJournal();
  }
  private readJournal(): Journal | null {
    const raw = this.storage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  }
  refreshJournal() { if (!this.writer) this.journal = this.readJournal(); }
  async acquireWriter(): Promise<WriterLock> {
    if (this.writer) return this.writer;
    if (this.acquiring) return this.acquiring;
    if (!this.locks) throw new ExamRuntimeError("EXAM_TAB_LOCK_UNAVAILABLE");
    const locks = this.locks;
    const generation = this.generation;
    const acquiring = new Promise<WriterLock>((resolve, reject) => {
      void locks.request(this.key, { ifAvailable: true }, lock => {
        if (generation !== this.generation) throw new ExamRuntimeError("EXAM_WRITER_RELEASED");
        if (!lock) throw new ExamRuntimeError("EXAM_TAB_BUSY");
        this.refreshJournal();
        return new Promise<void>(release => {
          // A reopened sitting must claim a fresh server writer, even in the same tab.
          const writer = { id: crypto.randomUUID(), release };
          this.writer = writer;
          resolve(writer);
        });
      }).catch(reject);
    });
    this.acquiring = acquiring;
    try { return await acquiring; }
    finally { if (this.acquiring === acquiring) this.acquiring = undefined; }
  }
  ownsWriter(writer: WriterLock) { return this.writer === writer; }
  releaseWriter(writer = this.writer) {
    if (writer !== this.writer) return;
    ++this.generation;
    this.writer = undefined;
    this.acquiring = undefined;
    this.attempt = null;
    this.tail = Promise.resolve();
    writer?.release();
  }
  private requireWriter(writer = this.writer): WriterLock {
    if (!writer || !this.ownsWriter(writer)) throw new ExamRuntimeError("EXAM_WRITER_RELEASED");
    return writer;
  }
  private persist() {
    this.requireWriter();
    if (this.journal) this.storage.setItem(this.key, JSON.stringify(this.journal));
    else this.storage.removeItem(this.key);
  }
  private accept(attempt: RuntimeAttempt, writer: WriterLock) {
    this.requireWriter(writer);
    this.attempt = attempt;
    if (this.journal) { this.journal.attemptId = attempt.id; this.journal.revision = attempt.revision; this.persist(); }
    return attempt;
  }
  private input() {
    if (!this.attempt || !this.journal) throw new ExamRuntimeError("EXAM_DEVICE_REQUIRED");
    return { attemptId: this.attempt.id, recoveryKey: this.journal.recoveryKey, writerId: this.requireWriter().id, revision: this.attempt.revision };
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.tail.then(action); this.tail = next.catch(() => undefined); return next;
  }
  async start(pressureUnit: PressureUnit, configuration: ExamConfiguration = { examKind: "mock", excludedCategories: [] }) {
    const writer = this.requireWriter(await this.acquireWriter());
    if (this.journal) return this.recoverWithWriter(writer);
    const journal: Journal = { purpose: configuration.purpose ?? "standard", unitCount: configuration.unitCount, snapshotIds: configuration.snapshotIds?.slice(), showTimer: configuration.showTimer, showRanges: configuration.showRanges, examKind: configuration.examKind, excludedCategories: configuration.examKind === "mock" ? [] : [...new Set(configuration.excludedCategories)].sort(), requestId: crypto.randomUUID(), recoveryKey: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join(""), pressureUnit };
    // Persist before sending so a lost response can replay the same request.
    this.storage.setItem(this.key, JSON.stringify(journal));
    this.journal = journal;
    return this.sendStart(journal, writer);
  }
  private async sendStart(journal: Journal, writer: WriterLock) {
    let result: RuntimeAttempt;
    try {
      result = await this.call<RuntimeAttempt>("start", { purpose: journal.purpose ?? "standard", requestId: journal.requestId, recoveryKey: journal.recoveryKey, pressureUnit: journal.pressureUnit, examKind: journal.examKind ?? "mock", excludedCategories: journal.excludedCategories ?? [], ...(journal.unitCount !== undefined ? { unitCount: journal.unitCount } : {}), ...(journal.snapshotIds ? { snapshotIds: journal.snapshotIds } : {}), writerId: writer.id });
    } catch (error) {
      this.requireWriter(writer);
      // This server rejection occurs only before a new attempt is inserted.
      // Network uncertainty and reused-request errors must retain the journal.
      if (!journal.attemptId && error instanceof ExamRuntimeError && ["EXAM_NO_APPROVED_CONTENT", "EXAM_INVALID_CONFIGURATION", "EXAM_INVALID_UNIT_SELECTION", "EXAM_TRIAL_DISABLED", "EXAM_TRIAL_CONFIGURATION", "EXAM_TRIAL_UNAVAILABLE", "EXAM_ACCESS_DENIED"].includes(error.code)) {
        this.journal = null; this.persist();
      }
      throw error;
    }
    return this.accept(result, writer);
  }
  async recover() {
    return this.recoverWithWriter(this.requireWriter(await this.acquireWriter()));
  }
  private async recoverWithWriter(writer: WriterLock) {
    const journal = this.journal;
    if (!journal) throw new ExamRuntimeError("EXAM_DEVICE_REQUIRED");
    if (!journal.attemptId) await this.sendStart(journal, writer);
    this.requireWriter(writer);
    const result = await this.call<RuntimeAttempt>("read", { attemptId: journal.attemptId, recoveryKey: journal.recoveryKey });
    this.requireWriter(writer);
    if (result.status !== "active") return this.accept(result, writer);
    // Never silently overwrite a newer server draft with this tab's unsent answers.
    if (journal.dirty && result.revision !== journal.revision && Object.entries(journal.dirty).some(([id, v]) => JSON.stringify(result.answers[id]) !== JSON.stringify(v))) {
      throw new ExamRuntimeError("EXAM_LOCAL_CONFLICT");
    }
    this.accept(result, writer);
    this.accept(await this.call<RuntimeAttempt>("claim", this.input()), writer);
    return this.flushPresented();
  }
  stage(answers: WireAnswers) {
    this.requireWriter();
    if (!this.journal || this.journal.submission) throw new ExamRuntimeError("EXAM_SUBMISSION_PENDING");
    this.journal.dirty = answers; this.persist();
  }
  async save() {
    const writer = this.requireWriter();
    return this.serial(async () => {
      await this.drainPresented(writer);
      this.requireWriter(writer);
      const answers = this.journal?.dirty;
      if (!answers || this.journal?.submission) return this.attempt!;
      const result = await this.call<RuntimeAttempt>("save", { ...this.input(), answers });
      this.requireWriter(writer);
      if (this.journal?.dirty === answers) delete this.journal.dirty;
      return this.accept(result, writer);
    });
  }
  // Call only after this Unit's assessment view mounts, never on assignment/read.
  present(unitId: string) {
    this.requireWriter();
    if (!this.journal || this.attempt?.status !== "active" || !this.attempt.questions.some(q => q.id === unitId)) {
      return Promise.reject(new ExamRuntimeError("EXAM_UNKNOWN_UNIT"));
    }
    if (!this.journal.acknowledgedPresentedUnitIds?.includes(unitId)) {
      const pending = [...new Set([...(this.journal.pendingPresentedUnitIds ?? []), unitId])];
      // Do not send until the recovery journal has durably accepted the event.
      this.storage.setItem(this.key, JSON.stringify({ ...this.journal, pendingPresentedUnitIds: pending }));
      this.journal.pendingPresentedUnitIds = pending;
    }
    return this.flushPresented();
  }
  private async drainPresented(writer: WriterLock) {
    this.requireWriter(writer);
    while (this.attempt?.status === "active" && this.journal?.pendingPresentedUnitIds?.length) {
      const unitId = this.journal.pendingPresentedUnitIds[0];
      this.accept(await this.call<RuntimeAttempt>("present", { ...this.input(), unitId }), writer);
      this.journal.acknowledgedPresentedUnitIds = [...new Set([...(this.journal.acknowledgedPresentedUnitIds ?? []), unitId])];
      this.journal.pendingPresentedUnitIds = this.journal.pendingPresentedUnitIds.filter(id => id !== unitId);
      this.persist();
    }
    return this.attempt!;
  }
  async flushPresented() {
    const writer = this.requireWriter();
    return this.serial(() => this.drainPresented(writer));
  }
  async submit(answers: WireAnswers) {
    const writer = this.requireWriter();
    if (!this.journal) throw new ExamRuntimeError("EXAM_DEVICE_REQUIRED");
    this.journal.submission ??= { requestId: crypto.randomUUID(), answers };
    this.persist();
    return this.serial(async () => {
      await this.drainPresented(writer);
      this.requireWriter(writer);
      const result = await this.call<RuntimeAttempt>("submit", { ...this.input(), ...this.journal!.submission });
      this.requireWriter(writer);
      delete this.journal!.dirty; delete this.journal!.submission;
      return this.accept(result, writer);
    });
  }
  async abandon(attemptId: string) {
    const writer = this.requireWriter(await this.acquireWriter());
    try {
      if (this.journal?.attemptId === attemptId && this.journal.pendingPresentedUnitIds?.length && this.attempt?.id !== attemptId) {
        await this.recoverWithWriter(writer);
      }
      return await this.serial(async () => {
        this.requireWriter(writer);
        if (this.attempt?.id === attemptId) await this.drainPresented(writer);
        this.requireWriter(writer);
        await this.call("abandon", { attemptId, confirmed: true });
        this.requireWriter(writer);
        if (!this.journal?.attemptId || this.journal.attemptId === attemptId) this.clear();
        else this.releaseWriter(writer);
      });
    } catch (error) {
      if (!this.attempt) this.releaseWriter(writer);
      throw error;
    }
  }
  keepServerDraft() {
    this.requireWriter();
    if (!this.journal || this.journal.submission) return;
    this.storage.setItem(`${this.key}-conflict-backup`, JSON.stringify(this.journal));
    delete this.journal.dirty; this.persist();
  }
  cancelRejectedSubmission() {
    this.requireWriter();
    if (this.journal) { delete this.journal.submission; this.persist(); }
  }
  setDisplayPreferences(showTimer: boolean, showRanges: boolean) {
    this.requireWriter();
    if (this.journal) { this.journal.showTimer = showTimer; this.journal.showRanges = showRanges; this.persist(); }
  }
  setNavigation(sitting: SittingState) {
    if (!this.writer || !this.journal || this.journal.attemptId !== this.attempt?.id || this.attempt?.status !== "active" || sitting.phase === "complete") return;
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
  clear() {
    const writer = this.requireWriter();
    try { this.storage.removeItem(this.key); this.journal = null; }
    finally { this.releaseWriter(writer); }
  }
}
