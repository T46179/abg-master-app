import { Surface } from "../primitives/Surface";
import { ArrowIcon, CheckIcon, ChevronRightIcon, CrossIcon, DotIcon, HistoryIcon, LayersIcon, SplitIcon } from "./ExamIcons";
import { AccuracyBar, BackLink, IconBadge, ScoreRing, SegmentedControl, SummaryTiles, toneStyle } from "./ExamUi";
import { scoreTone } from "./presentationModel";
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

export function ExamHistory({ history, attempts, filter, onFilterChange, onBack, onOpen }: {
  history: HistoryPresentation;
  attempts: AttemptPresentation[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onBack: () => void;
  onOpen: () => void;
}) {
  return <div className="exam-history">
    <BackLink onClick={onBack} />
    <header><p className="exam-eyebrow">Exam Room</p><h1>Past attempts</h1></header>
    <SummaryTiles tiles={history.summary} />
    <div className="exam-history-filters">
      <SegmentedControl label="Past attempts filter" value={filter} onChange={onFilterChange}
        options={[{ value: "all", label: "All" }, { value: "mock", label: "Mock exams" }, { value: "drill", label: "Drills" }]} />
    </div>
    <Surface className="exam-attempt-list">
      {attempts.map(attempt => <button type="button" className="exam-attempt-row" key={attempt.id} onClick={onOpen}>
        <IconBadge tone={attempt.kind === "mock" ? "navy" : "purple"}>
          {attempt.kind === "mock" ? <LayersIcon /> : <SplitIcon />}
        </IconBadge>
        <span className="exam-attempt-copy">
          <span className="exam-attempt-title"><strong>{attempt.title}</strong>{attempt.kind === "mock" && <span className="exam-mock-tag">Mock</span>}</span>
          <span className="exam-small">{attempt.detail} · {attempt.date}</span>
        </span>
        <span className="exam-attempt-bar"><AccuracyBar percent={attempt.score} /></span>
        <strong className="exam-attempt-score exam-accent" style={toneStyle(scoreTone(attempt.score))}>{attempt.score}%</strong>
        <span className="exam-attempt-chevron" aria-hidden="true"><ChevronRightIcon /></span>
      </button>)}
      {!attempts.length && <p className="exam-empty">No attempts in this filter yet.</p>}
    </Surface>
  </div>;
}
