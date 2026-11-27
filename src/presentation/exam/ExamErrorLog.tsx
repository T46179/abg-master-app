import { useEffect, useId, useState, type ReactNode } from "react";
import { NoticeMessage, RetryAction } from "./ExamNotice";
import { ArrowIcon, CheckIcon, ChevronRightIcon, CrossIcon, FlagIcon, HistoryIcon } from "./ExamIcons";
import type { DrillTarget, ErrorLogConceptPresentation } from "./errorLogTypes";
import "./errorLog.css";

export function ErrorLogSkeleton({ kind, count }: { kind: "concept" | "example"; count: number }) {
  return <>
    <span className="exam-error-log__loading-status" role="status">
      {kind === "concept" ? "Loading your Error log…" : "Loading saved examples…"}
    </span>
    {Array.from({ length: Math.min(count, 3) }, (_, index) =>
      <div key={index} aria-hidden="true" className={`exam-error-log__skeleton exam-error-log__skeleton--${kind}`}>
        <span className="exam-error-log__skeleton-line" />
        <span className="exam-error-log__skeleton-line exam-error-log__skeleton-line--detail" />
      </div>)}
  </>;
}

export function ExamErrorLog({ concepts, onOpenResult, onOpenExample, onArchive, onRestore, onExpand, onLoadMore, launchingId, onPractice, busy, actionError, actionErrorConceptId, pageNotice }: {
  concepts: readonly ErrorLogConceptPresentation[];
  onOpenResult?: () => void;
  onOpenExample?: (example: ErrorLogConceptPresentation["examples"][number]) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onExpand?: (id: string) => void;
  onLoadMore?: (id: string) => void;
  launchingId?: string;
  onPractice?: (id: string, target: DrillTarget) => void;
  busy?: boolean;
  actionError?: string;
  actionErrorConceptId?: string;
  pageNotice?: ReactNode;
}) {
  const [tab, setTab] = useState<"open" | "archived">("open");
  const [openId, setOpenId] = useState<string | null>(concepts.find(c => !c.archived)?.id ?? null);
  const [topic, setTopic] = useState<string | null>(null);
  const id = useId();
  const open = concepts.filter(c => !c.archived);
  const done = concepts.filter(c => c.archived);
  const rows = (tab === "open" ? open : done).filter(c => topic === null || (c.topicId ?? c.topic) === topic);
  const topicLabel = concepts.find(c => (c.topicId ?? c.topic) === topic)?.topic ?? topic;
  const byTopic = Object.entries(open.reduce<Record<string, number>>((counts, c) => {
    const key = c.topicId ?? c.topic;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);

  const visibleOpenId = rows.some(c => c.id === openId) ? openId : null;
  useEffect(() => { if (visibleOpenId) onExpand?.(visibleOpenId); }, [visibleOpenId, onExpand]);
  useEffect(() => {
    if (topic !== null && !concepts.some(c => (c.topicId ?? c.topic) === topic)) setTopic(null);
  }, [concepts, topic]);

  return <div className="exam-error-log">
    {pageNotice}
    <header className="exam-error-log__heading">
      <h1>Error log</h1>
      <p>Keep track of challenging concepts from your exams. Reinforce your understanding with focused drills, and use your error log to guide revision alongside your other study resources.</p>
    </header>
    {concepts.length === 0 ? <div className="exam-error-log__empty exam-error-log__empty--initial">
      <span className="exam-error-log__empty-icon"><FlagIcon /></span>
      <h2>Your Error Log is empty</h2>
      <p>Save concepts from your exam results to keep track of areas for improvement. Use <strong>Add to error log</strong> to include it here to guide your revision.</p>
      {onOpenResult && <button type="button" disabled={busy || Boolean(launchingId)} className="figma-button exam-primary" onClick={onOpenResult}>Review latest result <ArrowIcon /></button>}
      {actionError && !actionErrorConceptId && <p className="exam-inline-error" role="alert"><NoticeMessage message={actionError} /></p>}
    </div> : <div className="exam-error-log__grid">
      <div className="exam-error-log__main">
        <div className="exam-error-log__toolbar">
          <div className="exam-segments exam-error-log__tabs" role="group" aria-label="Error log status">
            {([
              { key: "open", label: "To review", count: open.length },
              { key: "archived", label: "Archived", count: done.length }
            ] as const).map(t => <button type="button" key={t.key} disabled={Boolean(launchingId)} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label} <span>{t.count}</span>
            </button>)}
          </div>
          {topic !== null && <button type="button" className="exam-error-log__filter" disabled={Boolean(launchingId)} aria-label={`Clear ${topicLabel} filter`} onClick={() => setTopic(null)}>{topicLabel}<CrossIcon /></button>}
        </div>
        <div className="exam-error-log__list">
          {rows.map(c => {
            const expanded = openId === c.id;
            const arch = Boolean(c.archived);
            const exampleCount = c.exampleCount ?? c.examples.length;
            const panelId = `${id}-${c.id}`;
            return <section key={c.id} className="exam-error-log__concept">
              <button type="button" className="exam-error-log__row" disabled={Boolean(launchingId)} aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenId(expanded ? null : c.id)}>
                <span className="exam-error-log__dot" data-archived={arch} aria-hidden="true" />
                <span className="exam-error-log__copy">
                  <span className="exam-error-log__title"><strong>{c.label}</strong>{c.reopened && !arch && <span className="exam-error-log__reopened">Reopened</span>}</span>
                  <span className="exam-error-log__meta">{c.topic}</span>
                </span>
                <span className="exam-error-log__count"><span>{exampleCount}</span></span>
                <span className="exam-error-log__chevron" data-open={expanded} aria-hidden="true"><ChevronRightIcon /></span>
              </button>
              <div id={panelId} hidden={!expanded} className="exam-error-log__expanded">
                <h3 className="exam-error-log__eyebrow">Saved</h3>
                <div className="exam-error-log__examples">
                  {c.examples.map((example, index) => <button type="button" disabled={busy || Boolean(launchingId)} key={example.id ?? index} onClick={() => onOpenExample ? onOpenExample(example) : onOpenResult?.()}>
                    <span className="exam-error-log__example-copy"><span>{example.prompt}</span><small>{example.part} · {example.attempt} · {example.date}</small></span>
                    <span className="exam-error-log__view">View <ChevronRightIcon /></span>
                  </button>)}
                  {expanded && c.examplesLoading && <ErrorLogSkeleton kind="example" count={Math.max(1, exampleCount - c.examples.length)} />}
                </div>
                {c.examplesError && !c.examplesLoading && <p className="exam-inline-error" role="alert"><NoticeMessage message={c.examplesError} />{" "}<RetryAction busy={Boolean(c.examplesLoading)} onClick={() => onLoadMore?.(c.id)} /></p>}
                {c.hasMoreExamples && !c.examplesError && <button type="button" className="exam-error-log__text-button" disabled={c.examplesLoading} onClick={() => onLoadMore?.(c.id)}>Load more</button>}
                <div className="exam-error-log__footer">
                  <button type="button" disabled={busy || Boolean(launchingId)} className={`figma-button figma-button--secondary${arch ? "" : " exam-error-log__archive"}`} onClick={() => arch ? onRestore?.(c.id) : onArchive?.(c.id)}>
                    {busy && <span className="figma-button__spinner" aria-hidden="true" />}{arch ? <><HistoryIcon /> Restore to review</> : <><CheckIcon /> Archive</>}
                  </button>
                  {expanded && !arch && c.drillTarget && onPractice && <button type="button"
                    className="figma-button exam-primary" data-practice={c.id}
                    disabled={busy || Boolean(launchingId)} aria-label={`Practice ${c.label}`}
                    onClick={() => onPractice(c.id, c.drillTarget!)}>
                    {launchingId === c.id ? "Starting drill…" : "Practice"}
                  </button>}
                </div>
                {actionError && actionErrorConceptId === c.id && <p className="exam-inline-error" role="alert"><NoticeMessage message={actionError} /></p>}
              </div>
            </section>;
          })}
          {rows.length === 0 && tab === "open" && <div className="exam-error-log__empty">
            {topic === null ? <>
              <span className="exam-error-log__empty-icon exam-error-log__empty-icon--done"><CheckIcon /></span>
              <h2>Nothing awaiting review</h2>
              <p>There is nothing currently to review. You can revisit archived concepts at anytime, or save new examples from your exam results</p>
              {done.length > 0 && <button type="button" className="exam-error-log__text-button" onClick={() => setTab("archived")}>View {done.length} archived</button>}
            </> : <><h2>Nothing awaiting review in {topicLabel}</h2><button type="button" className="exam-error-log__text-button" onClick={() => setTopic(null)}>Clear topic filter</button></>}
          </div>}
          {rows.length === 0 && tab === "archived" && <div className="exam-error-log__empty">No archived concepts yet.</div>}
        </div>
      </div>
      <aside className="exam-error-log__topics" aria-label="To review by topic">
        <h2 className="exam-error-log__eyebrow">To review by topic</h2>
        {byTopic.length === 0 ? <p>All clear.</p> : <div>{byTopic.map(([name, count]) => <button type="button" key={name} disabled={Boolean(launchingId)} aria-pressed={topic === name} onClick={() => { setTab("open"); setTopic(topic === name ? null : name); }}>
          <span className="exam-error-log__topic-label"><span>{concepts.find(c => (c.topicId ?? c.topic) === name)?.topic ?? name}</span><span>{count}</span></span>
          <span className="exam-error-log__bar" aria-hidden="true"><span style={{ width: `${count / byTopic[0][1] * 100}%` }} /></span>
        </button>)}</div>}
      </aside>
    </div>}
  </div>;
}
