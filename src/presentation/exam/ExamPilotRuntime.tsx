import { useAccountBrowserStorage } from "../../app/AccountWorkspace";
import { examKindLabel } from "./examLabels";
import { ExamNotice, NoticeMessage, RetryAction } from "./ExamNotice";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAppContext } from "../../app/AppProvider";
import { ExamRuntimeError, ExamRuntimeSession, encodeAnswers, runtimeCall, toSitting, type RuntimeAttempt, type ExamKind } from "../../core/examRuntime";
import { parseTrialLifecycle, type TrialLifecycle, type CustomisationCategory, type TrialAvailability } from "../../core/examAuth";
import { ExamSitting, ExitSittingDialog } from "./ExamSitting";
import { sittingReducer, type SittingAction } from "./sittingModel";
import { useExamSitting } from "./ExamSittingContext";
import ExamResultsPresentation from "./ExamResultsPresentation";
import { ConnectedExamErrorLog } from "./ConnectedExamErrorLog";
import { useExamErrorLog } from "./useExamErrorLog";
import { useExamFeedback } from "./useExamFeedback";
import { useExamFeedbackTone } from "./useExamFeedbackTone";
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
type RoomView = "exam" | "history" | "error-log";
type ExamNavigation = { account: string; view: RoomView | "results"; attemptId?: string; partId?: string; origin?: RoomView; returnKey?: string };
export type ExamDashboardControls = {
  fullSetup: ReactNode;
  trialSetup: ReactNode;
  trialLifecycle?: TrialLifecycle;
  completedTrial?: RuntimeAttempt;
  openTrialResult: () => void;
  refreshTrial: () => void;
  withSetup: (content: ReactNode, overviewHero?: ReactNode) => ReactNode;
  canRecover: boolean; ready: boolean; busy: boolean; canBegin: boolean;
  timed: boolean; showRanges: boolean;
  setTimed: (value: boolean) => void; setShowRanges: (value: boolean) => void;
  begin: () => void;
};
export type ExamAccessNotice = { visible: boolean; busy: boolean; onRetry: () => void };
type PilotProps = { accessNotice?: ExamAccessNotice; onReturnToDashboard?: () => void; trialAccessMessage?: string; trialAvailability?: TrialAvailability; onRetryTrial?: () => void; client: SupabaseClient; userId: string; canStart: boolean; canStartStandard: boolean; limitedDashboard?: boolean; unitCount?: number; allowedUnitCounts?: number[]; customisationCategories?: CustomisationCategory[]; environment?: string; renderDashboard?: (controls: ExamDashboardControls) => ReactNode };

export default function ExamPilotRuntime({ accessNotice, onReturnToDashboard, trialAccessMessage, trialAvailability = "error", onRetryTrial, client, userId, canStart, canStartStandard, limitedDashboard = false, unitCount, allowedUnitCounts, customisationCategories = [], environment = "clpfecuohwzwrgmqzeos", renderDashboard }: PilotProps) {
  const browserStorage = useAccountBrowserStorage();
  const location = useLocation();
  const navigate = useNavigate();
  const account = `${environment}:${userId}`;
  const navigation: ExamNavigation | undefined = location.state?.examNavigation?.account === account ? location.state.examNavigation : undefined;
  const resultCache = useMemo(() => new Map<string, RuntimeAttempt>(), [account]);
  const [pendingResult, setPendingResult] = useState<RuntimeAttempt | null>(null);
  function pushView(view: ExamNavigation) {
    void navigate(`${location.pathname}${location.search}${location.hash}`, {
      state: { ...location.state, examNavigation: { ...view, account, returnKey: location.key } },
    });
  }
  function backToRoom() {
    if (onReturnToDashboard && attempt?.status === "submitted" && resultOrigin.current === "exam") {
      onReturnToDashboard(); return;
    }
    if (navigation?.returnKey) void navigate(-1);
    else enterRoom(resultOrigin.current);
  }
  const { state, patchSessionState } = useAppContext();
  const { sitting, dispatch: updateSitting } = useExamSitting();
  const preferenceKey = `abgm-exam-custom-${environment}-${userId}`;
  const [examKind, setExamKind] = useState<ExamKind>("mock");
  const [customExclusions, setCustomExclusions] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(browserStorage.getItem(preferenceKey) ?? "[]");
      return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === "string"))].sort() : [];
    } catch { return []; }
  });
  const displayKey = `abgm-exam-display-${environment}-${userId}`;
  const counts = allowedUnitCounts ?? (unitCount !== undefined ? [unitCount] : []);
  const [setupState, setSetupState] = useState<ExamPrototypeState>(() => {
    let prefs: { showTimer?: boolean; showRanges?: boolean } = {};
    try { prefs = JSON.parse(browserStorage.getItem(displayKey) ?? "{}"); } catch { /* Use defaults. */ }
    return { view: "exam", mode: "mock", selectedDrill: "anion-gap", selectedRule: "met-acidosis", questionCount: 5,
      caseCount: counts.includes(3) ? 3 : counts[0] ?? 3, timed: prefs?.showTimer !== false, showRanges: prefs?.showRanges !== false,
      examKind: "mock", excludedCategories: [], adaptive: false, revealWorking: false, historyFilter: "all" };
  });
  useEffect(() => { if (counts.length && !counts.includes(setupState.caseCount)) setSetupState(old => ({ ...old, caseCount: counts.includes(3) ? 3 : counts[0] })); }, [counts.join(","), setupState.caseCount]);
  function persistDisplay(showTimer: boolean, showRanges: boolean) {
    try { browserStorage.setItem(displayKey, JSON.stringify({ showTimer, showRanges })); } catch { /* Display controls remain usable. */ }
    setSetupState(old => ({ ...old, timed: showTimer, showRanges }));
  }
  useEffect(() => {
    try { browserStorage.setItem(displayKey, JSON.stringify({ showTimer: setupState.timed, showRanges: setupState.showRanges })); } catch { /* Display choices remain usable. */ }
  }, [displayKey, setupState.timed, setupState.showRanges]);
  function configurationLabel(item: { examKind?: ExamKind; excludedCategories?: string[] }) {
    const label = examKindLabel(item.examKind);
    const exclusions = item.excludedCategories ?? [];
    return `${label} · ${exclusions.length ? "Excluded: " + exclusions.map(id => customisationCategories.find(c => c.category_id === id)?.label ?? id).join(", ") : "All Parts included"}`;
  }
  const [trialLifecycle, setTrialLifecycle] = useState<TrialLifecycle>();
  const [trialFailure, setTrialFailure] = useState<TrialAvailability | null>(null);
  useEffect(() => { setTrialFailure(null); }, [trialAvailability]);
  const trialStatus = trialFailure ?? trialAvailability;
  const [attempt, setAttempt] = useState<RuntimeAttempt | null>(null);
  const [roomView, setRoomView] = useState<"exam" | "history" | "error-log">("exam");
  const [trialRecap, setTrialRecap] = useState<{ account: string; result: RuntimeAttempt }>();
  const [reviewPartId, setReviewPartId] = useState<string>();
  const sourceOpenVersion = useRef(0);
  const [current, setCurrent] = useState<string | null>(null);
  const resultOrigin = useRef<"exam" | "history" | "error-log">("exam");
  const roomGeneration = useRef(0);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scheduleSave = useRef<() => void>(() => {});
  const cancelSave = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [runtimeError, setRuntimeError] = useState<{ message: string; transportFailure: boolean } | null>(null);
  const error = runtimeError?.message ?? "";
  function setError(message: string, transportFailure = false) { setRuntimeError(message ? { message, transportFailure } : null); }
  const answerError = error.includes("We couldn't accept that answer.");
  const [refreshError, setRefreshError] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [exitError, setExitError] = useState("");
  function openExit() { setExitError(""); setExitOpen(true); }
  const inFlight = useRef(false);
  const session = useMemo(() => {
    try { return new ExamRuntimeSession(runtimeCall(client), browserStorage, `abgm-exam-pilot-${environment}-${userId}`); }
    catch { return null; }
  }, [client, userId, environment]);
  useEffect(() => { ++sourceOpenVersion.current; setAttempt(null); setCurrent(null); setReady(false); setRoomView("exam"); setReviewPartId(undefined); setError(""); }, [session]);
  const feedbackPreference = useExamFeedbackTone(session?.call, account);
  const history = useExamHistory(session?.call, `${environment}:${userId}`, !attempt && roomView !== "error-log");
  const historyView = useMemo(() => history.data
    ? historyPresentation(history.data.page, history.data.rows, Object.fromEntries(customisationCategories.map(c => [c.category_id, c.label])))
    : { attempts: [], average: null, best: null, trend: [], totalCases: 0, awaiting: 0 }, [history.data, customisationCategories]);
  const errorLog = useExamErrorLog(session?.call, `${environment}:${userId}`, attempt?.status === "submitted" ? attempt.id : undefined);
  const supportsFeedback = attempt?.feedbackTone !== undefined;
  const aiFeedback = useExamFeedback(session?.call, account, supportsFeedback && attempt?.status === "submitted" ? attempt.id : undefined);
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
    const connectionFailure = code === "EXAM_UNAVAILABLE" && cause instanceof ExamRuntimeError && cause.transportFailure === true && !session?.journal?.submission;
    if (code === "EXAM_TRIAL_DISABLED" || code === "EXAM_TRIAL_CONFIGURATION") {
      setTrialFailure(code === "EXAM_TRIAL_DISABLED" ? "disabled" : "error"); setError(""); return;
    }
    setError(/CONFLICT/.test(code) ? "Your exam is out of sync. Your answers are saved in this browser. Close any other tabs with this exam open, then retry."
      : code === "EXAM_TRIAL_UNAVAILABLE" ? "You've already submitted your trial exam. Return to Exam to check its progress or results."
      : code === "EXAM_TRIAL_RELEASED" ? "We couldn't finish marking your trial exam. Your trial has been restored, so you can start a new one from Exam."
      : code === "EXAM_DEVICE_REQUIRED" ? "This exam can't be continued in this browser. Return to the browser where you started it, or abandon the exam here."
      : code === "EXAM_INVALID_CONFIGURATION" ? "These Custom Exam settings are no longer available. Refresh your exam access, then try again."
      : /INVALID|ANSWER|SELECTION|NUMERIC|TEXT/.test(code) ? "We couldn't accept that answer. Check your numbers and required selections, then try again."
      : code === "EXAM_GRADING_COOLDOWN" ? "Grading was just retried. Please wait 30 seconds before trying again."
      : code === "EXAM_PILOT_CLOSED" ? "New pilot exams aren't available yet. Please check back later."
      : connectionFailure ? "We've lost connection. Check your connection, then retry to continue your exam."
      : "We couldn't confirm your last action. Your answers are saved in this browser. Check your connection, then retry.", connectionFailure);
  }
  async function loadRoom() {
    if (!session) return;
    const generation = ++roomGeneration.current;
    const lifecycle = await session.call<unknown>("trial_status", {}).catch(() => undefined);
    if (mounted.current && roomGeneration.current === generation) setTrialLifecycle(parseTrialLifecycle(lifecycle));
    const active = await session.call<{ attempt: { id: string } | null }>("current", {});
    if (mounted.current && roomGeneration.current === generation) { setCurrent(active.attempt?.id ?? null); setReady(true); }
  }
  useEffect(() => {
    void loadRoom().catch(cause => { if (mounted.current) failure(cause); });
    const focus = () => { if (!attempt) void loadRoom().catch(cause => { if (mounted.current) failure(cause); }); };
    window.addEventListener("focus", focus);
    return () => { ++roomGeneration.current; window.removeEventListener("focus", focus); };
  }, [session, !!attempt]);

  useEffect(() => {
    if (attempt || trialLifecycle?.state !== "reserved") return;
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void loadRoom().catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [session, !!attempt, trialLifecycle?.state]);
  const recapId = limitedDashboard && renderDashboard && roomView === "exam" && !attempt && !current &&
    trialLifecycle?.state === "consumed" ? trialLifecycle.attemptId : null;
  useEffect(() => {
    if (!session || !recapId) return;
    let cancelled = false;
    const cached = resultCache.get(recapId);
    const result = cached?.gradingStatus === "completed" ? Promise.resolve(cached) : session.call<RuntimeAttempt>("read", { attemptId: recapId });
    void result.then(next => {
      if (cancelled || next.id !== recapId || next.purpose !== "trial" || next.status !== "submitted" || next.gradingStatus !== "completed") return;
      resultCache.set(recapId, next);
      setTrialRecap({ account, result: next });
    }).catch(() => { /* The dashboard and saved-result links remain available. */ });
    return () => { cancelled = true; };
  }, [account, recapId, resultCache, session]);
  // Stage every edit immediately; only remote saves wait for a pause in typing.
  useEffect(() => {
    let cancelled = false;
    let saving = false;
    let due = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      due = false;
    };
    async function flush() {
      if (cancelled || saving || !due || !session?.journal?.dirty || session.journal.submission) return;
      due = false;
      saving = true;
      try { await session.save(); }
      catch (cause) { cancel(); if (!cancelled && mounted.current) failure(cause); }
      finally {
        saving = false;
        if (!cancelled && due) void flush();
      }
    }
    const schedule = () => {
      cancel();
      timer = setTimeout(() => { timer = undefined; due = true; void flush(); }, 500);
    };
    scheduleSave.current = schedule;
    cancelSave.current = cancel;
    return () => {
      cancelled = true;
      cancel();
      if (scheduleSave.current === schedule) scheduleSave.current = () => {};
      if (cancelSave.current === cancel) cancelSave.current = () => {};
    };
  }, [session]);
  async function run(action: () => Promise<void>, submission = false, retainError = false, onFailure = failure) {
    if (inFlight.current) return;
    const submittingOperation = submission || Boolean(session?.journal?.submission);
    if (submittingOperation) { cancelSave.current(); setSubmitting(true); }
    inFlight.current = true; setBusy(true); if (!retainError) setError("");
    try { await action(); if (retainError && mounted.current) setError(""); } catch (cause) { if (mounted.current) onFailure(cause); }
    finally { inFlight.current = false; if (mounted.current) { setBusy(false); if (submittingOperation) setSubmitting(false); } }
  }
  function show(next: RuntimeAttempt, recordResult = false) {
    if (!mounted.current) return;
    setAttempt(next);
    if (recordResult && next.status === "submitted") setPendingResult(next);
    if (next.status === "active" || next.status === "submitted") {
      const display = session?.journal?.attemptId === next.id ? session.journal : undefined;
      updateSitting({ type: "hydrate", sitting: { ...toSitting(next, display?.navigation), showTimer: display?.showTimer ?? true, showRanges: display?.showRanges ?? true } });
    }
    else { updateSitting({ type: "exit" }); session?.clear(); setAttempt(null); }
  }
  async function readResult(attemptId: string, partId?: string) {
    const next = await session!.call<RuntimeAttempt>("read", { attemptId });
    if (next.id !== attemptId || next.status !== "submitted" || (partId && !next.questions.some(q => q.parts.some(p => p.id === partId)))) throw new Error("Saved source unavailable");
    return next;
  }
  async function openResult(attemptId: string, origin: "exam" | "history" | "error-log", partId?: string) {
    if (!session) return;
    const request = ++sourceOpenVersion.current;
    let next: RuntimeAttempt;
    try { next = await readResult(attemptId, partId); }
    catch (cause) { if (mounted.current && sourceOpenVersion.current === request) throw cause; return; }
    if (!mounted.current || sourceOpenVersion.current !== request) return;
    resultCache.set(next.id, next);
    pushView({ account, view: "results", attemptId: next.id, partId, origin });
  }
  function enterRoom(view: "exam" | "history" | "error-log") {
    pushView({ account, view });
  }
  function restoreRoom(view: RoomView) {
    ++sourceOpenVersion.current;
    setAttempt(null); setReviewPartId(undefined); updateSitting({ type: "exit" });
    setRoomView(view);
    if (view === "error-log") void errorLog.refresh();
    else void history.refresh();
    void loadRoom().catch(cause => { if (mounted.current) failure(cause); });
  }
  // Record only screen identity in browser history; answers and grades stay in the runtime.
  useEffect(() => {
    const entry: ExamNavigation | undefined = location.state?.examNavigation?.account === account ? location.state.examNavigation : undefined;
    const request = ++sourceOpenVersion.current;
    if (entry?.view === "results" && entry.attemptId) {
      resultOrigin.current = entry.origin ?? "exam";
      setReviewPartId(entry.partId);
      const cached = resultCache.get(entry.attemptId);
      if (cached) show(cached);
      else if (session) {
        setAttempt(null); updateSitting({ type: "exit" });
        setBusy(true);
        void readResult(entry.attemptId, entry.partId).then(next => {
          if (!mounted.current || sourceOpenVersion.current !== request) return;
          resultCache.set(next.id, next); show(next);
        }).catch(cause => { if (mounted.current && sourceOpenVersion.current === request) failure(cause); })
          .finally(() => { if (mounted.current && sourceOpenVersion.current === request) setBusy(false); });
      }
    } else {
      if (session && session.journal?.attemptId === attempt?.id && attempt?.status === "submitted") session.clear();
      restoreRoom(entry?.view === "history" || entry?.view === "error-log" ? entry.view : "exam");
      setBusy(false);
    }
    return () => { ++sourceOpenVersion.current; };
  }, [location.key, session]);
  useEffect(() => {
    if (attempt?.status === "submitted") resultCache.set(attempt.id, attempt);
  }, [attempt, resultCache]);
  // Navigate after hydration so the active-sitting exit guard sees completed Results.
  useEffect(() => {
    if (!pendingResult || sitting?.phase !== "complete") return;
    resultCache.set(pendingResult.id, pendingResult);
    setPendingResult(null);
    pushView({ account, view: "results", attemptId: pendingResult.id, origin: resultOrigin.current });
  }, [pendingResult, sitting?.phase]);
  async function openAttempt(recover: boolean, trial = false) {
    if (!session) return;
    if (!recover) {
      if (trial) {
        if (!canStart || trialStatus !== "ready" || trialLifecycle?.state !== "available") return;
        if (!await feedbackPreference.confirmForStart("professional")) throw new Error("Could not prepare trial feedback. Please try again.");
      } else if (!await feedbackPreference.confirmForStart()) return;
    }
    resultOrigin.current = "exam";
    let next = recover ? await session.recover() : await session.start(state.sessionState?.pressureUnit ?? "mmHg", { purpose: trial ? "trial" : "standard", examKind: trial ? "mock" : examKind, unitCount: trial ? 3 : setupState.caseCount, showTimer: setupState.timed, showRanges: setupState.showRanges, excludedCategories: !trial && examKind === "custom" ? customExclusions.filter(id => customisationCategories.some(c => c.category_id === id)) : [] });
    if (next.status === "active") {
      if (session.journal?.submission) next = await session.submit(session.journal.submission.answers);
      else {
        if (session.journal?.dirty) next = await session.save();
        const navigation = session.journal?.attemptId === next.id ? session.journal.navigation : undefined;
        const restored = toSitting(next, navigation);
        next = await session.present(next.questions[restored.questionIndex].id);
      }
    }
    show(next, next.status === "submitted");
  }
  async function leave() {
    if (!session || !attempt) return;
    await abandonAttempt(attempt.id);
    updateSitting({ type: "exit" }); setAttempt(null); setExitOpen(false); await loadRoom();
  }
  async function abandonAttempt(attemptId: string) {
    cancelSave.current();
    await session!.abandon(attemptId);
  }
  function dispatch(action: SittingAction) {
    if (!session || !sitting || busy || (error && !answerError) || session.journal?.submission) return;
    if (action.type === "submit") {
      void run(async () => show(await session.submit(encodeAnswers(sitting)), true), true); return;
    }
    if (action.type === "exit") { openExit(); return; }
    const next = sittingReducer(sitting, action);
    if (!next) return;
    if (action.type === "answer") {
      setError("");
      try { session.stage(encodeAnswers(next)); } catch (cause) { failure(cause); return; }
      scheduleSave.current();
    }
    if (action.type === "timer" || action.type === "ranges") {
      session.setDisplayPreferences(next.showTimer, next.showRanges); persistDisplay(next.showTimer, next.showRanges);
    }
    if (next !== sitting && (action.type === "jump" || action.type === "review" || action.type === "return")) session.setNavigation(next);
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
  useEffect(() => {
    if (attempt?.status === "submitted" && attempt.gradingStatus === "completed") void loadRoom().catch(() => undefined);
  }, [attempt?.id, attempt?.gradingStatus]);
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
      } catch { if (!cancelled) setRefreshError("We couldn't check your grading progress. Your exam has been submitted, and we'll try again automatically."); }
      if (!cancelled) timer = setTimeout(refresh, 5000);
    }
    timer = setTimeout(refresh, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [session, attempt?.id, hasPendingGrades]);
  function dashboard(setupContent?: ReactNode, trial = false, overviewHero?: ReactNode) {
    if (!session) return null;
    const trialUnavailable = trial && !preparing && !current && !session.journal && (!canStart || trialStatus !== "ready" || trialLifecycle?.state !== "available");
    return (<>
      {trialUnavailable && <ExamNotice role={canStart && trialStatus === "error" ? "alert" : "status"}>
        <NoticeMessage message={!canStart ? trialAccessMessage ?? "Your account doesn't have access to the trial exam. Sign in with an account invited to the pilot." : trialLifecycle && trialLifecycle.state !== "available" ? "You've already started your trial exam. Return to Exam to continue it or view your results." : trialStatus === "disabled" ? "The trial exam isn't available right now. Please try again later." : "We couldn't get your trial exam ready. Please try again."} />{" "}
        {canStart && trialStatus === "error" && <RetryAction busy={accessNotice?.busy ?? busy} onClick={() => { setTrialFailure(null); onRetryTrial?.(); }} />}
      </ExamNotice>}
      <ExamDashboard trial={trial} setupContent={setupContent} overviewHero={overviewHero}
          hideModeSwitch={limitedDashboard}
          navigationVisibility={limitedDashboard ? { latestResult: Boolean(history.latestAttemptId), pastAttempts: Boolean(history.latestAttemptId), errorLog: trialLifecycle?.state === "consumed" || Boolean(errorLog.data?.entries.length) } : undefined}
          feedbackPreference={feedbackPreference}
          pressureUnit={state.sessionState?.pressureUnit ?? "mmHg"}
          onPressureUnitChange={pressureUnit => {
            patchSessionState({ pressureUnit });
            state.storage?.savePressureUnitPreference(pressureUnit);
          }}
          connected state={{ ...setupState, ...(trial ? { caseCount: 3, mode: "mock" as const } : {}), examKind: trial ? "mock" : examKind, excludedCategories: customExclusions.filter(id => id === "mechanical_ventilation" || id === "toxicology_management") }}
          drills={unavailableDrills} drillsUnavailable customDisabled={!customisationCategories.length} config={setupConfig}
          setup={buildSetupPresentation(setupState.questionCount, setupState.caseCount, setupState.timed, setupConfig)}
          caseCounts={trial ? [3] : counts} launching={preparing} beginDisabled={!canStart || !ready || (trial ? (trialStatus !== "ready" || trialLifecycle?.state !== "available") : (!canStartStandard || !counts.includes(setupState.caseCount))) || (trial && (!feedbackPreference.ready || feedbackPreference.busy))} setupLocked={busy || !ready || !!current || !!session.journal}
          latestDisabled={busy || !history.latestAttemptId} errorLogCount={errorLog.error ? undefined : errorLog.data?.toReviewCount}
          onSelectDrill={key => setSetupState(old => ({ ...old, selectedDrill: key, selectedRule: unavailableDrills.find(d => d.key === key)?.rules?.[0]?.key ?? "" }))}
          onChange={patch => {
            if (patch.view === "results" && history.latestAttemptId) { void run(() => openResult(history.latestAttemptId!, "exam")); return; }
            if (patch.view === "history" || patch.view === "error-log") { enterRoom(patch.view); return; }
            if (patch.examKind) setExamKind(patch.examKind);
            if (patch.excludedCategories) { setCustomExclusions(patch.excludedCategories); try { browserStorage.setItem(preferenceKey, JSON.stringify(patch.excludedCategories)); } catch { /* Keep setup usable. */ } }
            setSetupState(old => ({ ...old, ...patch }));
          }} onBegin={() => void run(async () => {
            setPreparing(true);
            try { await openAttempt(false, trial); }
            finally { if (mounted.current) setPreparing(false); }
          })}
          startContent={!preparing && (current || session.journal) ? <div className="exam-recovery-actions">
            <p>Would you like to recover your previous session?</p>
            <button className="figma-button exam-primary" disabled={busy || !ready} onClick={() => void run(() => openAttempt(true))}>Recover attempt</button>
            {current && <button className="figma-button figma-button--secondary" disabled={busy} onClick={openExit}>Abandon attempt</button>}
          </div> : trialUnavailable ? <div>
            <button className="figma-button exam-primary exam-start" disabled>Begin Trial Exam</button>
          </div> : undefined} /></>); }
  if (!session) return <ExamNotice><NoticeMessage message="Your browser isn't saving exam data. Enable browser storage before starting an exam so your progress can be saved." /></ExamNotice>;
  return <section aria-label="Exam pilot">
    <div className="exam-notice-slot">
    {error ? <div className="exam-notice" role={runtimeError?.transportFailure ? "status" : "alert"}><p><NoticeMessage message={error} />{" "}
      <RetryAction busy={busy} onClick={() => {
        if (inFlight.current) return;
        if (runtimeError?.transportFailure) accessNotice?.onRetry();
        void run(async () => {
        if (navigation?.view === "results" && navigation.attemptId) {
          const request = ++sourceOpenVersion.current;
          let next: RuntimeAttempt;
          try { next = await readResult(navigation.attemptId, navigation.partId); }
          catch (cause) { if (mounted.current && sourceOpenVersion.current === request) throw cause; return; }
          if (mounted.current && sourceOpenVersion.current === request) { resultCache.set(next.id, next); show(next); }
        }
        else if (session.journal) await openAttempt(true); else await loadRoom();
      }, false, true);
      }}>{session.journal?.submission ? "Check submission / retry" : runtimeError?.transportFailure ? "Retry" : session.journal ? "Recover saved attempt" : "Retry"}</RetryAction></p>
      {!session.journal?.submission && error.includes("Your exam is out of sync.") && <RetryAction busy={busy} onClick={() => void run(async () => {
        session.keepServerDraft(); await openAttempt(true);
      }, false, true)}>Use saved server answers (keep local backup)</RetryAction>}
      {session.journal?.submission && answerError && <button type="button" className="exam-notice__retry" disabled={busy} onClick={() => {
        session.cancelRejectedSubmission(); setError("");
      }}>Return to answers</button>}
    </div> : attempt?.status === "submitted" && refreshError ? <ExamNotice role="status"><NoticeMessage message={refreshError} /></ExamNotice>
    : !attempt && roomView !== "error-log" && history.error ? <ExamNotice><NoticeMessage message={history.error} />{" "}<RetryAction busy={history.loading} onClick={() => void history.refresh()}>Retry history</RetryAction></ExamNotice>
    : accessNotice?.visible ? <div className="exam-notice" role="status" aria-live="polite">
      <strong>We're having trouble checking your exam access.</strong>{" "}You can keep working while we try again.{" "}
      <RetryAction busy={accessNotice.busy} onClick={accessNotice.onRetry} />
    </div> : null}
    </div>
    {sitting && attempt ? sitting.phase === "complete" ? <>
      {attempt.examKind === "custom" && <p>{configurationLabel(attempt)}</p>}
      <ExamResultsPresentation key={`${attempt.id}:${reviewPartId ?? "default"}`} initialPartId={reviewPartId}
        errorLogPresentation={errorLogPresentation} errorLogBusy={errorLog.busy} onErrorLogSave={errorLog.save}
        aiFeedback={supportsFeedback ? aiFeedback : undefined}
        marksAvailable={attempt.marksAvailable ?? Number.NaN} gradingStatus={attempt.gradingStatus} sitting={sitting} pressureUnit={state.sessionState?.pressureUnit ?? sitting.pressureUnit}
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
        onExit={backToRoom} />
    </> : <>
      <ExamSitting sitting={sitting} dispatch={dispatch} onExitConfirmed={() => abandonAttempt(attempt.id)} submitting={submitting} disabled={busy || (!!error && !answerError) || !!session.journal?.submission} />
      {exitOpen && <ExitSittingDialog busy={busy} error={exitError} onStay={() => setExitOpen(false)} onExit={() => void run(leave, false, true, () => setExitError("We couldn't confirm that you've exited the exam. Check your connection, then try again."))} />}
    </> : <>
      {roomView === "error-log" ? <ConnectedExamErrorLog key={`${environment}:${userId}`} log={errorLog}
        onBack={backToRoom} onOpenExample={(id, partId) => openResult(id, "error-log", partId)}
        onOpenLatest={history.latestAttemptId ? () => openResult(history.latestAttemptId!, "error-log") : undefined} /> : <>
        {roomView === "history" ? <ExamHistory
          history={historyView} unavailable={!history.data}
          attempts={historyView.attempts}
          filter={history.filter} onFilterChange={history.setFilter} onBack={backToRoom}
          onOpen={id => void run(() => openResult(id, "history"))}
          onRetry={id => void run(async () => { await session.call<RuntimeAttempt>("retry_grading", { attemptId: id }); await history.refresh(); })}
          onLoadMore={history.data?.page.nextCursor ? () => void history.loadMore() : undefined}
          total={history.data?.page.total} loading={history.loading} busy={busy} loadMoreError={history.loadMoreError} /> : renderDashboard ? renderDashboard({ refreshTrial: () => void run(loadRoom), trialLifecycle, openTrialResult: () => { if (trialLifecycle?.attemptId) void run(() => openResult(trialLifecycle.attemptId!, "exam")); }, fullSetup: dashboard(), trialSetup: dashboard(undefined, true), withSetup: (content, hero) => dashboard(content, false, hero),
          completedTrial: trialRecap?.account === account && trialRecap.result.id === recapId ? trialRecap.result : undefined,
          canRecover: !preparing && Boolean(current || session.journal), ready, busy: busy || preparing,
          canBegin: canStart && ready && !busy && !preparing && counts.includes(setupState.caseCount) && feedbackPreference.canBegin,
          timed: setupState.timed, showRanges: setupState.showRanges,
          setTimed: timed => persistDisplay(timed, setupState.showRanges),
          setShowRanges: showRanges => persistDisplay(setupState.timed, showRanges),
          begin: () => void run(async () => { setPreparing(true); try { await openAttempt(false); } finally { if (mounted.current) setPreparing(false); } })
        }) : dashboard()}
        {exitOpen && current && <ExitSittingDialog busy={busy} error={exitError} onStay={() => setExitOpen(false)} onExit={() => void run(async () => { await abandonAttempt(current); setExitOpen(false); await loadRoom(); }, false, true, () => setExitError("We couldn't confirm that you've exited the exam. Check your connection, then try again."))} />}
      </>}

    </>}
  </section>;
}
