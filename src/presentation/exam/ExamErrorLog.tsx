import { useEffect, useId, useState } from "react";
import { ArrowIcon, CheckIcon, ChevronRightIcon, CrossIcon, FlagIcon, HistoryIcon } from "./ExamIcons";
import { BackLink } from "./ExamUi";
import type { ErrorLogConceptPresentation } from "./errorLogTypes";
import "./errorLog.css";

export function ExamErrorLog({ concepts, onBack, onOpenResult, onOpenExample, onArchive, onRestore, onExpand, onLoadMore, busy, actionError }: {
  concepts: readonly ErrorLogConceptPresentation[];
  onBack: () => void;
  onOpenResult?: () => void;
  onOpenExample?: (example: ErrorLogConceptPresentation["examples"][number]) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onExpand?: (id: string) => void;
  onLoadMore?: (id: string) => void;
  busy?: boolean;
  actionError?: string;
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
    <BackLink onClick={onBack} />
    <header className="exam-error-log__heading">
      <p className="exam-eyebrow">Exam Room</p>
      <h1>Error log</h1>
      <p>Concepts you chose to save from Results, each with the Parts that tripped you up. Archive once it's clicked — saving a new example reopens it.</p>
    </header>
    {actionError && <p role="alert">{actionError}</p>}
    {concepts.length === 0 ? <div className="exam-error-log__empty exam-error-log__empty--initial">
      <span className="exam-error-log__empty-icon"><FlagIcon /></span>
      <h2>Nothing saved yet</h2>
      <p>When reviewing a result, use <strong>Add to error log</strong> on any Part to save the concept behind it. It'll appear here to work through.</p>
      {onOpenResult && <button type="button" disabled={busy} className="figma-button exam-primary" onClick={onOpenResult}>Review latest result <ArrowIcon /></button>}
    </div> : <div className="exam-error-log__grid">
      <div>
        <div className="exam-error-log__toolbar">
          <div className="exam-segments exam-error-log__tabs" role="group" aria-label="Error log status">
            {([
              { key: "open", label: "To review", count: open.length },
              { key: "archived", label: "Archived", count: done.length }
            ] as const).map(t => <button type="button" key={t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label} <span>{t.count}</span>
            </button>)}
          </div>
          {topic !== null && <button type="button" className="exam-error-log__filter" aria-label={`Clear ${topicLabel} filter`} onClick={() => setTopic(null)}>{topicLabel}<CrossIcon /></button>}
        </div>
        <div className="exam-error-log__list">
          {rows.map(c => {
            const expanded = openId === c.id;
            const arch = Boolean(c.archived);
            const exampleCount = c.exampleCount ?? c.examples.length;
            const panelId = `${id}-${c.id}`;
            return <section key={c.id} className="exam-error-log__concept">
              <button type="button" className="exam-error-log__row" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenId(expanded ? null : c.id)}>
                <span className="exam-error-log__dot" data-archived={arch} aria-hidden="true" />
                <span className="exam-error-log__copy">
                  <span className="exam-error-log__title"><strong>{c.label}</strong>{c.reopened && !arch && <span className="exam-error-log__reopened">Reopened</span>}</span>
                  <span className="exam-error-log__meta">{c.topic} <span>·</span> {c.type}</span>
                </span>
                <span className="exam-error-log__count"><span>{exampleCount} {exampleCount === 1 ? "example" : "examples"}</span><small>Last saved {c.lastSaved}</small></span>
                <span className="exam-error-log__chevron" data-open={expanded} aria-hidden="true"><ChevronRightIcon /></span>
              </button>
              <div id={panelId} hidden={!expanded} className="exam-error-log__expanded">
                <h3 className="exam-error-log__eyebrow">Saved examples</h3>
                <div className="exam-error-log__examples">
                  {c.examples.map((example, index) => <button type="button" disabled={busy} key={example.id ?? index} onClick={() => onOpenExample ? onOpenExample(example) : onOpenResult?.()}>
                    <span className="exam-error-log__example-copy"><span>{example.prompt}</span><small>{example.part} · {example.attempt} · {example.date}</small></span>
                    <span className="exam-error-log__view">View in Results <ChevronRightIcon /></span>
                  </button>)}
                </div>
                {c.examplesLoading && <p role="status">Loading saved examples…</p>}
                {c.examplesError && <p role="alert">{c.examplesError} <button type="button" className="exam-error-log__text-button" onClick={() => onLoadMore?.(c.id)}>Retry</button></p>}
                {c.hasMoreExamples && !c.examplesError && <button type="button" className="exam-error-log__text-button" disabled={c.examplesLoading} onClick={() => onLoadMore?.(c.id)}>Load more</button>}
                <div className="exam-error-log__footer"><span>{arch ? "Examples are kept while archived." : "Archiving keeps every example."}</span>
                  <button type="button" disabled={busy} className={`figma-button exam-error-log__archive${arch ? " figma-button--secondary" : " exam-primary"}`} onClick={() => arch ? onRestore?.(c.id) : onArchive?.(c.id)}>
                    {arch ? <><HistoryIcon /> Restore to review</> : <><CheckIcon /> Archive</>}
                  </button>
                </div>
              </div>
            </section>;
          })}
          {rows.length === 0 && tab === "open" && <div className="exam-error-log__empty">
            {topic === null ? <>
              <span className="exam-error-log__empty-icon exam-error-log__empty-icon--done"><CheckIcon /></span>
              <h2>Nothing awaiting review</h2>
              <p>Everything you've saved is archived. New examples saved from Results will reopen their concept here.</p>
              {done.length > 0 && <button type="button" className="exam-error-log__text-button" onClick={() => setTab("archived")}>View {done.length} archived</button>}
            </> : <><h2>Nothing awaiting review in {topicLabel}</h2><button type="button" className="exam-error-log__text-button" onClick={() => setTopic(null)}>Clear topic filter</button></>}
          </div>}
          {rows.length === 0 && tab === "archived" && <div className="exam-error-log__empty">No archived concepts yet.</div>}
        </div>
      </div>
      <aside className="exam-error-log__topics" aria-label="To review by topic">
        <h2 className="exam-error-log__eyebrow">To review by topic</h2>
        {byTopic.length === 0 ? <p>All clear.</p> : <div>{byTopic.map(([name, count]) => <button type="button" key={name} aria-pressed={topic === name} onClick={() => { setTab("open"); setTopic(topic === name ? null : name); }}>
          <span className="exam-error-log__topic-label"><span>{concepts.find(c => (c.topicId ?? c.topic) === name)?.topic ?? name}</span><span>{count}</span></span>
          <span className="exam-error-log__bar" aria-hidden="true"><span style={{ width: `${count / byTopic[0][1] * 100}%` }} /></span>
        </button>)}</div>}
      </aside>
    </div>}
  </div>;
}
