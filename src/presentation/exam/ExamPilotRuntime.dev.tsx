import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAppContext } from "../../app/AppProvider";
import { ExamRuntimeError, ExamRuntimeSession, encodeAnswers, runtimeCall, toSitting, type RuntimeAttempt, type ExamKind } from "../../core/examRuntime";
import type { CustomisationCategory } from "../../core/examAuth";
import { ExamSitting, ExitSittingDialog } from "./ExamSitting";
import { sittingReducer, type SittingAction } from "./sittingModel";
import { useExamSitting } from "./ExamSittingContext";
import ExamResultsPresentation from "./ExamResultsPresentation";
import { ConnectedExamErrorLog } from "./ConnectedExamErrorLog";
import { useExamErrorLog } from "./useExamErrorLog";
import { derivePartErrorLogCandidates } from "./errorLogModel";
import type { ErrorLogSavePresentation } from "./errorLogTypes";

import { ExamDashboard } from "./ExamDashboard";
import { ExamHistory } from "./ExamReview";
import { useExamHistory } from "./useExamHistory";
import { historyPresentation } from "../../core/examHistory";
import { unavailableDrills } from "./drillDefinitions";
import { buildSetupPresentation } from "./presentationModel";
import type { ExamPrototypeState, ExamPrototypeConfig } from "./presentationTypes";
const setupConfig: ExamPrototypeConfig = { questionCounts: [5, 10, 15, 20], caseMinimum: 3, caseMaximum: 5, minutesPerDrillQuestion: 1, minutesPerCase: 5, passingTarget: 60 };
type PilotProps = { client: SupabaseClient; userId: string; canStart: boolean; unitCount?: number; allowedUnitCounts?: number[]; customisationCategories?: CustomisationCategory[]; environment?: string };

export default function ExamPilotRuntime({ client, userId, canStart, unitCount, allowedUnitCounts, customisationCategories = [], environment = "clpfecuohwzwrgmqzeos" }: PilotProps) {
  const { state } = useAppContext();
  const { sitting, dispatch: updateSitting } = useExamSitting();
  const preferenceKey = `abgm-exam-custom-${environment}-${userId}`;
  const [examKind, setExamKind] = useState<ExamKind>("mock");
  const [customExclusions, setCustomExclusions] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(preferenceKey) ?? "[]");
      return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === "string"))].sort() : [];
    } catch { return []; }
  });
  const displayKey = `abgm-exam-display-${environment}-${userId}`;
  const counts = allowedUnitCounts ?? (unitCount !== undefined ? [unitCount] : []);
  const [setupState, setSetupState] = useState<ExamPrototypeState>(() => {
    let prefs: { showTimer?: boolean; showRanges?: boolean } = {};
    try { prefs = JSON.parse(localStorage.getItem(displayKey) ?? "{}"); } catch { /* Use defaults. */ }
    return { view: "exam", mode: "mock", selectedDrill: "anion-gap", selectedRule: "met-acidosis", questionCount: 5,
      caseCount: counts.includes(3) ? 3 : counts[0] ?? 3, timed: prefs?.showTimer !== false, showRanges: prefs?.showRanges !== false,
      examKind: "mock", excludedCategories: [], adaptive: false, revealWorking: false, historyFilter: "all" };
  });
  useEffect(() => { if (counts.length && !counts.includes(setupState.caseCount)) setSetupState(old => ({ ...old, caseCount: counts.includes(3) ? 3 : counts[0] })); }, [counts.join(","), setupState.caseCount]);
  function persistDisplay(showTimer: boolean, showRanges: boolean) {
    try { localStorage.setItem(displayKey, JSON.stringify({ showTimer, showRanges })); } catch { /* Display controls remain usable. */ }
    setSetupState(old => ({ ...old, timed: showTimer, showRanges }));
  }
  useEffect(() => {
    try { localStorage.setItem(displayKey, JSON.stringify({ showTimer: setupState.timed, showRanges: setupState.showRanges })); } catch { /* Display choices remain usable. */ }
  }, [displayKey, setupState.timed, setupState.showRanges]);
  function configurationLabel(item: { examKind?: ExamKind; excludedCategories?: string[] }) {
    const label = item.examKind === "custom" ? "Custom Exam" : "Mock Exam";
    const exclusions = item.excludedCategories ?? [];
    return `${label} · ${exclusions.length ? "Excluded: " + exclusions.map(id => customisationCategories.find(c => c.category_id === id)?.label ?? id).join(", ") : "All Parts included"}`;
  }
  const [attempt, setAttempt] = useState<RuntimeAttempt | null>(null);
  const [roomView, setRoomView] = useState<"exam" | "history" | "error-log">("exam");
  const [reviewPartId, setReviewPartId] = useState<string>();
  const sourceOpenVersion = useRef(0);
  const [current, setCurrent] = useState<string | null>(null);
  const resultOrigin = useRef<"exam" | "history" | "error-log">("exam");
  const roomGeneration = useRef(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const answerError = error.includes("server could not accept an answer");
  const [refreshError, setRefreshError] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const inFlight = useRef(false);
  const session = useMemo(() => {
    try { return new ExamRuntimeSession(runtimeCall(client), localStorage, `abgm-exam-pilot-${environment}-${userId}`); }
    catch { return null; }
  }, [client, userId, environment]);
  useEffect(() => { ++sourceOpenVersion.current; setAttempt(null); setCurrent(null); setReady(false); setRoomView("exam"); setReviewPartId(undefined); setError(""); }, [session]);
  const history = useExamHistory(session?.call, `${environment}:${userId}`, !attempt && roomView !== "error-log");
  const historyView = useMemo(() => history.data
    ? historyPresentation(history.data.page, history.data.rows, Object.fromEntries(customisationCategories.map(c => [c.category_id, c.label])))
    : { attempts: [], average: null, best: null, trend: [], totalCases: 0, awaiting: 0 }, [history.data, customisationCategories]);
  const errorLog = useExamErrorLog(session?.call, `${environment}:${userId}`, attempt?.status === "submitted" ? attempt.id : undefined);
  const errorLogPresentation = useMemo<ErrorLogSavePresentation>(() => {
    if (!attempt || !errorLog.data || errorLog.data.attemptId !== attempt.id) return {};
    const answers = toSitting(attempt).answers;
    return Object.fromEntries(attempt.questions.flatMap(q => q.parts).map(part => {
      const result = attempt.parts?.find(p => p.partId === part.id);
      const candidateIds = derivePartErrorLogCandidates({ part, feedback: attempt.feedback?.[part.id],
        grade: result ? { status: result.status, score: result.marksAwarded ?? undefined, criteria: result.criteria ?? undefined } : undefined,
        answer: answers[part.id], catalogue: errorLog.data!.catalogue }).map(c => c.conceptId);
      const saved = errorLog.data!.savedSources[part.id] ?? [];
      return [part.id, [...new Set([...candidateIds, ...saved])].flatMap(id => {
        const definition = errorLog.data!.catalogue.concepts.find(c => c.id === id);
        return definition ? [{ id, label: definition.label, saved: saved.includes(id) }] : [];
      })];
    }));
  }, [attempt, errorLog.data]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; updateSitting({ type: "exit" }); }; }, [updateSitting]);
  function failure(cause: unknown) {
    const code = cause instanceof ExamRuntimeError ? cause.code : "EXAM_UNAVAILABLE";
    setError(/CONFLICT/.test(code) ? "This attempt changed in another tab. Your local answers are retained. Close the other tab before recovering."
      : code === "EXAM_DEVICE_REQUIRED" ? "This attempt can only be continued in the browser where it started. You can abandon it here."
      : code === "EXAM_INVALID_CONFIGURATION" ? "This Custom Exam configuration is unavailable. Refresh your access and try again."
      : /INVALID|ANSWER|SELECTION|NUMERIC|TEXT/.test(code) ? "The server could not accept an answer. Check numeric values and required selections before trying again."
      : code === "EXAM_GRADING_COOLDOWN" ? "Please wait 30 seconds before retrying grading."
      : code === "EXAM_PILOT_CLOSED" ? "New pilot attempts are not open yet."
      : "We couldn’t confirm the operation. Your local answers are retained. Reconnect and retry.");
  }
  async function loadRoom() {
    if (!session) return;
    const generation = ++roomGeneration.current;
    const active = await session.call<{ attempt: { id: string } | null }>("current", {});
    if (mounted.current && roomGeneration.current === generation) { setCurrent(active.attempt?.id ?? null); setReady(true); }
  }
  useEffect(() => {
    void loadRoom().catch(cause => { if (mounted.current) failure(cause); });
    const focus = () => { if (!attempt) void loadRoom().catch(cause => { if (mounted.current) failure(cause); }); };
    window.addEventListener("focus", focus);
    return () => { ++roomGeneration.current; window.removeEventListener("focus", focus); };
  }, [session, !!attempt]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await action(); } catch (cause) { if (mounted.current) failure(cause); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  function show(next: RuntimeAttempt) {
    if (!mounted.current) return;
    setAttempt(next);
    if (next.status === "active" || next.status === "submitted") {
      const display = session?.journal?.attemptId === next.id ? session.journal : undefined;
      updateSitting({ type: "hydrate", sitting: { ...toSitting(next), showTimer: display?.showTimer ?? true, showRanges: display?.showRanges ?? true } });
    }
    else { updateSitting({ type: "exit" }); session?.clear(); setAttempt(null); }
  }
  async function openResult(attemptId: string, origin: "exam" | "history" | "error-log", partId?: string) {
    if (!session) return;
    const request = ++sourceOpenVersion.current;
    let next: RuntimeAttempt;
    try { next = await session.call<RuntimeAttempt>("read", { attemptId }); }
    catch (cause) { if (mounted.current && sourceOpenVersion.current === request) throw cause; return; }
    if (!mounted.current || sourceOpenVersion.current !== request) return;
    if (next.id !== attemptId || next.status !== "submitted" || (partId && !next.questions.some(q => q.parts.some(p => p.id === partId)))) throw new Error("Saved source unavailable");
    resultOrigin.current = origin; setReviewPartId(partId); show(next);
  }
  function enterRoom(view: "exam" | "history" | "error-log") {
    ++sourceOpenVersion.current;
    setRoomView(view);
    if (view === "error-log") void errorLog.refresh();
    else void history.refresh();
    void loadRoom().catch(cause => { if (mounted.current) failure(cause); });
  }
  async function openAttempt(recover: boolean) {
    if (!session) return;
    resultOrigin.current = "exam";
    let next = recover ? await session.recover() : await session.start(state.sessionState?.pressureUnit ?? "mmHg", { examKind, unitCount: setupState.caseCount, showTimer: setupState.timed, showRanges: setupState.showRanges, excludedCategories: examKind === "custom" ? customExclusions.filter(id => customisationCategories.some(c => c.category_id === id)) : [] });
    if (next.status === "active") {
      if (session.journal?.submission) next = await session.submit(session.journal.submission.answers);
      else {
        if (session.journal?.dirty) next = await session.save();
        next = await session.present(next.questions[0].id);
      }
    }
    show(next);
  }
  async function leave() {
    if (!session || !attempt) return;
    await session.abandon(attempt.id);
    updateSitting({ type: "exit" }); setAttempt(null); setExitOpen(false); await loadRoom();
  }
  function dispatch(action: SittingAction) {
    if (!session || !sitting || busy || (error && !answerError) || session.journal?.submission) return;
    if (action.type === "submit") {
      void run(async () => show(await session.submit(encodeAnswers(sitting)))); return;
    }
    if (action.type === "exit") { setExitOpen(true); return; }
    const next = sittingReducer(sitting, action);
    if (!next) return;
    if (action.type === "answer") {
      setError("");
      try { session.stage(encodeAnswers(next)); } catch (cause) { failure(cause); return; }
      void session.save().catch(cause => { if (mounted.current) failure(cause); });
    }
    if (action.type === "timer" || action.type === "ranges") {
      session.setDisplayPreferences(next.showTimer, next.showRanges); persistDisplay(next.showTimer, next.showRanges);
    }
    updateSitting(action);
    if (action.type === "jump" && next.questionIndex !== sitting.questionIndex) {
      void session.present(next.questions[next.questionIndex].id).catch(cause => { if (mounted.current) failure(cause); });
    }
  }
  useEffect(() => {
    if (!sitting || sitting.phase === "complete") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sitting?.phase]);
  const hasPendingGrades = attempt?.status === "submitted" && attempt.parts?.some(p => p.status === "pending");
  useEffect(() => {
    if (!session || !attempt || !hasPendingGrades) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const id = attempt.id;
    async function refresh() {
      try {
        if (document.visibilityState !== "hidden") {
          const next = await session!.call<RuntimeAttempt>("read", { attemptId: id });
          if (!cancelled) { setAttempt(next); setRefreshError(""); }
        }
      } catch { if (!cancelled) setRefreshError("Couldn’t refresh grading. Your submission is saved; we’ll try again."); }
      if (!cancelled) timer = setTimeout(refresh, 5000);
    }
    timer = setTimeout(refresh, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [session, attempt?.id, hasPendingGrades]);
  if (!session) return <p role="alert">Browser storage is unavailable or unreadable. Enable storage before starting an exam.</p>;
  return <section aria-label="Exam pilot">
    {error && <div role="alert"><p>{error}</p>
      <button className="exam-pilot-button" disabled={busy} onClick={() => void run(async () => {
        if (session.journal) await openAttempt(true); else await loadRoom();
      })}>{session.journal?.submission ? "Check submission / retry" : session.journal ? "Recover saved attempt" : "Retry"}</button>
      {!session.journal?.submission && error.includes("another tab") && <button className="exam-pilot-button" disabled={busy} onClick={() => void run(async () => {
        session.keepServerDraft(); await openAttempt(true);
      })}>Use saved server answers (keep local backup)</button>}
      {session.journal?.submission && /could not accept/.test(error) && <button className="exam-pilot-button" onClick={() => {
        session.cancelRejectedSubmission(); setError("");
      }}>Return to answers</button>}
    </div>}
    {sitting && attempt ? sitting.phase === "complete" ? <>
      {refreshError && <p role="status">{refreshError}</p>}
      <p>{configurationLabel(attempt)}</p>
      <ExamResultsPresentation key={`${attempt.id}:${reviewPartId ?? "default"}`} initialPartId={reviewPartId}
        errorLogPresentation={errorLogPresentation} errorLogBusy={errorLog.busy} onErrorLogSave={errorLog.save}
        marksAvailable={attempt.marksAvailable ?? Number.NaN} gradingStatus={attempt.gradingStatus} sitting={sitting} pressureUnit={state.sessionState?.pressureUnit ?? sitting.pressureUnit}
        notice={<>{errorLog.error && <p role="alert">{errorLog.error} <button type="button" onClick={() => void errorLog.refresh()}>Retry Error log</button></p>}<aside className="exam-results__feedback" aria-label="Exam feedback">
          <p>Help us improve with a quick anonymous survey</p>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSdxV6GEYCp5m4jBC4yEu095YjVQtniDPmO3r1HpmywDOND43Q/viewform?usp=publish-editor"
            target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="Share your feedback (opens in a new tab)">Share your feedback <span aria-hidden="true">↗</span></a>
        </aside></>}
        feedback={attempt.feedback ?? {}} grades={Object.fromEntries((attempt.parts ?? []).map(p => [p.partId, { status: p.status, score: p.marksAwarded ?? undefined, criteria: p.criteria ?? undefined }]))}
        onReport={async input => {
          const receipt = await session.call<{ reportId: string }>("report_problem", { ...input, attemptId: attempt.id });
          if (typeof receipt?.reportId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.reportId)) throw new Error("Invalid report receipt");
        }}
        onRetry={attempt.canRetryGrading && !busy ? () => void run(async () => show(await session.call<RuntimeAttempt>("retry_grading", { attemptId: attempt.id }))) : undefined}
        onExit={() => { if (session.journal?.attemptId === attempt.id) session.clear(); updateSitting({ type: "exit" }); setAttempt(null); setReviewPartId(undefined); setRoomView(resultOrigin.current); void run(loadRoom); }} />
    </> : <>
      <ExamSitting sitting={sitting} dispatch={dispatch} onExitConfirmed={() => session.abandon(attempt.id)} disabled={busy || (!!error && !answerError) || !!session.journal?.submission} />
      {exitOpen && <ExitSittingDialog onStay={() => setExitOpen(false)} onExit={() => void run(leave)} />}
    </> : <>
      {roomView === "error-log" ? <ConnectedExamErrorLog key={`${environment}:${userId}`} log={errorLog}
        onBack={() => enterRoom("exam")} onOpenExample={(id, partId) => openResult(id, "error-log", partId)}
        onOpenLatest={history.latestAttemptId ? () => openResult(history.latestAttemptId!, "error-log") : undefined} /> : <>
        {history.error && <p role="alert">{history.error} <button type="button" disabled={history.loading} onClick={() => void history.refresh()}>Retry history</button></p>}
        {roomView === "history" ? <ExamHistory
          history={historyView} unavailable={!history.data}
          attempts={historyView.attempts}
          filter={history.filter} onFilterChange={history.setFilter} onBack={() => enterRoom("exam")}
          onOpen={id => void run(() => openResult(id, "history"))}
          onRetry={id => void run(async () => { await session.call<RuntimeAttempt>("retry_grading", { attemptId: id }); await history.refresh(); })}
          onLoadMore={history.data?.page.nextCursor ? () => void history.loadMore() : undefined}
          total={history.data?.page.total} loading={history.loading} busy={busy} /> : <ExamDashboard
          connected state={{ ...setupState, examKind, excludedCategories: customExclusions.filter(id => id === "mechanical_ventilation" || id === "toxicology_management") }}
          drills={unavailableDrills} drillsUnavailable customDisabled={!customisationCategories.length} config={setupConfig}
          setup={buildSetupPresentation(setupState.questionCount, setupState.caseCount, setupState.timed, setupConfig)}
          caseCounts={counts} launching={busy} beginDisabled={!canStart || !ready || !counts.includes(setupState.caseCount)} setupLocked={busy || !ready || !!current || !!session.journal}
          latestDisabled={!history.latestAttemptId} errorLogCount={errorLog.error ? undefined : errorLog.data?.toReviewCount}
          onSelectDrill={key => setSetupState(old => ({ ...old, selectedDrill: key, selectedRule: unavailableDrills.find(d => d.key === key)?.rules?.[0]?.key ?? "" }))}
          onChange={patch => {
            if (patch.view === "results" && history.latestAttemptId) { void run(() => openResult(history.latestAttemptId!, "exam")); return; }
            if (patch.view === "history" || patch.view === "error-log") { enterRoom(patch.view); return; }
            if (patch.examKind) setExamKind(patch.examKind);
            if (patch.excludedCategories) { setCustomExclusions(patch.excludedCategories); try { localStorage.setItem(preferenceKey, JSON.stringify(patch.excludedCategories)); } catch { /* Keep setup usable. */ } }
            setSetupState(old => ({ ...old, ...patch }));
          }} onBegin={() => void run(() => openAttempt(false))}
          startContent={current || session.journal ? <div className="exam-recovery-actions">
            <p>An attempt is available for recovery in its original browser.</p>
            <button className="figma-button exam-primary" disabled={busy || !ready} onClick={() => void run(() => openAttempt(true))}>Recover attempt</button>
            {current && <button className="figma-button figma-button--secondary" disabled={busy} onClick={() => setExitOpen(true)}>Abandon attempt</button>}
          </div> : undefined} />}
        {exitOpen && current && <ExitSittingDialog onStay={() => setExitOpen(false)} onExit={() => void run(async () => { await session.abandon(current); setExitOpen(false); await loadRoom(); })} />}
      </>}

    </>}
  </section>;
}
