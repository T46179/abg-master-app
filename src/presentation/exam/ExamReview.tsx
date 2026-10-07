import { Surface } from "../primitives/Surface";
import { ArrowIcon, CheckIcon, ChevronRightIcon, CrossIcon, DotIcon, HistoryIcon, LayersIcon, ReportIcon, SplitIcon } from "./ExamIcons";
import { AccuracyBar, BackLink, IconBadge, ScoreRing, SummaryTiles, toneStyle } from "./ExamUi";
import { attemptPercent, scoreTone } from "./presentationModel";
import type { AttemptPresentation, HistoryFilter, HistoryPresentation, LatestResultPresentation } from "./presentationTypes";

export function ExamResults({ result, onBack, onHistory }: {
  result: LatestResultPresentation; onBack: () => void; onHistory: () => void;
}) {
  return <div className="exam-review">
    <BackLink onClick={onBack} />
    <header className="exam-result-heading">
      <div><p className="exam-eyebrow">{result.sittingLabel}</p><h1>Sitting complete</h1></div>
      <span className="exam-target"><DotIcon />{result.percent}% · below {result.target}% target</span>
    </header>
    <div className="exam-result-summary">
      <Surface className="exam-overall">
        <ScoreRing percent={result.percent} />
        <div>
          <p className="exam-eyebrow">Overall score</p>
          <p>{result.totalCorrect} of {result.totalSteps} reasoning steps correct across {result.cases.length} cases.</p>
          <p className="exam-small">{result.percentileLabel}</p>
        </div>
      </Surface>
      <SummaryTiles tiles={result.summary} />
    </div>
    <Surface className="exam-review-card">
      <h2>Accuracy by step</h2>
      <p className="exam-description">How often you got each part of the interpretation right in this sitting.</p>
      <div className="exam-step-list">
        {result.steps.map(step => <div className="exam-step-row" key={step.label}>
          <span className="exam-step-label">{step.label}</span>
          <AccuracyBar percent={step.percent} />
          <span className="exam-step-score" style={toneStyle(scoreTone(step.percent))}>
            <strong className="exam-accent">{step.percent}%</strong>
            <span className="exam-small">{step.correct}/{step.total}</span>
          </span>
        </div>)}
      </div>
    </Surface>
    <Surface className="exam-review-card">
      <h2>Case-by-case</h2>
      <div className="exam-case-table" role="table" aria-label="Case-by-case">
        <div className="exam-case-row exam-case-header" role="row">
          <span role="columnheader">#</span><span role="columnheader">Case</span>
          <span role="columnheader">Steps</span><span role="columnheader">Time</span><span role="columnheader">Result</span>
        </div>
        {result.cases.map(row => <div className="exam-case-row" key={row.n} role="row">
          <span className="exam-case-number" role="cell">{String(row.n).padStart(2, "0")}</span>
          <div className="exam-case-name" role="cell"><strong>{row.diagnosis}</strong><span className="exam-small">{row.primary}</span></div>
          <div className="exam-case-steps" role="cell"><AccuracyBar percent={row.percent} /><span>{row.correct}/{row.total}</span></div>
          <span className="exam-case-time" role="cell">{row.time}</span>
          <span className="exam-case-result" role="cell">
            <span className="exam-result-marker" style={toneStyle(row.passed ? "green" : "coral")} role="img" aria-label={row.passed ? "Passed" : "Below target"}>
              {row.passed ? <CheckIcon /> : <CrossIcon />}
            </span>
          </span>
        </div>)}
      </div>
      <div className="exam-review-actions">
        <button type="button" className="figma-button exam-primary">Review answers <ArrowIcon /></button>
        <button type="button" className="figma-button figma-button--secondary" onClick={onHistory}><HistoryIcon />All past attempts</button>
      </div>
    </Surface>
  </div>;
}

export function ExamHistory({ history, attempts, filter, onFilterChange, onBack, onOpen, onRetry, onLoadMore, total, loading, busy, unavailable }: {
  history: HistoryPresentation;
  attempts: AttemptPresentation[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onBack: () => void;
  onOpen: (id: string) => void;
  onRetry?: (id: string) => void;
  onLoadMore?: () => void;
  total?: number; loading?: boolean; busy?: boolean; unavailable?: boolean;
}) {
  const filters: { value: HistoryFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: history.counts?.all ?? history.attempts.length },
    { value: "mock", label: "Mock", count: history.counts?.mock ?? history.attempts.filter(row => row.kind === "mock").length },
    { value: "custom", label: "Custom", count: history.counts?.custom ?? history.attempts.filter(row => row.kind === "custom").length }
  ];
  const stats = [
    { value: String(history.submitted ?? history.attempts.length), label: "Submitted" },
    { value: history.best === null ? "—" : `${history.best}%`, label: "Best score" },
    { value: String(history.totalCases), label: "Cases sat" },
    { value: String(history.awaiting), label: "Awaiting grade", note: history.awaiting > 0 }
  ];
  return <div className="exam-history">
    <BackLink onClick={onBack} />
    <header><p className="exam-eyebrow">Exam Room</p><h1>Past attempts</h1><p className="exam-history-description">Every submitted sitting, kept exactly as you answered it — cases, values, marks and model answers. Abandoned exams aren't recorded.</p></header>
    <Surface className="exam-history-summary">
      <div className="exam-history-average">
        <p className="exam-eyebrow">Average score · graded sittings</p>
        <div className="exam-history-trend-row">
          <strong className="exam-history-average-value">{history.average ?? "—"}{history.average !== null && <span>%</span>}</strong>
          {!!history.trend.length && <div className="exam-history-trend" role="img" aria-label={`Graded scores, oldest to latest: ${history.trend.map(score => `${score}%`).join(", ")}`}>
            {history.trend.map((score, index) => <span key={index} title={`${score}%`} aria-hidden="true" style={{ height: `${Math.max(12, score)}%` }} />)}
          </div>}
        </div>
        <p className="exam-small">{unavailable ? "Scores unavailable" : history.trend.length ? `Last ${history.trend.length} graded sittings, oldest → latest` : "No graded sittings yet"}</p>
      </div>
      <div className="exam-history-stats">{stats.map(stat => <div key={stat.label}>
        <strong>{unavailable ? "—" : stat.value}{stat.note && <span className="exam-awaiting-dot" aria-hidden="true" />}</strong><span className="exam-eyebrow">{stat.label}</span>
      </div>)}</div>
    </Surface>
    <div className="exam-history-filters">
      <div className="exam-segments" role="group" aria-label="Past attempts filter">{filters.map(item => <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => onFilterChange(item.value)}>{item.label}{!unavailable && <span>{item.count}</span>}</button>)}</div>
      <span className="exam-history-order">Most recent first</span>
    </div>
    <Surface className="exam-attempt-list">
      <div className="exam-history-columns" aria-hidden="true"><span>Sitting</span><span>Time</span><span>Marks</span><span>Score</span><span /></div>
      <ul className="exam-history-entries">{attempts.map(attempt => {
        const percent = attemptPercent(attempt);
        const label = attempt.kind === "mock" ? "Mock exam" : "Custom exam";
        return <li className="exam-history-entry" key={attempt.id}>
          <button type="button" className="exam-attempt-open" disabled={busy} onClick={() => onOpen(attempt.id)} aria-label={`Review ${label}, ${attempt.date} at ${attempt.time}`}>
            <IconBadge>{attempt.kind === "mock" ? <LayersIcon /> : <SplitIcon />}</IconBadge>
            <span className="exam-attempt-copy">
              <span className="exam-attempt-title"><strong>{label}</strong><span className="exam-attempt-case-count">· {attempt.cases} cases</span>
                {attempt.status !== "completed" && <span className="exam-grading-chip" data-status={attempt.status}><span aria-hidden="true" />{attempt.status === "pending" ? "Grading" : "Grading failed"}</span>}
              </span>
              <span className="exam-attempt-detail"><time dateTime={attempt.finishedAt}>{attempt.date} · {attempt.time}</time>{!!attempt.exclusions.length && <><span className="exam-exclusion-divider" aria-hidden="true">|</span><span className="exam-exclusion-label">Excl.</span>{attempt.exclusions.map(exclusion => <span className="exam-exclusion-tag" key={exclusion}>{exclusion}</span>)}</>}</span>
            </span>
          </button>
          <span className="exam-history-time"><span className="exam-mobile-label">Time </span>{attempt.elapsed}</span>
          <span className="exam-history-marks"><span className="exam-mobile-label">Marks </span>{attempt.status === "completed" ? attempt.awarded ?? "—" : "—"}<span>/{attempt.available}</span></span>
          <div className="exam-history-score">{percent !== null ? <>
            <span className="exam-history-score-bar" data-low={percent < 60} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></span><strong>{percent}%</strong>
          </> : attempt.status === "failed" ? <button type="button" className="exam-retry-grading" disabled={busy || !onRetry || !attempt.canRetryGrading} onClick={() => onRetry?.(attempt.id)}>Retry grading</button> : <span className="exam-history-marking">{attempt.status === "pending" ? "Marking…" : "—"}</span>}</div>
          <span className="exam-history-chevron" aria-hidden="true"><ChevronRightIcon /></span>
        </li>;
      })}</ul>
      {!attempts.length && <p className="exam-empty">{loading ? "Loading your exams…" : unavailable ? "Your exams couldn’t be loaded. Please retry." : "No attempts in this filter yet."}</p>}
      <footer className="exam-history-footer"><span>Showing <strong>{attempts.length}</strong> of <strong>{unavailable ? "—" : total ?? attempts.length}</strong></span>{onLoadMore && <button type="button" className="figma-button figma-button--secondary" disabled={loading || busy} onClick={onLoadMore}>{loading ? "Loading…" : "Load more"}</button>}<span><ReportIcon />Retakes &amp; objective breakdown coming soon</span></footer>
    </Surface>
  </div>;
}
