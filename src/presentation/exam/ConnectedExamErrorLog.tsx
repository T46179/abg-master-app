import { useDrillSession } from "./useDrillSession";
import { DrillRunner } from "./DrillRunner";
import { compensationRules, drillDefinitions } from "./drillDefinitions";
import type { DrillLoader } from "../../core/examDrills";
import type { PressureUnit } from "../../core/types";
import type { DrillTarget } from "./errorLogTypes";
import { useCallback, useEffect, useSyncExternalStore, useLayoutEffect, useRef, useState } from "react";
import { ExamErrorLog } from "./ExamErrorLog";
import { examKindLabel } from "./examLabels";
import { BackLink } from "./ExamUi";
import { ExamNotice, NoticeMessage, RetryAction } from "./ExamNotice";
import type { ErrorLogConceptPresentation, ErrorLogExample } from "./errorLogTypes";
import type { useExamErrorLog } from "./useExamErrorLog";

import { examplesFor, type ExamplePages } from "./errorLogExamples";

const emptyPages: ExamplePages = {};
const emptySnapshot = () => emptyPages;
const emptySubscribe = () => () => {};
const date = (value: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(value));

export function ConnectedExamErrorLog({ log, onBack, onOpenExample, onOpenLatest, loadDrill, pressureUnit = "mmHg" }: {
  loadDrill?: DrillLoader; pressureUnit?: PressureUnit;
  log: ReturnType<typeof useExamErrorLog>; onBack: () => void;
  onOpenExample: (attemptId: string, partId: string) => Promise<void>; onOpenLatest?: () => Promise<void>;
}) {
  const drill = useDrillSession(loadDrill);
  const origin = useRef<{ id: string; scroll: number } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const returning = useRef(false);
  function practice(id: string, target: DrillTarget) {
    origin.current = { id, scroll: window.scrollY };
    setActionError(null);
    const input = target.drill === "anion-gap" || target.drill === "corrections"
      ? { drill: target.drill, count: 5 as const } : { ...target, count: 5 as const, pressureUnit };
    void drill.start(input);
  }
  function exitDrill() {
    returning.current = true;
    drill.close();
  }
  useLayoutEffect(() => {
    if (drill.session || !returning.current || !origin.current) return;
    const { id, scroll } = origin.current;
    returning.current = false;
    origin.current = null;
    window.scrollTo(0, scroll);
    const button = list.current?.querySelector<HTMLButtonElement>(`[data-practice="${id}"]`);
    if (button) {
      const bounds = button.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) button.scrollIntoView({ block: "nearest" });
      button.focus({ preventScroll: true });
    } else list.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [drill.session]);
  const refresh = log.refresh;
  useEffect(() => { void refresh(false); }, [refresh]);
  const cache = log.client ? examplesFor(log.client) : null;
  const pages = useSyncExternalStore(cache?.subscribe ?? emptySubscribe, cache?.snapshot ?? emptySnapshot);
  useLayoutEffect(() => { if (log.data) cache?.reconcile(log.data.entries); }, [cache, log.data]);
  const expand = useCallback((id: string) => {
    if (!cache?.snapshot()[id]) void cache?.load(id);
  }, [cache, pages]);
  const [actionError, setActionError] = useState<{ message: string; conceptId?: string } | null>(null);
  const [opening, setOpening] = useState(false);
  async function review(id: string, archive: boolean) {
    setActionError(null); try { await log.review(id, archive); }
    catch { setActionError({ message: "We couldn't confirm that change. Please try again.", conceptId: id }); }
  }
  async function open(action: () => Promise<void>, conceptId?: string) {
    if (opening) return;
    setOpening(true); setActionError(null);
    try { await action(); } catch { setActionError({ message: "We couldn't open that exam result. Please try again.", conceptId }); } finally { setOpening(false); }
  }
  const pageNotice = log.error ? <ExamNotice><NoticeMessage message={log.error} />{" "}<RetryAction busy={log.loading} onClick={() => void log.refresh()} /></ExamNotice> : undefined;
  if (!log.data) return <div className="exam-error-log">{pageNotice}<BackLink onClick={onBack} />
    <h1>Error log</h1>{!log.error && <p role="status">Loading your Error log…</p>}
  </div>;
  function example(e: ErrorLogExample): ErrorLogConceptPresentation["examples"][number] {
    return { id: e.id, attemptId: e.attemptId, partId: e.partId, prompt: e.prompt,
      part: `Question ${e.questionNumber} · Part ${e.partNumber}`, attempt: examKindLabel(e.examKind), date: date(e.finishedAt) };
  }
  const concepts: ErrorLogConceptPresentation[] = [...log.data.entries].sort((a, b) => {
    const aDate = a.status === "archived" ? a.archivedAt! : a.lastSavedAt;
    const bDate = b.status === "archived" ? b.archivedAt! : b.lastSavedAt;
    return Date.parse(bDate) - Date.parse(aDate) || a.conceptId.localeCompare(b.conceptId);
  }).map(entry => {
    const definition = log.data!.catalogue.concepts.find(c => c.id === entry.conceptId)!;
    const page = pages[entry.conceptId];
    return { id: entry.conceptId, label: definition.label, drillTarget: definition.active ? definition.drillTarget : undefined, topicId: definition.topicId,
      topic: log.data!.catalogue.topics.find(t => t.id === definition.topicId)!.label, type: definition.errorType,
      lastSaved: date(entry.lastSavedAt), exampleCount: entry.exampleCount, archived: entry.status === "archived", reopened: Boolean(entry.reopenedAt),
      examples: page?.examples.map(example) ?? [], examplesLoading: page?.loading, examplesError: page?.error, hasMoreExamples: Boolean(page?.nextCursor) };
  });
  return <>
    {drill.session && <DrillRunner key={drill.session.id}
      title={drillDefinitions[drill.session.request.drill].title + (drill.session.request.drill === "compensation" ? " · " + compensationRules[drill.session.request.rule].label : "")}
      request={drill.session.request} set={drill.session.set} busy={drill.busy} error={drill.error}
      pressureUnit={pressureUnit} onExit={exitDrill} returnLabel="Back to Error Log"
      onRepeat={() => { if (drill.session) void drill.start(drill.session.request); }} />}
    <div hidden={Boolean(drill.session)} ref={list}>
    <ExamErrorLog onPractice={loadDrill ? practice : undefined}
      launchingId={drill.busy ? origin.current?.id : undefined} concepts={concepts} onBack={onBack} busy={log.busy || opening} pageNotice={pageNotice} actionError={drill.error || actionError?.message} actionErrorConceptId={drill.error ? origin.current?.id : actionError?.conceptId}
      onExpand={expand} onLoadMore={id => void cache?.load(id, Boolean(pages[id]?.nextCursor))}
      onArchive={id => void review(id, true)} onRestore={id => void review(id, false)}
      onOpenResult={onOpenLatest ? () => void open(onOpenLatest) : undefined}
      onOpenExample={e => { if (e.attemptId && e.partId) void open(() => onOpenExample(e.attemptId!, e.partId!), concepts.find(c => c.examples.includes(e))?.id); }} />
    </div>
  </>;
}
