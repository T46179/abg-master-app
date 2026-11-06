import { useCallback, useEffect, useRef, useState } from "react";
import { ExamErrorLog } from "./ExamErrorLog";
import { examKindLabel } from "./examLabels";
import { BackLink } from "./ExamUi";
import { ExamNotice, NoticeMessage, RetryAction } from "./ExamNotice";
import type { ErrorLogConceptPresentation, ErrorLogExample, ErrorLogExamplePage } from "./errorLogTypes";
import type { useExamErrorLog } from "./useExamErrorLog";

type Page = ErrorLogExamplePage & { loading?: boolean; error?: string };
const date = (value: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(value));

export function ConnectedExamErrorLog({ log, onBack, onOpenExample, onOpenLatest }: {
  log: ReturnType<typeof useExamErrorLog>; onBack: () => void;
  onOpenExample: (attemptId: string, partId: string) => Promise<void>; onOpenLatest?: () => Promise<void>;
}) {
  const [pages, setPages] = useState<Record<string, Page>>({});
  const [actionError, setActionError] = useState<{ message: string; conceptId?: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(new Set<string>());
  const previousData = useRef(log.data);
  useEffect(() => {
    if (previousData.current && previousData.current !== log.data) { ++generation.current; setPages({}); inFlight.current.clear(); }
    previousData.current = log.data;
  }, [log.data]);
  useEffect(() => () => { ++generation.current; }, [log.client]);
  const loadExamples = useCallback(async (conceptId: string, next = false) => {
    if (!log.client || inFlight.current.has(conceptId)) return;
    inFlight.current.add(conceptId);
    const request = generation.current;
    const existing = pages[conceptId];
    const cursor = next ? existing?.nextCursor : null;
    setPages(current => ({ ...current, [conceptId]: { examples: existing?.examples ?? [], nextCursor: cursor ?? null, error: existing?.error, loading: true } }));
    try {
      const page = await log.client.examples(conceptId, cursor);
      if (generation.current === request) setPages(current => ({ ...current, [conceptId]: {
        examples: cursor ? [...(existing?.examples ?? []), ...page.examples.filter(e => !existing?.examples.some(old => old.id === e.id))] : page.examples,
        nextCursor: page.nextCursor,
      } }));
    } catch {
      if (generation.current === request) setPages(current => ({ ...current, [conceptId]: {
        examples: existing?.examples ?? [], nextCursor: cursor ?? null, error: "We couldn't load your saved examples. Please try again.",
      } }));
    } finally { if (generation.current === request) inFlight.current.delete(conceptId); }
  }, [log.client, pages]);
  const expand = useCallback((id: string) => { if (!pages[id]) void loadExamples(id); }, [pages, loadExamples]);
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
    return { id: entry.conceptId, label: definition.label, topicId: definition.topicId,
      topic: log.data!.catalogue.topics.find(t => t.id === definition.topicId)!.label, type: definition.errorType,
      lastSaved: date(entry.lastSavedAt), exampleCount: entry.exampleCount, archived: entry.status === "archived", reopened: Boolean(entry.reopenedAt),
      examples: page?.examples.map(example) ?? [], examplesLoading: page?.loading, examplesError: page?.error, hasMoreExamples: Boolean(page?.nextCursor) };
  });
  return <>
    <ExamErrorLog concepts={concepts} onBack={onBack} busy={log.busy || opening} pageNotice={pageNotice} actionError={actionError?.message} actionErrorConceptId={actionError?.conceptId}
      onExpand={expand} onLoadMore={id => void loadExamples(id, Boolean(pages[id]?.nextCursor))}
      onArchive={id => void review(id, true)} onRestore={id => void review(id, false)}
      onOpenResult={onOpenLatest ? () => void open(onOpenLatest) : undefined}
      onOpenExample={e => { if (e.attemptId && e.partId) void open(() => onOpenExample(e.attemptId!, e.partId!), concepts.find(c => c.examples.includes(e))?.id); }} />
  </>;
}
