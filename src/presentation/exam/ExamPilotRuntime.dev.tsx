import { ArrowRight, BookOpen, History } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAppContext } from "../../app/AppProvider";
import { ExamRuntimeError, ExamRuntimeSession, encodeAnswers, runtimeCall, toSitting, type RuntimeAttempt } from "../../core/examRuntime";
import { ExamSitting, ExitSittingDialog } from "./ExamSitting";
import { sittingReducer, type SittingAction } from "./sittingModel";
import { useExamSitting } from "./ExamSittingContext";
import ExamResultsPresentation from "./ExamResultsPresentation";

type HistoryItem = { id: string; finishedAt: string; marksAvailable: number };
type PilotProps = { client: SupabaseClient; userId: string; canStart: boolean; unitCount?: number };

export default function ExamPilotRuntime({ client, userId, canStart, unitCount }: PilotProps) {
  const { state } = useAppContext();
  const { sitting, dispatch: updateSitting } = useExamSitting();
  const [attempt, setAttempt] = useState<RuntimeAttempt | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const answerError = error.includes("server could not accept an answer");
  const [refreshError, setRefreshError] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const inFlight = useRef(false);
  const session = useMemo(() => {
    try { return new ExamRuntimeSession(runtimeCall(client), localStorage, `abgm-exam-pilot-clpfecuohwzwrgmqzeos-${userId}`); }
    catch { return null; }
  }, [client, userId]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; updateSitting({ type: "exit" }); }; }, [updateSitting]);
  function failure(cause: unknown) {
    const code = cause instanceof ExamRuntimeError ? cause.code : "EXAM_UNAVAILABLE";
    setError(/CONFLICT/.test(code) ? "This attempt changed in another tab. Your local answers are retained. Close the other tab before recovering."
      : code === "EXAM_DEVICE_REQUIRED" ? "This attempt can only be continued in the browser where it started. You can abandon it here."
      : /INVALID|ANSWER|SELECTION|NUMERIC|TEXT/.test(code) ? "The server could not accept an answer. Check numeric values and required selections before trying again."
      : code === "EXAM_GRADING_COOLDOWN" ? "Please wait 30 seconds before retrying grading."
      : code === "EXAM_PILOT_CLOSED" ? "New pilot attempts are not open yet."
      : "We couldn’t confirm the operation. Your local answers are retained. Reconnect and retry.");
  }
  async function loadRoom() {
    if (!session) return;
    const active = await session.call<{ attempt: { id: string } | null }>("current", {});
    const previous = await session.call<{ attempts: HistoryItem[] }>("history", {});
    if (mounted.current) { setCurrent(active.attempt?.id ?? null); setHistory(previous.attempts); setReady(true); }
  }
  useEffect(() => { void loadRoom().catch(cause => { if (mounted.current) failure(cause); }); }, [session]);
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await action(); } catch (cause) { if (mounted.current) failure(cause); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  function show(next: RuntimeAttempt) {
    if (!mounted.current) return;
    setAttempt(next);
    if (next.status === "active" || next.status === "submitted") updateSitting({ type: "hydrate", sitting: toSitting(next) });
    else { updateSitting({ type: "exit" }); session?.clear(); setAttempt(null); }
  }
  async function openAttempt(recover: boolean) {
    if (!session) return;
    let next = recover ? await session.recover() : await session.start(state.sessionState?.pressureUnit ?? "mmHg");
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
      <ExamResultsPresentation sitting={sitting} pressureUnit={state.sessionState?.pressureUnit ?? sitting.pressureUnit}
        notice={<aside className="exam-results__feedback" aria-label="Exam feedback">
          <p>Help us improve with a quick anonymous survey</p>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSdxV6GEYCp5m4jBC4yEu095YjVQtniDPmO3r1HpmywDOND43Q/viewform?usp=publish-editor"
            target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="Share your feedback (opens in a new tab)">Share your feedback <span aria-hidden="true">↗</span></a>
        </aside>}
        feedback={attempt.feedback ?? {}} grades={Object.fromEntries((attempt.parts ?? []).map(p => [p.partId, { status: p.status, score: p.marksAwarded ?? undefined, criteria: p.criteria ?? undefined }]))}
        onReport={async input => {
          const receipt = await session.call<{ reportId: string }>("report_problem", { ...input, attemptId: attempt.id });
          if (typeof receipt?.reportId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.reportId)) throw new Error("Invalid report receipt");
        }}
        onRetry={attempt.canRetryGrading && !busy ? () => void run(async () => show(await session.call<RuntimeAttempt>("retry_grading", { attemptId: attempt.id }))) : undefined}
        onExit={() => { if (session.journal?.attemptId === attempt.id) session.clear(); updateSitting({ type: "exit" }); setAttempt(null); void run(loadRoom); }} />
    </> : <>
      <ExamSitting sitting={sitting} dispatch={dispatch} onExitConfirmed={() => session.abandon(attempt.id)} disabled={busy || (!!error && !answerError) || !!session.journal?.submission} />
      {exitOpen && <ExitSittingDialog onStay={() => setExitOpen(false)} onExit={() => void run(leave)} />}
    </> : <>
      <div className="exam-pilot-room">
      <header className="exam-page-heading"><p className="exam-eyebrow">Exam practice</p><h1>Exam Room</h1><p>Put your knowledge into practice, then review your answers and feedback.</p></header>
      <section className="exam-pilot-room__start surface" aria-labelledby="pilot-exam-title">
      <span className="exam-icon-badge"><BookOpen size={22} aria-hidden="true" /></span>
      <div className="exam-pilot-room__intro"><h2 id="pilot-exam-title">Test exam</h2><p>{unitCount !== undefined && `${unitCount} ${unitCount === 1 ? "question" : "questions"} · `}Calculations and interpretation</p></div>
      <div className="exam-pilot-room__actions">
      {current || session.journal ? <>
        <p>An attempt is available for recovery in its original browser.</p>
        <button className="exam-pilot-button exam-primary" disabled={busy || !ready} onClick={() => void run(() => openAttempt(true))}>Recover attempt</button>
        {current && <button className="exam-pilot-button" disabled={busy} onClick={() => setExitOpen(true)}>Abandon attempt</button>}
        {exitOpen && current && <ExitSittingDialog onStay={() => setExitOpen(false)} onExit={() => void run(async () => { await session.abandon(current); setExitOpen(false); await loadRoom(); })} />}
      </> : <button className="exam-pilot-button exam-primary" disabled={!canStart || !ready || busy} onClick={() => void run(() => openAttempt(false))}>Start Exam<ArrowRight size={18} aria-hidden="true" /></button>}
      </div></section>
      <section className="exam-pilot-room__history" aria-labelledby="exam-history-title">
        <div className="exam-pilot-room__history-heading"><History size={20} aria-hidden="true" /><h2 id="exam-history-title">Submitted exams</h2></div>
        {!ready ? <p className="exam-pilot-room__empty" role="status">Loading your exams…</p> : !history.length ? <p className="exam-pilot-room__empty surface">Your submitted exams will appear here for you to review.</p> :
          <ul className="exam-pilot-room__list surface">{history.map(item => <li key={item.id}>
            <button className="exam-pilot-room__review" disabled={busy} onClick={() => void run(async () => show(await session.call<RuntimeAttempt>("read", { attemptId: item.id })))}>
              <span><strong>Review exam</strong><time dateTime={item.finishedAt}>{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.finishedAt))}</time></span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </li>)}</ul>}
      </section></div>
    </>}
  </section>;
}
